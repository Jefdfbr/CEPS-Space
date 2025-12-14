use actix_web::{web, HttpResponse, HttpRequest, HttpMessage};
use sqlx::{PgPool, Row};
use validator::Validate;

use crate::models::{Game, CreateGameRequest, UpdateGameRequest, ErrorResponse};

pub async fn create_game(
    pool: web::Data<PgPool>,
    body: web::Json<CreateGameRequest>,
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

    let result = sqlx::query_as::<_, Game>(
        "INSERT INTO games (name, game_type, description, created_by, is_active, end_screen_text, end_screen_button_text, end_screen_button_url, end_screen_button_new_tab) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *"
    )
    .bind(&body.name)
    .bind(&body.game_type)
    .bind(&body.description)
    .bind(user_id)
    .bind(body.is_active.unwrap_or(true))
    .bind(&body.end_screen_text)
    .bind(&body.end_screen_button_text)
    .bind(&body.end_screen_button_url)
    .bind(&body.end_screen_button_new_tab)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(game) => HttpResponse::Created().json(game),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Database error: {}", e),
        }),
    }
}

pub async fn get_games(
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let games = match sqlx::query_as::<_, Game>(
        "SELECT * FROM games ORDER BY created_at DESC"
    )
    .fetch_all(pool.get_ref())
    .await {
        Ok(g) => g,
        Err(e) => return HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Database error: {}", e),
        }),
    };

    HttpResponse::Ok().json(games)
}

pub async fn get_game(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> HttpResponse {
    let game = match sqlx::query_as::<_, Game>(
        "SELECT * FROM games WHERE id = $1"
    )
    .bind(game_id.into_inner())
    .fetch_one(pool.get_ref())
    .await {
        Ok(g) => g,
        Err(_) => return HttpResponse::NotFound().json(ErrorResponse {
            error: "Game not found".to_string(),
        }),
    };

    HttpResponse::Ok().json(game)
}

pub async fn get_my_games(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    // Buscar jogos normais, jogos Kahoot e jogos Open Question combinados
    let rows = match sqlx::query(
        "SELECT id, title as name, 'kahoot' as game_type, description, user_id as created_by, 
                is_active, created_at::TIMESTAMPTZ as created_at, updated_at::TIMESTAMPTZ as updated_at, 
                NULL::TEXT as end_screen_text, NULL::TEXT as end_screen_button_text, 
                NULL::TEXT as end_screen_button_url, NULL::BOOLEAN as end_screen_button_new_tab
         FROM kahoot_games WHERE user_id = $1
         UNION ALL
         SELECT id, title as name, 'open_question' as game_type, description, user_id as created_by,
                true as is_active, created_at::TIMESTAMPTZ as created_at, updated_at::TIMESTAMPTZ as updated_at,
                NULL::TEXT as end_screen_text, NULL::TEXT as end_screen_button_text,
                NULL::TEXT as end_screen_button_url, NULL::BOOLEAN as end_screen_button_new_tab
         FROM open_question_games WHERE user_id = $1
         UNION ALL
         SELECT id, name, game_type, description, created_by, 
                is_active, created_at, updated_at,
                end_screen_text, end_screen_button_text, 
                end_screen_button_url, end_screen_button_new_tab
         FROM games WHERE created_by = $1 
         ORDER BY created_at DESC"
    )
    .bind(user_id)
    .fetch_all(pool.get_ref())
    .await {
        Ok(r) => r,
        Err(e) => return HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Database error: {}", e),
        }),
    };

    // Mapear rows manualmente para Game struct
    let games: Vec<Game> = rows.iter().map(|row| {
        Game {
            id: row.get("id"),
            name: row.get("name"),
            game_type: row.get("game_type"),
            description: row.get("description"),
            created_by: Some(row.get("created_by")),
            is_active: row.get("is_active"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            end_screen_text: row.get("end_screen_text"),
            end_screen_button_text: row.get("end_screen_button_text"),
            end_screen_button_url: row.get("end_screen_button_url"),
            end_screen_button_new_tab: row.get("end_screen_button_new_tab"),
        }
    }).collect();

    HttpResponse::Ok().json(games)
}

pub async fn update_game(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    body: web::Json<UpdateGameRequest>,
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

    // Verificar se o jogo existe e pertence ao usuário
    let game_check = sqlx::query_scalar::<_, i32>(
        "SELECT created_by FROM games WHERE id = $1"
    )
    .bind(game_id.as_ref())
    .fetch_optional(pool.get_ref())
    .await;

    match game_check {
        Ok(Some(owner_id)) if owner_id == user_id => {
            // Usuário autorizado, prosseguir com atualização
        }
        Ok(Some(_)) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "You don't have permission to update this game".to_string(),
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

    let result = sqlx::query_as::<_, Game>(
        "UPDATE games SET name = $1, game_type = $2, description = $3, is_active = $4, 
         end_screen_text = $5, end_screen_button_text = $6, end_screen_button_url = $7, 
         end_screen_button_new_tab = $8, updated_at = NOW() 
         WHERE id = $9 
         RETURNING *"
    )
    .bind(&body.name)
    .bind(&body.game_type)
    .bind(&body.description)
    .bind(body.is_active.unwrap_or(true))
    .bind(&body.end_screen_text)
    .bind(&body.end_screen_button_text)
    .bind(&body.end_screen_button_url)
    .bind(&body.end_screen_button_new_tab)
    .bind(game_id.as_ref())
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(game) => HttpResponse::Ok().json(game),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Database error: {}", e),
        }),
    }
}

pub async fn delete_game(
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

    let result = sqlx::query(
        "DELETE FROM games WHERE id = $1 AND created_by = $2"
    )
    .bind(game_id.into_inner())
    .bind(user_id)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(r) => {
            if r.rows_affected() == 0 {
                HttpResponse::NotFound().json(ErrorResponse {
                    error: "Game not found or unauthorized".to_string(),
                })
            } else {
                HttpResponse::NoContent().finish()
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Database error: {}", e),
        }),
    }
}

fn extract_user_id(req: &HttpRequest) -> Option<i32> {
    req.extensions().get::<i32>().copied()
}
