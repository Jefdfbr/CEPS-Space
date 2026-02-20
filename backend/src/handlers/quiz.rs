use actix_web::{web, HttpResponse, HttpRequest, HttpMessage};
use sqlx::PgPool;
use validator::Validate;
use serde::{Deserialize, Serialize};

use crate::models::{
    QuizConfig, QuizQuestion, ErrorResponse, Game,
};

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateQuizConfigRequest {
    pub game_id: i32,
    pub time_limit: Option<i32>,
    pub passing_score: Option<i32>,
    pub end_screen_text: Option<String>,
    pub end_screen_button_text: Option<String>,
    pub end_screen_button_url: Option<String>,
    pub end_screen_button_new_tab: Option<bool>,
    pub min_players: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateQuestionRequest {
    #[validate(length(min = 5, max = 500))]
    pub question_text: String,
    #[validate(length(min = 4, max = 4))]
    pub options: Vec<String>,
    #[validate(range(min = 0, max = 3))]
    pub correct_answer: i32,
    pub points: Option<i32>,
    pub order_number: Option<i32>,
    pub justification: Option<String>,
}

pub async fn create_quiz_config(
    pool: web::Data<PgPool>,
    body: web::Json<CreateQuizConfigRequest>,
    req: HttpRequest,
) -> HttpResponse {
    if let Err(e) = body.validate() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: format!("Validation error: {}", e),
        });
    }

    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    // Verify game exists and belongs to user
    let game = match sqlx::query_as::<_, Game>(
        "SELECT * FROM games WHERE id = $1 AND created_by = $2"
    )
    .bind(body.game_id)
    .bind(user_id)
    .fetch_one(pool.get_ref())
    .await {
        Ok(g) => g,
        Err(_) => return HttpResponse::NotFound().json(ErrorResponse {
            error: "Game not found or unauthorized".to_string(),
        }),
    };

    if game.game_type != "quiz" {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "Game type must be quiz".to_string(),
        });
    }

    // Create quiz config
    let config = match sqlx::query_as::<_, QuizConfig>(
        "INSERT INTO quiz_configs (game_id, time_limit, end_screen_text, end_screen_button_text, end_screen_button_url, end_screen_button_new_tab, min_players) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *"
    )
    .bind(body.game_id)
    .bind(body.time_limit)
    .bind(&body.end_screen_text)
    .bind(&body.end_screen_button_text)
    .bind(&body.end_screen_button_url)
    .bind(body.end_screen_button_new_tab)
    .bind(body.min_players)
    .fetch_one(pool.get_ref())
    .await {
        Ok(c) => c,
        Err(e) => {
            log::error!("Error creating quiz config: {}", e);
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Database error: {}", e),
            });
        },
    };

    HttpResponse::Created().json(config)
}

pub async fn create_question(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    body: web::Json<CreateQuestionRequest>,
    req: HttpRequest,
) -> HttpResponse {
    log::info!("Received create question request: {:?}", body);
    
    if let Err(e) = body.validate() {
        log::error!("Validation error: {}", e);
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: format!("Validation error: {}", e),
        });
    }

    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    // Buscar quiz_config_id baseado no game_id
    let quiz_config_id: i32 = match sqlx::query_scalar(
        "SELECT id FROM quiz_configs WHERE game_id = $1"
    )
    .bind(*game_id)
    .fetch_optional(pool.get_ref())
    .await {
        Ok(Some(id)) => id,
        Ok(None) => {
            log::error!("Quiz config not found for game_id: {}", game_id);
            return HttpResponse::NotFound().json(ErrorResponse {
                error: "Quiz configuration not found".to_string(),
            });
        }
        Err(e) => {
            log::error!("Database error fetching quiz_config: {}", e);
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Database error: {}", e),
            });
        }
    };

    if body.options.len() != 4 {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "Must provide exactly 4 options".to_string(),
        });
    }

    let correct_option = match body.correct_answer {
        0 => "A",
        1 => "B",
        2 => "C",
        3 => "D",
        _ => return HttpResponse::BadRequest().json(ErrorResponse {
            error: "Invalid correct_answer value".to_string(),
        }),
    };

    let question = match sqlx::query_as::<_, QuizQuestion>(
        "INSERT INTO quiz_questions 
         (quiz_config_id, question, option_a, option_b, option_c, option_d, correct_option, justification, points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *"
    )
    .bind(quiz_config_id)
    .bind(&body.question_text)
    .bind(&body.options[0])
    .bind(&body.options[1])
    .bind(&body.options[2])
    .bind(&body.options[3])
    .bind(correct_option)
    .bind(&body.justification)
    .bind(body.points.unwrap_or(100))
    .fetch_one(pool.get_ref())
    .await {
        Ok(q) => q,
        Err(e) => {
            log::error!("Database error inserting question: {}", e);
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Database error: {}", e),
            });
        }
    };

    HttpResponse::Created().json(question)
}

pub async fn get_quiz_config(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> HttpResponse {
    let config = match sqlx::query_as::<_, QuizConfig>(
        "SELECT * FROM quiz_configs WHERE game_id = $1"
    )
    .bind(game_id.into_inner())
    .fetch_one(pool.get_ref())
    .await {
        Ok(c) => c,
        Err(_) => return HttpResponse::NotFound().json(ErrorResponse {
            error: "Quiz config not found".to_string(),
        }),
    };

    HttpResponse::Ok().json(config)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateQuizConfigRequest {
    pub end_screen_text: Option<String>,
    pub end_screen_button_text: Option<String>,
    pub end_screen_button_url: Option<String>,
    pub end_screen_button_new_tab: Option<bool>,
    pub min_players: Option<i32>,
}

pub async fn update_quiz_config(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    body: web::Json<UpdateQuizConfigRequest>,
    req: HttpRequest,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    // Verify game exists and belongs to user
    let game_check = sqlx::query_scalar::<_, i32>(
        "SELECT created_by FROM games WHERE id = $1"
    )
    .bind(*game_id)
    .fetch_optional(pool.get_ref())
    .await;

    match game_check {
        Ok(Some(owner_id)) if owner_id == user_id => {},
        Ok(Some(_)) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "You don't have permission to update this quiz".to_string(),
            });
        }
        Ok(None) => {
            return HttpResponse::NotFound().json(ErrorResponse {
                error: "Game not found".to_string(),
            });
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Database error: {}", e),
            });
        }
    }

    // Update quiz config
    let config = match sqlx::query_as::<_, QuizConfig>(
        "UPDATE quiz_configs 
         SET end_screen_text = $1, 
             end_screen_button_text = $2, 
             end_screen_button_url = $3,
             end_screen_button_new_tab = $4,
             min_players = $5
         WHERE game_id = $6 
         RETURNING *"
    )
    .bind(&body.end_screen_text)
    .bind(&body.end_screen_button_text)
    .bind(&body.end_screen_button_url)
    .bind(body.end_screen_button_new_tab)
    .bind(body.min_players)
    .bind(*game_id)
    .fetch_one(pool.get_ref())
    .await {
        Ok(c) => c,
        Err(e) => {
            log::error!("Error updating quiz config: {}", e);
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Database error: {}", e),
            });
        }
    };

    HttpResponse::Ok().json(config)
}

pub async fn get_quiz_questions(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> HttpResponse {
    // First get the quiz config
    let config = match sqlx::query_as::<_, QuizConfig>(
        "SELECT * FROM quiz_configs WHERE game_id = $1"
    )
    .bind(game_id.into_inner())
    .fetch_one(pool.get_ref())
    .await {
        Ok(c) => c,
        Err(_) => return HttpResponse::NotFound().json(ErrorResponse {
            error: "Quiz config not found".to_string(),
        }),
    };

    // Get all questions
    let questions = match sqlx::query_as::<_, QuizQuestion>(
        "SELECT * FROM quiz_questions WHERE quiz_config_id = $1 ORDER BY id"
    )
    .bind(config.id)
    .fetch_all(pool.get_ref())
    .await {
        Ok(q) => q,
        Err(e) => return HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Database error: {}", e),
        }),
    };

    HttpResponse::Ok().json(questions)
}

pub async fn delete_all_questions(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    req: HttpRequest,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    // Verificar se o jogo existe e pertence ao usuário
    let game_check = sqlx::query_scalar::<_, i32>(
        "SELECT created_by FROM games WHERE id = $1"
    )
    .bind(*game_id)
    .fetch_optional(pool.get_ref())
    .await;

    match game_check {
        Ok(Some(owner_id)) if owner_id == user_id => {
            // Usuário autorizado, prosseguir com deleção
        }
        Ok(Some(_)) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "You don't have permission to delete these questions".to_string(),
            });
        }
        Ok(None) => {
            return HttpResponse::NotFound().json(ErrorResponse {
                error: "Game not found".to_string(),
            });
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Database error: {}", e),
            });
        }
    }

    // Deletar todas as perguntas do quiz
    let result = sqlx::query(
        "DELETE FROM quiz_questions WHERE quiz_config_id IN (SELECT id FROM quiz_configs WHERE game_id = $1)"
    )
    .bind(*game_id)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "All questions deleted successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Failed to delete questions: {}", e),
        }),
    }
}

fn extract_user_id(req: &HttpRequest) -> Option<i32> {
    req.extensions().get::<i32>().copied()
}
