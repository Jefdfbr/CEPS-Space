use actix_web::{web, HttpResponse, HttpRequest, HttpMessage};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use bcrypt::{hash, verify, DEFAULT_COST};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateKahootGame {
    pub title: String,
    pub description: Option<String>,
    pub presenter_password: String,
    pub room_password: String,
    pub questions: Vec<CreateKahootQuestion>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateKahootQuestion {
    pub question_text: String,
    pub question_order: i32,
    #[serde(default)]
    pub time_limit: Option<i32>,
    #[serde(default)]
    pub points: Option<i32>,
    pub options: Vec<CreateKahootOption>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateKahootOption {
    pub option_text: String,
    pub option_order: i32,
    pub is_correct: bool,
    #[serde(default)]
    pub points: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JoinKahootGame {
    pub password: String,
    pub player_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JoinResponse {
    pub role: String,
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitAnswer {
    pub question_id: i32,
    pub option_id: i32,
    pub response_time: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdvanceQuestion {
    pub question_index: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateKahootGame {
    pub title: String,
    pub description: Option<String>,
    pub presenter_password: Option<String>, // vazio = manter atual
    pub room_password: Option<String>,      // vazio = manter atual
    pub questions: Vec<CreateKahootQuestion>,
}

#[derive(Debug, Serialize)]
pub struct KahootGame {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub current_question_index: i32,
    pub questions: Vec<KahootQuestion>,
}

#[derive(Debug, Serialize)]
pub struct KahootQuestion {
    pub id: i32,
    pub question_text: String,
    pub question_order: i32,
    pub time_limit: i32,
    pub points: i32,
    pub options: Vec<KahootOption>,
}

#[derive(Debug, Serialize)]
pub struct KahootOption {
    pub id: i32,
    pub option_text: String,
    pub option_order: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_correct: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct Player {
    pub session_id: String,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct Score {
    pub session_id: String,
    pub player_name: String,
    pub total_score: i32,
    pub correct_answers: i32,
}

fn extract_user_id(req: &HttpRequest) -> Option<i32> {
    req.extensions().get::<i32>().copied()
}

// POST /api/kahoot/games - Criar jogo
pub async fn create_game(
    pool: web::Data<PgPool>,
    game_data: web::Json<CreateKahootGame>,
    req: HttpRequest,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Usuário não autenticado"
        })),
    };

    // Hash das senhas
    let presenter_password_hash = match hash(&game_data.presenter_password, DEFAULT_COST) {
        Ok(h) => h,
        Err(e) => {
            log::error!("Erro ao criar hash da senha do apresentador: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao processar senha"
            }));
        }
    };

    let room_password_hash = match hash(&game_data.room_password, DEFAULT_COST) {
        Ok(h) => h,
        Err(e) => {
            log::error!("Erro ao criar hash da senha da sala: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao processar senha"
            }));
        }
    };

    // Iniciar transação
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            log::error!("Erro ao iniciar transação: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao criar jogo"
            }));
        }
    };

    // Inserir jogo
    let game_id = match sqlx::query(
        "INSERT INTO kahoot_games (user_id, title, description, presenter_password, room_password) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id"
    )
    .bind(user_id)
    .bind(&game_data.title)
    .bind(&game_data.description)
    .bind(&presenter_password_hash)
    .bind(&room_password_hash)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row.get::<i32, _>("id"),
        Err(e) => {
            log::error!("Erro ao inserir jogo: {}", e);
            let _ = tx.rollback().await;
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao criar jogo"
            }));
        }
    };

    // Inserir perguntas e opções
    for question in &game_data.questions {
        let question_id = match sqlx::query(
            "INSERT INTO kahoot_questions (game_id, question_text, question_order, time_limit, points) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id"
        )
        .bind(game_id)
        .bind(&question.question_text)
        .bind(question.question_order)
        .bind(question.time_limit.unwrap_or(30))
        .bind(question.points.unwrap_or(100))
        .fetch_one(&mut *tx)
        .await
        {
            Ok(row) => row.get::<i32, _>("id"),
            Err(e) => {
                log::error!("Erro ao inserir pergunta: {}", e);
                let _ = tx.rollback().await;
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Erro ao criar perguntas"
                }));
            }
        };

        for option in &question.options {
            if let Err(e) = sqlx::query(
                "INSERT INTO kahoot_options (question_id, option_text, option_order, is_correct) 
                 VALUES ($1, $2, $3, $4)"
            )
            .bind(question_id)
            .bind(&option.option_text)
            .bind(option.option_order)
            .bind(option.is_correct)
            .execute(&mut *tx)
            .await
            {
                log::error!("Erro ao inserir opção: {}", e);
                let _ = tx.rollback().await;
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Erro ao criar opções"
                }));
            }
        }
    }

    // Commit da transação
    if let Err(e) = tx.commit().await {
        log::error!("Erro ao fazer commit: {}", e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Erro ao salvar jogo"
        }));
    }

    HttpResponse::Ok().json(serde_json::json!({
        "id": game_id,
        "message": "Jogo criado com sucesso"
    }))
}

// GET /api/kahoot/games/:id - Buscar jogo
pub async fn get_game(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> HttpResponse {
    let game_id = game_id.into_inner();

    // Buscar jogo
    let game = match sqlx::query(
        "SELECT id, title, description, current_question_index 
         FROM kahoot_games 
         WHERE id = $1 AND is_active = true"
    )
    .bind(game_id)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => (
            row.get::<i32, _>("id"),
            row.get::<String, _>("title"),
            row.get::<Option<String>, _>("description"),
            row.get::<i32, _>("current_question_index"),
        ),
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Jogo não encontrado"
        })),
        Err(e) => {
            log::error!("Erro ao buscar jogo: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar jogo"
            }));
        }
    };

    // Buscar perguntas
    let question_rows = match sqlx::query(
        "SELECT id, question_text, question_order, time_limit, points 
         FROM kahoot_questions 
         WHERE game_id = $1 
         ORDER BY question_order"
    )
    .bind(game_id)
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            log::error!("Erro ao buscar perguntas: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar perguntas"
            }));
        }
    };

    let mut kahoot_questions = Vec::new();
    for question_row in question_rows {
        let question_id = question_row.get::<i32, _>("id");
        
        let option_rows = match sqlx::query(
            "SELECT id, option_text, option_order 
             FROM kahoot_options 
             WHERE question_id = $1 
             ORDER BY option_order"
        )
        .bind(question_id)
        .fetch_all(pool.get_ref())
        .await
        {
            Ok(rows) => rows,
            Err(e) => {
                log::error!("Erro ao buscar opções: {}", e);
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Erro ao buscar opções"
                }));
            }
        };

        let options: Vec<KahootOption> = option_rows.iter().map(|row| KahootOption {
            id: row.get("id"),
            option_text: row.get("option_text"),
            option_order: row.get("option_order"),
            is_correct: None,
        }).collect();

        kahoot_questions.push(KahootQuestion {
            id: question_id,
            question_text: question_row.get("question_text"),
            question_order: question_row.get("question_order"),
            time_limit: question_row.get("time_limit"),
            points: question_row.get("points"),
            options,
        });
    }

    HttpResponse::Ok().json(KahootGame {
        id: game.0,
        title: game.1,
        description: game.2,
        current_question_index: game.3,
        questions: kahoot_questions,
    })
}

// POST /api/kahoot/games/:id/join - Entrar no jogo
pub async fn join_game(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    join_data: web::Json<JoinKahootGame>,
) -> HttpResponse {
    let game_id = game_id.into_inner();

    // Buscar jogo com senhas
    let game = match sqlx::query(
        "SELECT presenter_password, room_password FROM kahoot_games WHERE id = $1 AND is_active = true"
    )
    .bind(game_id)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => (
            row.get::<String, _>("presenter_password"),
            row.get::<String, _>("room_password"),
        ),
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Jogo não encontrado"
        })),
        Err(e) => {
            log::error!("Erro ao buscar jogo: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar jogo"
            }));
        }
    };

    // Verificar se é apresentador ou jogador
    let is_presenter = verify(&join_data.password, &game.0).unwrap_or(false);
    let is_player = verify(&join_data.password, &game.1).unwrap_or(false);

    if !is_presenter && !is_player {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Senha incorreta"
        }));
    }

    // Gerar session_id
    let session_id = uuid::Uuid::new_v4().to_string();

    let role = if is_presenter {
        "presenter"
    } else {
        "player"
    };

    HttpResponse::Ok().json(JoinResponse {
        role: role.to_string(),
        session_id,
    })
}

// GET /api/kahoot/games/:id/players - Listar jogadores
pub async fn get_players(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> HttpResponse {
    let game_id = game_id.into_inner();

    let player_rows = match sqlx::query(
        "SELECT DISTINCT session_id, player_name 
         FROM kahoot_answers 
         WHERE game_id = $1 
         ORDER BY player_name"
    )
    .bind(game_id)
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            log::error!("Erro ao buscar jogadores: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar jogadores"
            }));
        }
    };

    let player_list: Vec<Player> = player_rows.iter().map(|row| Player {
        session_id: row.get("session_id"),
        username: row.get("player_name"),
    }).collect();

    HttpResponse::Ok().json(player_list)
}

// GET /api/kahoot/games/:game_id/questions/:index - Buscar pergunta específica
pub async fn get_question(
    pool: web::Data<PgPool>,
    path: web::Path<(i32, i32)>,
) -> HttpResponse {
    let (game_id, question_index) = path.into_inner();

    let question = match sqlx::query(
        "SELECT id, question_text, question_order, time_limit, points 
         FROM kahoot_questions 
         WHERE game_id = $1 AND question_order = $2"
    )
    .bind(game_id)
    .bind(question_index)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => (
            row.get::<i32, _>("id"),
            row.get::<String, _>("question_text"),
            row.get::<i32, _>("question_order"),
            row.get::<i32, _>("time_limit"),
            row.get::<i32, _>("points"),
        ),
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Pergunta não encontrada"
        })),
        Err(e) => {
            log::error!("Erro ao buscar pergunta: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar pergunta"
            }));
        }
    };

    let option_rows = match sqlx::query(
        "SELECT id, option_text, option_order 
         FROM kahoot_options 
         WHERE question_id = $1 
         ORDER BY option_order"
    )
    .bind(question.0)
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            log::error!("Erro ao buscar opções: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar opções"
            }));
        }
    };

    let options: Vec<KahootOption> = option_rows.iter().map(|row| KahootOption {
        id: row.get("id"),
        option_text: row.get("option_text"),
        option_order: row.get("option_order"),
        is_correct: None,
    }).collect();

    HttpResponse::Ok().json(KahootQuestion {
        id: question.0,
        question_text: question.1,
        question_order: question.2,
        time_limit: question.3,
        points: question.4,
        options,
    })
}

// POST /api/kahoot/games/:id/answer - Enviar resposta
pub async fn submit_answer(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    answer_data: web::Json<SubmitAnswer>,
    req: HttpRequest,
) -> HttpResponse {
    let game_id = game_id.into_inner();

    let session_id = match req.headers().get("X-Session-Id") {
        Some(header_value) => match header_value.to_str() {
            Ok(s) => s.to_string(),
            Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Session ID inválido"
            })),
        },
        None => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Session ID não fornecido"
        })),
    };

    let player_name = req.headers()
        .get("X-Player-Name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("Anônimo")
        .to_string();

    // Verificar se a opção existe e se está correta
    let option = match sqlx::query(
        "SELECT is_correct FROM kahoot_options WHERE id = $1 AND question_id = $2"
    )
    .bind(answer_data.option_id)
    .bind(answer_data.question_id)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => row.get::<bool, _>("is_correct"),
        Ok(None) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Opção inválida"
        })),
        Err(e) => {
            log::error!("Erro ao verificar opção: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao processar resposta"
            }));
        }
    };

    // Buscar pontos da pergunta
    let question = match sqlx::query(
        "SELECT points, time_limit FROM kahoot_questions WHERE id = $1"
    )
    .bind(answer_data.question_id)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => (
            row.get::<i32, _>("points"),
            row.get::<i32, _>("time_limit"),
        ),
        Ok(None) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Pergunta inválida"
        })),
        Err(e) => {
            log::error!("Erro ao buscar pergunta: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao processar resposta"
            }));
        }
    };

    // Calcular pontuação
    let score = if option {
        let time_factor = 1.0 - (answer_data.response_time as f32 / question.1 as f32) * 0.5;
        (question.0 as f32 * time_factor.max(0.5)) as i32
    } else {
        0
    };

    // Inserir resposta
    if let Err(e) = sqlx::query(
        "INSERT INTO kahoot_answers (game_id, question_id, session_id, player_name, selected_option_id, response_time) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (game_id, question_id, session_id) DO NOTHING"
    )
    .bind(game_id)
    .bind(answer_data.question_id)
    .bind(&session_id)
    .bind(&player_name)
    .bind(answer_data.option_id)
    .bind(answer_data.response_time)
    .execute(pool.get_ref())
    .await
    {
        log::error!("Erro ao inserir resposta: {}", e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Erro ao salvar resposta"
        }));
    }

    // Atualizar pontuação
    if option {
        let _ = sqlx::query(
            "INSERT INTO kahoot_scores (game_id, session_id, player_name, total_score, correct_answers) 
             VALUES ($1, $2, $3, $4, 1)
             ON CONFLICT (game_id, session_id) 
             DO UPDATE SET 
                total_score = kahoot_scores.total_score + $4,
                correct_answers = kahoot_scores.correct_answers + 1"
        )
        .bind(game_id)
        .bind(&session_id)
        .bind(&player_name)
        .bind(score)
        .execute(pool.get_ref())
        .await;
    }

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "is_correct": option,
        "score": score
    }))
}

// POST /api/kahoot/games/:id/advance - Avançar pergunta
pub async fn advance_question(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    advance_data: web::Json<AdvanceQuestion>,
) -> HttpResponse {
    let game_id = game_id.into_inner();

    if let Err(e) = sqlx::query(
        "UPDATE kahoot_games SET current_question_index = $1, updated_at = NOW() WHERE id = $2"
    )
    .bind(advance_data.question_index)
    .bind(game_id)
    .execute(pool.get_ref())
    .await
    {
        log::error!("Erro ao avançar pergunta: {}", e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Erro ao avançar pergunta"
        }));
    }

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "current_question_index": advance_data.question_index
    }))
}

// POST /api/kahoot/games/:id/finish - Finalizar jogo
pub async fn finish_game(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> HttpResponse {
    let game_id = game_id.into_inner();

    if let Err(e) = sqlx::query(
        "UPDATE kahoot_games SET is_active = false, updated_at = NOW() WHERE id = $1"
    )
    .bind(game_id)
    .execute(pool.get_ref())
    .await
    {
        log::error!("Erro ao finalizar jogo: {}", e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Erro ao finalizar jogo"
        }));
    }

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "Jogo finalizado"
    }))
}

// DELETE /api/protected/kahoot/games/:id - Excluir jogo
pub async fn delete_game(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    req: HttpRequest,
) -> HttpResponse {
    let game_id = game_id.into_inner();
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Usuário não autenticado"
        })),
    };

    let result = sqlx::query(
        "DELETE FROM kahoot_games WHERE id = $1 AND user_id = $2"
    )
    .bind(game_id)
    .bind(user_id)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(r) => {
            if r.rows_affected() == 0 {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Jogo não encontrado ou sem permissão"
                }))
            } else {
                HttpResponse::NoContent().finish()
            }
        }
        Err(e) => {
            log::error!("Erro ao excluir jogo kahoot: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao excluir jogo"
            }))
        }
    }
}

// GET /api/protected/kahoot/games/:id/edit - Carregar jogo para edição (com is_correct visível)
pub async fn get_game_for_edit(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    req: HttpRequest,
) -> HttpResponse {
    let game_id = game_id.into_inner();
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Usuário não autenticado"
        })),
    };

    let game_row = match sqlx::query(
        "SELECT id, title, description, current_question_index FROM kahoot_games WHERE id = $1 AND user_id = $2"
    )
    .bind(game_id)
    .bind(user_id)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Jogo não encontrado ou sem permissão"
        })),
        Err(e) => {
            log::error!("Erro ao buscar jogo para edição: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar jogo"
            }));
        }
    };

    let question_rows = match sqlx::query(
        "SELECT id, question_text, question_order, time_limit, points FROM kahoot_questions WHERE game_id = $1 ORDER BY question_order"
    )
    .bind(game_id)
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            log::error!("Erro ao buscar perguntas: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar perguntas"
            }));
        }
    };

    let mut questions_json = Vec::new();
    for q_row in &question_rows {
        let q_id = q_row.get::<i32, _>("id");
        let option_rows = match sqlx::query(
            "SELECT id, option_text, option_order, is_correct FROM kahoot_options WHERE question_id = $1 ORDER BY option_order"
        )
        .bind(q_id)
        .fetch_all(pool.get_ref())
        .await
        {
            Ok(rows) => rows,
            Err(e) => {
                log::error!("Erro ao buscar opções: {}", e);
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Erro ao buscar opções"
                }));
            }
        };

        let options: Vec<serde_json::Value> = option_rows.iter().map(|o| {
            serde_json::json!({
                "id": o.get::<i32, _>("id"),
                "option_text": o.get::<String, _>("option_text"),
                "option_order": o.get::<i32, _>("option_order"),
                "is_correct": o.get::<bool, _>("is_correct"),
            })
        }).collect();

        questions_json.push(serde_json::json!({
            "id": q_id,
            "question_text": q_row.get::<String, _>("question_text"),
            "question_order": q_row.get::<i32, _>("question_order"),
            "time_limit": q_row.get::<i32, _>("time_limit"),
            "points": q_row.get::<i32, _>("points"),
            "options": options,
        }));
    }

    HttpResponse::Ok().json(serde_json::json!({
        "id": game_row.get::<i32, _>("id"),
        "title": game_row.get::<String, _>("title"),
        "description": game_row.get::<Option<String>, _>("description"),
        "current_question_index": game_row.get::<i32, _>("current_question_index"),
        "questions": questions_json,
    }))
}

// PUT /api/protected/kahoot/games/:id - Atualizar jogo
pub async fn update_game(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    game_data: web::Json<UpdateKahootGame>,
    req: HttpRequest,
) -> HttpResponse {
    let game_id = game_id.into_inner();
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Usuário não autenticado"
        })),
    };

    // Verificar propriedade
    let exists = match sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM kahoot_games WHERE id = $1 AND user_id = $2"
    )
    .bind(game_id)
    .bind(user_id)
    .fetch_one(pool.get_ref())
    .await
    {
        Ok(n) => n,
        Err(e) => {
            log::error!("Erro ao verificar jogo: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Erro ao verificar jogo"}));
        }
    };

    if exists == 0 {
        return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Jogo não encontrado ou sem permissão"
        }));
    }

    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            log::error!("Erro ao iniciar transação: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Erro ao atualizar jogo"}));
        }
    };

    // Atualizar campos básicos
    if let Err(e) = sqlx::query(
        "UPDATE kahoot_games SET title = $1, description = $2, updated_at = NOW() WHERE id = $3"
    )
    .bind(&game_data.title)
    .bind(&game_data.description)
    .bind(game_id)
    .execute(&mut *tx)
    .await
    {
        log::error!("Erro ao atualizar jogo: {}", e);
        let _ = tx.rollback().await;
        return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Erro ao atualizar jogo"}));
    }

    // Atualizar senha do apresentador se fornecida
    if let Some(pass) = &game_data.presenter_password {
        if !pass.is_empty() {
            match hash(pass, DEFAULT_COST) {
                Ok(h) => {
                    if let Err(e) = sqlx::query(
                        "UPDATE kahoot_games SET presenter_password = $1 WHERE id = $2"
                    )
                    .bind(&h)
                    .bind(game_id)
                    .execute(&mut *tx)
                    .await
                    {
                        log::error!("Erro ao atualizar senha apresentador: {}", e);
                        let _ = tx.rollback().await;
                        return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Erro ao atualizar senha"}));
                    }
                }
                Err(e) => {
                    log::error!("Erro ao criar hash: {}", e);
                    let _ = tx.rollback().await;
                    return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Erro ao processar senha"}));
                }
            }
        }
    }

    // Atualizar senha dos jogadores se fornecida
    if let Some(pass) = &game_data.room_password {
        if !pass.is_empty() {
            match hash(pass, DEFAULT_COST) {
                Ok(h) => {
                    if let Err(e) = sqlx::query(
                        "UPDATE kahoot_games SET room_password = $1 WHERE id = $2"
                    )
                    .bind(&h)
                    .bind(game_id)
                    .execute(&mut *tx)
                    .await
                    {
                        log::error!("Erro ao atualizar senha sala: {}", e);
                        let _ = tx.rollback().await;
                        return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Erro ao atualizar senha"}));
                    }
                }
                Err(e) => {
                    log::error!("Erro ao criar hash: {}", e);
                    let _ = tx.rollback().await;
                    return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Erro ao processar senha"}));
                }
            }
        }
    }

    // Deletar perguntas e opções antigas (cascade)
    if let Err(e) = sqlx::query("DELETE FROM kahoot_questions WHERE game_id = $1")
        .bind(game_id)
        .execute(&mut *tx)
        .await
    {
        log::error!("Erro ao deletar perguntas antigas: {}", e);
        let _ = tx.rollback().await;
        return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Erro ao atualizar perguntas"}));
    }

    // Re-inserir perguntas e opções
    for question in &game_data.questions {
        let question_id = match sqlx::query(
            "INSERT INTO kahoot_questions (game_id, question_text, question_order, time_limit, points) VALUES ($1, $2, $3, $4, $5) RETURNING id"
        )
        .bind(game_id)
        .bind(&question.question_text)
        .bind(question.question_order)
        .bind(question.time_limit.unwrap_or(30))
        .bind(question.points.unwrap_or(100))
        .fetch_one(&mut *tx)
        .await
        {
            Ok(row) => row.get::<i32, _>("id"),
            Err(e) => {
                log::error!("Erro ao inserir pergunta: {}", e);
                let _ = tx.rollback().await;
                return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Erro ao salvar perguntas"}));
            }
        };

        for option in &question.options {
            if let Err(e) = sqlx::query(
                "INSERT INTO kahoot_options (question_id, option_text, option_order, is_correct) VALUES ($1, $2, $3, $4)"
            )
            .bind(question_id)
            .bind(&option.option_text)
            .bind(option.option_order)
            .bind(option.is_correct)
            .execute(&mut *tx)
            .await
            {
                log::error!("Erro ao inserir opção: {}", e);
                let _ = tx.rollback().await;
                return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Erro ao salvar opções"}));
            }
        }
    }

    if let Err(e) = tx.commit().await {
        log::error!("Erro ao fazer commit: {}", e);
        return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Erro ao salvar jogo"}));
    }

    HttpResponse::Ok().json(serde_json::json!({
        "id": game_id,
        "message": "Jogo atualizado com sucesso"
    }))
}

// GET /api/kahoot/games/:id/results - Buscar resultados
pub async fn get_results(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> HttpResponse {
    let game_id = game_id.into_inner();

    let score_rows = match sqlx::query(
        "SELECT session_id, player_name, total_score, correct_answers 
         FROM kahoot_scores 
         WHERE game_id = $1 
         ORDER BY total_score DESC, correct_answers DESC"
    )
    .bind(game_id)
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            log::error!("Erro ao buscar resultados: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar resultados"
            }));
        }
    };

    let scores: Vec<Score> = score_rows.iter().map(|row| Score {
        session_id: row.get("session_id"),
        player_name: row.get("player_name"),
        total_score: row.get("total_score"),
        correct_answers: row.get("correct_answers"),
    }).collect();

    HttpResponse::Ok().json(scores)
}
