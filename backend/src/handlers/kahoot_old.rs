use actix_web::{web, HttpResponse, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
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
    pub time_limit: i32,
    pub points: i32,
    pub options: Vec<CreateKahootOption>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateKahootOption {
    pub option_text: String,
    pub option_order: i32,
    pub is_correct: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JoinKahootGame {
    pub password: String,
    pub player_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JoinResponse {
    pub role: String, // "presenter" ou "player"
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

// POST /api/kahoot/games - Criar jogo
pub async fn create_game(
    pool: web::Data<PgPool>,
    game_data: web::Json<CreateKahootGame>,
    req: HttpRequest,
) -> HttpResponse {
    // Verificar autenticação
    let token = match req.headers().get("Authorization") {
        Some(header_value) => match header_value.to_str() {
            Ok(token_str) => token_str.replace("Bearer ", ""),
            Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Token inválido"
            })),
        },
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Token não fornecido"
        })),
    };

    // Buscar usuário pelo token
    let user = match sqlx::query!(
        "SELECT id FROM users WHERE token = $1",
        token
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(user)) => user,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Usuário não encontrado"
        })),
        Err(e) => {
            log::error!("Erro ao buscar usuário: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar usuário"
            }));
        }
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
    let game_id = match sqlx::query!(
        "INSERT INTO kahoot_games (user_id, title, description, presenter_password, room_password) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id",
        user.id,
        game_data.title,
        game_data.description,
        presenter_password_hash,
        room_password_hash
    )
    .fetch_one(&mut *tx)
    .await
    {
        Ok(record) => record.id,
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
        let question_id = match sqlx::query!(
            "INSERT INTO kahoot_questions (game_id, question_text, question_order, time_limit, points) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id",
            game_id,
            question.question_text,
            question.question_order,
            question.time_limit,
            question.points
        )
        .fetch_one(&mut *tx)
        .await
        {
            Ok(record) => record.id,
            Err(e) => {
                log::error!("Erro ao inserir pergunta: {}", e);
                let _ = tx.rollback().await;
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Erro ao criar perguntas"
                }));
            }
        };

        for option in &question.options {
            if let Err(e) = sqlx::query!(
                "INSERT INTO kahoot_options (question_id, option_text, option_order, is_correct) 
                 VALUES ($1, $2, $3, $4)",
                question_id,
                option.option_text,
                option.option_order,
                option.is_correct
            )
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
    let game = match sqlx::query!(
        "SELECT id, title, description, current_question_index 
         FROM kahoot_games 
         WHERE id = $1 AND is_active = true",
        game_id
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(game)) => game,
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

    // Buscar perguntas (sem mostrar respostas corretas para jogadores)
    let questions = match sqlx::query!(
        "SELECT id, question_text, question_order, time_limit, points 
         FROM kahoot_questions 
         WHERE game_id = $1 
         ORDER BY question_order",
        game_id
    )
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(questions) => questions,
        Err(e) => {
            log::error!("Erro ao buscar perguntas: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar perguntas"
            }));
        }
    };

    let mut kahoot_questions = Vec::new();
    for question in questions {
        let options = match sqlx::query!(
            "SELECT id, option_text, option_order 
             FROM kahoot_options 
             WHERE question_id = $1 
             ORDER BY option_order",
            question.id
        )
        .fetch_all(pool.get_ref())
        .await
        {
            Ok(options) => options,
            Err(e) => {
                log::error!("Erro ao buscar opções: {}", e);
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Erro ao buscar opções"
                }));
            }
        };

        kahoot_questions.push(KahootQuestion {
            id: question.id,
            question_text: question.question_text,
            question_order: question.question_order,
            time_limit: question.time_limit,
            points: question.points,
            options: options.iter().map(|opt| KahootOption {
                id: opt.id,
                option_text: opt.option_text.clone(),
                option_order: opt.option_order,
                is_correct: None, // Não revelar resposta correta
            }).collect(),
        });
    }

    HttpResponse::Ok().json(KahootGame {
        id: game.id,
        title: game.title,
        description: game.description,
        current_question_index: game.current_question_index,
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
    let game = match sqlx::query!(
        "SELECT presenter_password, room_password FROM kahoot_games WHERE id = $1 AND is_active = true",
        game_id
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(game)) => game,
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
    let is_presenter = verify(&join_data.password, &game.presenter_password).unwrap_or(false);
    let is_player = verify(&join_data.password, &game.room_password).unwrap_or(false);

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

// GET /api/kahoot/games/:id/players - Listar jogadores (apenas para apresentador)
pub async fn get_players(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> HttpResponse {
    let game_id = game_id.into_inner();

    // Buscar jogadores que já responderam
    let players = match sqlx::query!(
        "SELECT DISTINCT session_id, player_name 
         FROM kahoot_answers 
         WHERE game_id = $1 
         ORDER BY player_name",
        game_id
    )
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(players) => players,
        Err(e) => {
            log::error!("Erro ao buscar jogadores: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar jogadores"
            }));
        }
    };

    let player_list: Vec<Player> = players.iter().map(|p| Player {
        session_id: p.session_id.clone(),
        username: p.player_name.clone(),
    }).collect();

    HttpResponse::Ok().json(player_list)
}

// GET /api/kahoot/games/:id/questions/:index - Buscar pergunta específica
pub async fn get_question(
    pool: web::Data<PgPool>,
    path: web::Path<(i32, i32)>,
) -> HttpResponse {
    let (game_id, question_index) = path.into_inner();

    // Buscar pergunta
    let question = match sqlx::query!(
        "SELECT id, question_text, question_order, time_limit, points 
         FROM kahoot_questions 
         WHERE game_id = $1 AND question_order = $2",
        game_id,
        question_index
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(q)) => q,
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

    // Buscar opções
    let options = match sqlx::query!(
        "SELECT id, option_text, option_order 
         FROM kahoot_options 
         WHERE question_id = $1 
         ORDER BY option_order",
        question.id
    )
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(options) => options,
        Err(e) => {
            log::error!("Erro ao buscar opções: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar opções"
            }));
        }
    };

    HttpResponse::Ok().json(KahootQuestion {
        id: question.id,
        question_text: question.question_text,
        question_order: question.question_order,
        time_limit: question.time_limit,
        points: question.points,
        options: options.iter().map(|opt| KahootOption {
            id: opt.id,
            option_text: opt.option_text.clone(),
            option_order: opt.option_order,
            is_correct: None,
        }).collect(),
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

    // Obter session_id do header
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

    // Buscar player_name do localStorage (deveria vir no body)
    let player_name = req.headers()
        .get("X-Player-Name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("Anônimo")
        .to_string();

    // Verificar se a opção existe e se está correta
    let option = match sqlx::query!(
        "SELECT is_correct FROM kahoot_options WHERE id = $1 AND question_id = $2",
        answer_data.option_id,
        answer_data.question_id
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(opt)) => opt,
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
    let question = match sqlx::query!(
        "SELECT points, time_limit FROM kahoot_questions WHERE id = $1",
        answer_data.question_id
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(q)) => q,
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

    // Calcular pontuação (baseado em velocidade e acerto)
    let score = if option.is_correct {
        let time_factor = 1.0 - (answer_data.response_time as f32 / question.time_limit as f32) * 0.5;
        (question.points as f32 * time_factor.max(0.5)) as i32
    } else {
        0
    };

    // Inserir resposta
    if let Err(e) = sqlx::query!(
        "INSERT INTO kahoot_answers (game_id, question_id, session_id, player_name, selected_option_id, response_time) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (game_id, question_id, session_id) DO NOTHING",
        game_id,
        answer_data.question_id,
        session_id,
        player_name,
        answer_data.option_id,
        answer_data.response_time
    )
    .execute(pool.get_ref())
    .await
    {
        log::error!("Erro ao inserir resposta: {}", e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Erro ao salvar resposta"
        }));
    }

    // Atualizar pontuação do jogador
    if option.is_correct {
        let _ = sqlx::query!(
            "INSERT INTO kahoot_scores (game_id, session_id, player_name, total_score, correct_answers) 
             VALUES ($1, $2, $3, $4, 1)
             ON CONFLICT (game_id, session_id) 
             DO UPDATE SET 
                total_score = kahoot_scores.total_score + $4,
                correct_answers = kahoot_scores.correct_answers + 1",
            game_id,
            session_id,
            player_name,
            score
        )
        .execute(pool.get_ref())
        .await;
    }

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "is_correct": option.is_correct,
        "score": score
    }))
}

// POST /api/kahoot/games/:id/advance - Avançar pergunta (apenas apresentador)
pub async fn advance_question(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    advance_data: web::Json<AdvanceQuestion>,
) -> HttpResponse {
    let game_id = game_id.into_inner();

    // Atualizar índice da pergunta atual
    if let Err(e) = sqlx::query!(
        "UPDATE kahoot_games SET current_question_index = $1, updated_at = NOW() WHERE id = $2",
        advance_data.question_index,
        game_id
    )
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

    // Marcar jogo como inativo
    if let Err(e) = sqlx::query!(
        "UPDATE kahoot_games SET is_active = false, updated_at = NOW() WHERE id = $1",
        game_id
    )
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

// GET /api/kahoot/games/:id/results - Buscar resultados finais
pub async fn get_results(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> HttpResponse {
    let game_id = game_id.into_inner();

    // Buscar pontuações
    let scores = match sqlx::query!(
        "SELECT session_id, player_name, total_score, correct_answers 
         FROM kahoot_scores 
         WHERE game_id = $1 
         ORDER BY total_score DESC, correct_answers DESC",
        game_id
    )
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(scores) => scores,
        Err(e) => {
            log::error!("Erro ao buscar resultados: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Erro ao buscar resultados"
            }));
        }
    };

    HttpResponse::Ok().json(scores)
}
