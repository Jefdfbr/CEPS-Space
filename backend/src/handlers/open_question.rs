use actix_web::{web, HttpRequest, HttpResponse, Error, HttpMessage};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use chrono::NaiveDateTime;

// ============= MODELS =============

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateGameRequest {
    pub title: String,
    pub description: Option<String>,
    pub game_password: String,
    pub presenter_password: String,
    pub questions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuestionResponse {
    pub id: i32,
    pub game_id: i32,
    pub question_text: String,
    pub order_index: i32,
    pub is_open: bool,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GameWithQuestionsResponse {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub questions: Vec<QuestionResponse>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitResponseRequest {
    pub response_text: String,
    pub player_name: Option<String>,
    pub room_name: Option<String>,
    pub game_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResponseData {
    pub id: i32,
    pub question_id: i32,
    pub response_text: String,
    pub player_name: Option<String>,
    pub room_name: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToggleQuestionRequest {
    pub presenter_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidatePasswordRequest {
    pub game_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidatePresenterPasswordRequest {
    pub presenter_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnifiedPasswordRequest {
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub role: String, // "presenter" ou "player"
    pub game: GameWithQuestionsResponse,
}

// ============= HELPERS =============

fn extract_user_id(req: &HttpRequest) -> Result<i32, Error> {
    req.extensions()
        .get::<i32>()
        .copied()
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))
}

// ============= HANDLERS =============

// POST /protected/open-question/games
pub async fn create_game(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    body: web::Json<CreateGameRequest>,
) -> Result<HttpResponse, Error> {
    let user_id = extract_user_id(&req)?;
    
    if body.questions.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "At least one question is required"
        })));
    }
    
    // Criar o jogo
    let game_row = sqlx::query(
        "INSERT INTO open_question_games (user_id, title, description, game_password, presenter_password) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, created_at, updated_at"
    )
    .bind(user_id)
    .bind(&body.title)
    .bind(&body.description)
    .bind(&body.game_password)
    .bind(&body.presenter_password)
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error creating game: {}", e);
        actix_web::error::ErrorInternalServerError("Failed to create game")
    })?;
    
    let game_id: i32 = game_row.get("id");
    let created_at: NaiveDateTime = game_row.get("created_at");
    let updated_at: NaiveDateTime = game_row.get("updated_at");
    
    // Inserir as perguntas
    for (index, question_text) in body.questions.iter().enumerate() {
        sqlx::query(
            "INSERT INTO open_question_questions (game_id, question_text, order_index, is_open) 
             VALUES ($1, $2, $3, false)"
        )
        .bind(game_id)
        .bind(question_text)
        .bind(index as i32)
        .execute(pool.as_ref())
        .await
        .map_err(|e| {
            log::error!("Database error creating question: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to create question")
        })?;
    }
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "id": game_id,
        "title": body.title,
        "description": body.description,
        "created_at": created_at,
        "updated_at": updated_at
    })))
}

// GET /open-question/games/:id (público - requer senha)
pub async fn get_game(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    query: web::Query<ValidatePasswordRequest>,
) -> Result<HttpResponse, Error> {
    let game_id = game_id.into_inner();
    
    // Verificar senha
    let password_row = sqlx::query(
        "SELECT game_password FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let password_row = password_row.ok_or_else(|| {
        actix_web::error::ErrorNotFound("Game not found")
    })?;
    
    let stored_password: String = password_row.get("game_password");
    
    if stored_password != query.game_password {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Senha inválida"
        })));
    }
    
    // Buscar jogo
    let game_row = sqlx::query(
        "SELECT id, title, description, created_at, updated_at FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    // Buscar perguntas
    let question_rows = sqlx::query(
        "SELECT id, game_id, question_text, order_index, is_open, created_at 
         FROM open_question_questions 
         WHERE game_id = $1 
         ORDER BY order_index ASC"
    )
    .bind(game_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let questions: Vec<QuestionResponse> = question_rows.iter().map(|row| {
        QuestionResponse {
            id: row.get("id"),
            game_id: row.get("game_id"),
            question_text: row.get("question_text"),
            order_index: row.get("order_index"),
            is_open: row.get("is_open"),
            created_at: row.get("created_at"),
        }
    }).collect();
    
    Ok(HttpResponse::Ok().json(GameWithQuestionsResponse {
        id: game_row.get("id"),
        title: game_row.get("title"),
        description: game_row.get("description"),
        questions,
        created_at: game_row.get("created_at"),
        updated_at: game_row.get("updated_at"),
    }))
}

// POST /open-question/games/:id/auth (novo endpoint unificado)
pub async fn authenticate_game(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    body: web::Json<UnifiedPasswordRequest>,
) -> Result<HttpResponse, Error> {
    let game_id = game_id.into_inner();
    
    // Buscar senhas do jogo
    let password_row = sqlx::query(
        "SELECT game_password, presenter_password FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let password_row = password_row.ok_or_else(|| {
        actix_web::error::ErrorNotFound("Game not found")
    })?;
    
    let game_password: String = password_row.get("game_password");
    let presenter_password: String = password_row.get("presenter_password");
    
    // Determinar papel baseado na senha fornecida
    let role = if body.password == presenter_password {
        "presenter"
    } else if body.password == game_password {
        "player"
    } else {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Senha inválida"
        })));
    };
    
    // Buscar dados do jogo
    let game_row = sqlx::query(
        "SELECT id, title, description, created_at, updated_at FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    // Buscar perguntas
    let question_rows = sqlx::query(
        "SELECT id, game_id, question_text, order_index, is_open, created_at 
         FROM open_question_questions 
         WHERE game_id = $1 
         ORDER BY order_index ASC"
    )
    .bind(game_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let questions: Vec<QuestionResponse> = question_rows.iter().map(|row| {
        QuestionResponse {
            id: row.get("id"),
            game_id: row.get("game_id"),
            question_text: row.get("question_text"),
            order_index: row.get("order_index"),
            is_open: row.get("is_open"),
            created_at: row.get("created_at"),
        }
    }).collect();
    
    Ok(HttpResponse::Ok().json(AuthResponse {
        role: role.to_string(),
        game: GameWithQuestionsResponse {
            id: game_row.get("id"),
            title: game_row.get("title"),
            description: game_row.get("description"),
            questions,
            created_at: game_row.get("created_at"),
            updated_at: game_row.get("updated_at"),
        },
    }))
}

// GET /protected/open-question/games/:id/presenter
pub async fn get_game_presenter(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    game_id: web::Path<i32>,
    query: web::Query<ValidatePresenterPasswordRequest>,
) -> Result<HttpResponse, Error> {
    let user_id = extract_user_id(&req)?;
    let game_id = game_id.into_inner();
    
    // Verificar ownership e senha
    let game_check_row = sqlx::query(
        "SELECT user_id, presenter_password FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let game_check_row = game_check_row.ok_or_else(|| {
        actix_web::error::ErrorNotFound("Game not found")
    })?;
    
    let owner_id: i32 = game_check_row.get("user_id");
    let stored_password: String = game_check_row.get("presenter_password");
    
    if owner_id != user_id {
        return Ok(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You don't have permission to access this game"
        })));
    }
    
    if stored_password != query.presenter_password {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid presenter password"
        })));
    }
    
    // Buscar jogo
    let game_row = sqlx::query(
        "SELECT id, title, description, created_at, updated_at FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    // Buscar perguntas
    let question_rows = sqlx::query(
        "SELECT id, game_id, question_text, order_index, is_open, created_at 
         FROM open_question_questions 
         WHERE game_id = $1 
         ORDER BY order_index ASC"
    )
    .bind(game_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let questions: Vec<QuestionResponse> = question_rows.iter().map(|row| {
        QuestionResponse {
            id: row.get("id"),
            game_id: row.get("game_id"),
            question_text: row.get("question_text"),
            order_index: row.get("order_index"),
            is_open: row.get("is_open"),
            created_at: row.get("created_at"),
        }
    }).collect();
    
    Ok(HttpResponse::Ok().json(GameWithQuestionsResponse {
        id: game_row.get("id"),
        title: game_row.get("title"),
        description: game_row.get("description"),
        questions,
        created_at: game_row.get("created_at"),
        updated_at: game_row.get("updated_at"),
    }))
}

// GET /open-question/games/:id/presenter-public (sem autenticação JWT, apenas senha)
pub async fn get_game_presenter_public(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    query: web::Query<ValidatePresenterPasswordRequest>,
) -> Result<HttpResponse, Error> {
    let game_id = game_id.into_inner();
    
    // Verificar senha do apresentador
    let game_check_row = sqlx::query(
        "SELECT presenter_password FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let game_check_row = game_check_row.ok_or_else(|| {
        actix_web::error::ErrorNotFound("Game not found")
    })?;
    
    let stored_password: String = game_check_row.get("presenter_password");
    
    if stored_password != query.presenter_password {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid presenter password"
        })));
    }
    
    // Buscar jogo
    let game_row = sqlx::query(
        "SELECT id, title, description, created_at, updated_at FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    // Buscar perguntas
    let question_rows = sqlx::query(
        "SELECT id, game_id, question_text, order_index, is_open, created_at 
         FROM open_question_questions 
         WHERE game_id = $1 
         ORDER BY order_index ASC"
    )
    .bind(game_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let questions: Vec<QuestionResponse> = question_rows.iter().map(|row| {
        QuestionResponse {
            id: row.get("id"),
            game_id: row.get("game_id"),
            question_text: row.get("question_text"),
            order_index: row.get("order_index"),
            is_open: row.get("is_open"),
            created_at: row.get("created_at"),
        }
    }).collect();
    
    Ok(HttpResponse::Ok().json(GameWithQuestionsResponse {
        id: game_row.get("id"),
        title: game_row.get("title"),
        description: game_row.get("description"),
        questions,
        created_at: game_row.get("created_at"),
        updated_at: game_row.get("updated_at"),
    }))
}

// POST /open-question/questions/:id/toggle-public (sem JWT, apenas senha)
pub async fn toggle_question_public(
    pool: web::Data<PgPool>,
    question_id: web::Path<i32>,
    body: web::Json<ToggleQuestionRequest>,
) -> Result<HttpResponse, Error> {
    let question_id = question_id.into_inner();
    
    // Verificar senha
    let check_row = sqlx::query(
        "SELECT g.presenter_password, q.game_id, q.is_open 
         FROM open_question_questions q 
         JOIN open_question_games g ON q.game_id = g.id 
         WHERE q.id = $1"
    )
    .bind(question_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let check_row = check_row.ok_or_else(|| {
        actix_web::error::ErrorNotFound("Question not found")
    })?;
    
    let stored_password: String = check_row.get("presenter_password");
    let game_id: i32 = check_row.get("game_id");
    let is_open: bool = check_row.get("is_open");
    
    if stored_password != body.presenter_password {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid presenter password"
        })));
    }
    
    let new_is_open = !is_open;
    
    // Se estiver abrindo esta pergunta, fechar todas as outras do mesmo jogo
    if new_is_open {
        sqlx::query(
            "UPDATE open_question_questions SET is_open = false WHERE game_id = $1 AND id != $2"
        )
        .bind(game_id)
        .bind(question_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| {
            log::error!("Database error closing other questions: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to close other questions")
        })?;
    }
    
    // Alternar o estado da pergunta atual
    sqlx::query(
        "UPDATE open_question_questions SET is_open = $1 WHERE id = $2"
    )
    .bind(new_is_open)
    .bind(question_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error toggling question: {}", e);
        actix_web::error::ErrorInternalServerError("Failed to toggle question")
    })?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "is_open": new_is_open
    })))
}

// POST /protected/open-question/questions/:id/toggle
pub async fn toggle_question(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    question_id: web::Path<i32>,
    body: web::Json<ToggleQuestionRequest>,
) -> Result<HttpResponse, Error> {
    let user_id = extract_user_id(&req)?;
    let question_id = question_id.into_inner();
    
    // Verificar ownership e senha
    let check_row = sqlx::query(
        "SELECT g.user_id, g.presenter_password, q.game_id, q.is_open 
         FROM open_question_questions q 
         JOIN open_question_games g ON q.game_id = g.id 
         WHERE q.id = $1"
    )
    .bind(question_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let check_row = check_row.ok_or_else(|| {
        actix_web::error::ErrorNotFound("Question not found")
    })?;
    
    let owner_id: i32 = check_row.get("user_id");
    let stored_password: String = check_row.get("presenter_password");
    let game_id: i32 = check_row.get("game_id");
    let is_open: bool = check_row.get("is_open");
    
    if owner_id != user_id {
        return Ok(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You don't have permission to modify this question"
        })));
    }
    
    if stored_password != body.presenter_password {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid presenter password"
        })));
    }
    
    let new_is_open = !is_open;
    
    // Se estiver abrindo esta pergunta, fechar todas as outras do mesmo jogo
    if new_is_open {
        sqlx::query(
            "UPDATE open_question_questions SET is_open = false WHERE game_id = $1 AND id != $2"
        )
        .bind(game_id)
        .bind(question_id)
        .execute(pool.as_ref())
        .await
        .map_err(|e| {
            log::error!("Database error closing other questions: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to close other questions")
        })?;
    }
    
    // Alternar o estado da pergunta atual
    sqlx::query(
        "UPDATE open_question_questions SET is_open = $1 WHERE id = $2"
    )
    .bind(new_is_open)
    .bind(question_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error toggling question: {}", e);
        actix_web::error::ErrorInternalServerError("Failed to toggle question")
    })?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "is_open": new_is_open
    })))
}

// POST /open-question/games/:id/respond
pub async fn submit_response(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    body: web::Json<SubmitResponseRequest>,
) -> Result<HttpResponse, Error> {
    let game_id = game_id.into_inner();
    
    // Verificar senha do jogo
    let password_row = sqlx::query(
        "SELECT game_password FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let password_row = password_row.ok_or_else(|| {
        actix_web::error::ErrorNotFound("Game not found")
    })?;
    
    let stored_password: String = password_row.get("game_password");
    
    if stored_password != body.game_password {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Senha inválida"
        })));
    }
    
    // Buscar a pergunta que está aberta
    let open_question_row = sqlx::query(
        "SELECT id FROM open_question_questions WHERE game_id = $1 AND is_open = true LIMIT 1"
    )
    .bind(game_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let open_question_row = open_question_row.ok_or_else(|| {
        actix_web::error::ErrorBadRequest("No question is currently open for responses")
    })?;
    
    let open_question_id: i32 = open_question_row.get("id");
    
    // Inserir resposta
    let response_row = sqlx::query(
        "INSERT INTO open_question_responses (question_id, response_text, player_name, room_name) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, question_id, response_text, player_name, room_name, created_at"
    )
    .bind(open_question_id)
    .bind(&body.response_text)
    .bind(&body.player_name)
    .bind(&body.room_name)
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error submitting response: {}", e);
        actix_web::error::ErrorInternalServerError("Failed to submit response")
    })?;
    
    let response = ResponseData {
        id: response_row.get("id"),
        question_id: response_row.get("question_id"),
        response_text: response_row.get("response_text"),
        player_name: response_row.get("player_name"),
        room_name: response_row.get("room_name"),
        created_at: response_row.get("created_at"),
    };
    
    Ok(HttpResponse::Ok().json(response))
}

// GET /open-question/questions/:id/responses-public (sem JWT, apenas senha)
pub async fn get_question_responses_public(
    pool: web::Data<PgPool>,
    question_id: web::Path<i32>,
    query: web::Query<ValidatePresenterPasswordRequest>,
) -> Result<HttpResponse, Error> {
    let question_id = question_id.into_inner();
    
    // Verificar senha do apresentador
    let check_row = sqlx::query(
        "SELECT g.presenter_password 
         FROM open_question_questions q 
         JOIN open_question_games g ON q.game_id = g.id 
         WHERE q.id = $1"
    )
    .bind(question_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let check_row = check_row.ok_or_else(|| {
        actix_web::error::ErrorNotFound("Question not found")
    })?;
    
    let stored_password: String = check_row.get("presenter_password");
    
    if stored_password != query.presenter_password {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid presenter password"
        })));
    }
    
    // Buscar respostas
    let response_rows = sqlx::query(
        "SELECT id, question_id, response_text, player_name, room_name, created_at 
         FROM open_question_responses 
         WHERE question_id = $1 
         ORDER BY created_at ASC"
    )
    .bind(question_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let responses: Vec<ResponseData> = response_rows.iter().map(|row| {
        ResponseData {
            id: row.get("id"),
            question_id: row.get("question_id"),
            response_text: row.get("response_text"),
            player_name: row.get("player_name"),
            room_name: row.get("room_name"),
            created_at: row.get("created_at"),
        }
    }).collect();
    
    Ok(HttpResponse::Ok().json(responses))
}

// GET /protected/open-question/questions/:id/responses
pub async fn get_question_responses(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    question_id: web::Path<i32>,
) -> Result<HttpResponse, Error> {
    let user_id = extract_user_id(&req)?;
    let question_id = question_id.into_inner();
    
    // Verificar ownership
    let check_row = sqlx::query(
        "SELECT g.user_id 
         FROM open_question_questions q 
         JOIN open_question_games g ON q.game_id = g.id 
         WHERE q.id = $1"
    )
    .bind(question_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let check_row = check_row.ok_or_else(|| {
        actix_web::error::ErrorNotFound("Question not found")
    })?;
    
    let owner_id: i32 = check_row.get("user_id");
    
    if owner_id != user_id {
        return Ok(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You don't have permission to view these responses"
        })));
    }
    
    // Buscar respostas
    let response_rows = sqlx::query(
        "SELECT id, question_id, response_text, player_name, room_name, created_at 
         FROM open_question_responses 
         WHERE question_id = $1 
         ORDER BY created_at ASC"
    )
    .bind(question_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let responses: Vec<ResponseData> = response_rows.iter().map(|row| {
        ResponseData {
            id: row.get("id"),
            question_id: row.get("question_id"),
            response_text: row.get("response_text"),
            player_name: row.get("player_name"),
            room_name: row.get("room_name"),
            created_at: row.get("created_at"),
        }
    }).collect();
    
    Ok(HttpResponse::Ok().json(responses))
}

// GET /protected/open-question/games/:id/edit (protegido - para edição)
pub async fn get_game_for_edit(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> Result<HttpResponse, Error> {
    let game_id = game_id.into_inner();
    
    // Extrair user_id do token JWT
    let user_id = match req.extensions().get::<i32>() {
        Some(id) => *id,
        None => return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        }))),
    };
    
    // Verificar se o usuário é o dono do jogo
    let owner_check = sqlx::query(
        "SELECT user_id FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let owner_check = owner_check.ok_or_else(|| {
        actix_web::error::ErrorNotFound("Game not found")
    })?;
    
    let owner_id: i32 = owner_check.get("user_id");
    if owner_id != user_id {
        return Ok(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You don't have permission to edit this game"
        })));
    }
    
    // Buscar jogo com senhas
    let game_row = sqlx::query(
        "SELECT id, title, description, game_password, presenter_password, created_at, updated_at 
         FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    // Buscar perguntas
    let question_rows = sqlx::query(
        "SELECT id, game_id, question_text, order_index, is_open, created_at 
         FROM open_question_questions 
         WHERE game_id = $1 
         ORDER BY order_index ASC"
    )
    .bind(game_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let questions: Vec<QuestionResponse> = question_rows.iter().map(|row| {
        QuestionResponse {
            id: row.get("id"),
            game_id: row.get("game_id"),
            question_text: row.get("question_text"),
            order_index: row.get("order_index"),
            is_open: row.get("is_open"),
            created_at: row.get("created_at"),
        }
    }).collect();
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "id": game_row.get::<i32, _>("id"),
        "title": game_row.get::<String, _>("title"),
        "description": game_row.get::<Option<String>, _>("description"),
        "game_password": game_row.get::<String, _>("game_password"),
        "presenter_password": game_row.get::<String, _>("presenter_password"),
        "questions": questions,
        "created_at": game_row.get::<NaiveDateTime, _>("created_at"),
        "updated_at": game_row.get::<NaiveDateTime, _>("updated_at"),
    })))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateGameRequest {
    pub title: String,
    pub description: Option<String>,
    pub game_password: String,
    pub presenter_password: String,
    pub questions: Vec<UpdateQuestionRequest>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateQuestionRequest {
    pub question_text: String,
}

// PUT /protected/open-question/games/:id (protegido - atualizar jogo)
pub async fn update_game(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    body: web::Json<UpdateGameRequest>,
) -> Result<HttpResponse, Error> {
    let game_id = game_id.into_inner();
    
    // Extrair user_id do token JWT
    let user_id = match req.extensions().get::<i32>() {
        Some(id) => *id,
        None => return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        }))),
    };
    
    // Verificar se o usuário é o dono do jogo
    let owner_check = sqlx::query(
        "SELECT user_id FROM open_question_games WHERE id = $1"
    )
    .bind(game_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    let owner_check = owner_check.ok_or_else(|| {
        actix_web::error::ErrorNotFound("Game not found")
    })?;
    
    let owner_id: i32 = owner_check.get("user_id");
    if owner_id != user_id {
        return Ok(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You don't have permission to edit this game"
        })));
    }
    
    // Validações
    if body.title.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Title is required"
        })));
    }
    
    if body.game_password.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Game password is required"
        })));
    }
    
    if body.presenter_password.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Presenter password is required"
        })));
    }
    
    if body.questions.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "At least one question is required"
        })));
    }
    
    // Iniciar transação
    let mut tx = pool.begin().await.map_err(|e| {
        log::error!("Failed to start transaction: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    // Atualizar jogo
    sqlx::query(
        "UPDATE open_question_games 
         SET title = $1, description = $2, game_password = $3, presenter_password = $4, updated_at = NOW()
         WHERE id = $5"
    )
    .bind(&body.title)
    .bind(&body.description)
    .bind(&body.game_password)
    .bind(&body.presenter_password)
    .bind(game_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        log::error!("Failed to update game: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    // Deletar perguntas antigas
    sqlx::query("DELETE FROM open_question_questions WHERE game_id = $1")
        .bind(game_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            log::error!("Failed to delete old questions: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;
    
    // Inserir novas perguntas
    for (index, question) in body.questions.iter().enumerate() {
        if question.question_text.trim().is_empty() {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Question {} cannot be empty", index + 1)
            })));
        }
        
        sqlx::query(
            "INSERT INTO open_question_questions (game_id, question_text, order_index, is_open) 
             VALUES ($1, $2, $3, false)"
        )
        .bind(game_id)
        .bind(&question.question_text)
        .bind(index as i32)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            log::error!("Failed to insert question: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;
    }
    
    // Commit da transação
    tx.commit().await.map_err(|e| {
        log::error!("Failed to commit transaction: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Game updated successfully",
        "game_id": game_id
    })))
}

// DELETE /protected/open-question/games/:id - Excluir jogo
pub async fn delete_game(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> Result<HttpResponse, Error> {
    let game_id = game_id.into_inner();
    let user_id = match req.extensions().get::<i32>() {
        Some(id) => *id,
        None => return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        }))),
    };

    let result = sqlx::query(
        "DELETE FROM open_question_games WHERE id = $1 AND user_id = $2"
    )
    .bind(game_id)
    .bind(user_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Erro ao excluir jogo open_question: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;

    if result.rows_affected() == 0 {
        return Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Jogo não encontrado ou sem permissão"
        })));
    }

    Ok(HttpResponse::NoContent().finish())
}
