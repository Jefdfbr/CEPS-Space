use actix_web::{web, HttpResponse, HttpRequest, HttpMessage};
use sqlx::PgPool;
use validator::Validate;

use crate::models::{
    WordSearchConfig, CreateWordSearchRequest, ErrorResponse, Game,
};

pub async fn create_word_search_config(
    pool: web::Data<PgPool>,
    body: web::Json<CreateWordSearchRequest>,
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

    if game.game_type != "word_search" {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "Game type must be word_search".to_string(),
        });
    }

    let result = sqlx::query_as::<_, WordSearchConfig>(
        "INSERT INTO word_search_configs (game_id, grid_size, words, time_limit, allowed_directions, concepts, hide_words) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *"
    )
    .bind(body.game_id)
    .bind(body.grid_size)
    .bind(&body.words)
    .bind(body.time_limit)
    .bind(&body.allowed_directions)
    .bind(&body.concepts)
    .bind(body.hide_words.unwrap_or(false))
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(config) => HttpResponse::Created().json(config),
        Err(e) => {
            log::error!("Error creating word search config: {}", e);
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Database error: {}", e),
            })
        },
    }
}

pub async fn get_word_search_config(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
) -> HttpResponse {
    let config = match sqlx::query_as::<_, WordSearchConfig>(
        "SELECT * FROM word_search_configs WHERE game_id = $1"
    )
    .bind(game_id.into_inner())
    .fetch_one(pool.get_ref())
    .await {
        Ok(c) => c,
        Err(_) => return HttpResponse::NotFound().json(ErrorResponse {
            error: "Word search config not found".to_string(),
        }),
    };

    HttpResponse::Ok().json(config)
}

pub async fn update_word_search_config(
    pool: web::Data<PgPool>,
    game_id: web::Path<i32>,
    body: web::Json<CreateWordSearchRequest>,
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
    let game_id_value = game_id.into_inner();
    let _game = match sqlx::query_as::<_, Game>(
        "SELECT * FROM games WHERE id = $1 AND created_by = $2"
    )
    .bind(game_id_value)
    .bind(user_id)
    .fetch_one(pool.get_ref())
    .await {
        Ok(g) => g,
        Err(_) => return HttpResponse::NotFound().json(ErrorResponse {
            error: "Game not found or unauthorized".to_string(),
        }),
    };

    let result = sqlx::query_as::<_, WordSearchConfig>(
        "UPDATE word_search_configs 
         SET grid_size = $1, words = $2, time_limit = $3, allowed_directions = $4, concepts = $5, hide_words = $6 
         WHERE game_id = $7 
         RETURNING *"
    )
    .bind(body.grid_size)
    .bind(&body.words)
    .bind(body.time_limit)
    .bind(&body.allowed_directions)
    .bind(&body.concepts)
    .bind(body.hide_words.unwrap_or(false))
    .bind(game_id_value)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(config) => HttpResponse::Ok().json(config),
        Err(_) => HttpResponse::NotFound().json(ErrorResponse {
            error: "Word search config not found".to_string(),
        }),
    }
}

fn extract_user_id(req: &HttpRequest) -> Option<i32> {
    req.extensions().get::<i32>().copied()
}
