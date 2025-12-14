use actix_web::{web, HttpResponse, HttpRequest, HttpMessage};
use sqlx::PgPool;
use serde::{Deserialize, Serialize};

use crate::models::{User, Game, ErrorResponse};

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    total_users: i64,
    total_games: i64,
    total_sessions: i64,
    total_results: i64,
}

pub async fn get_dashboard_stats(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    // Get stats
    let total_users = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(pool.get_ref())
        .await
        .unwrap_or(0);

    let total_games = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM games")
        .fetch_one(pool.get_ref())
        .await
        .unwrap_or(0);

    let total_sessions = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM game_sessions")
        .fetch_one(pool.get_ref())
        .await
        .unwrap_or(0);

    let total_results = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM game_results")
        .fetch_one(pool.get_ref())
        .await
        .unwrap_or(0);

    let stats = DashboardStats {
        total_users,
        total_games,
        total_sessions,
        total_results,
    };

    HttpResponse::Ok().json(stats)
}

pub async fn get_all_users(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    let users = match sqlx::query_as::<_, User>("SELECT * FROM users ORDER BY created_at DESC")
        .fetch_all(pool.get_ref())
        .await {
            Ok(u) => u,
            Err(e) => return HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        };

    HttpResponse::Ok().json(users)
}

pub async fn get_all_games(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    let games = match sqlx::query_as::<_, Game>("SELECT * FROM games ORDER BY created_at DESC")
        .fetch_all(pool.get_ref())
        .await {
            Ok(g) => g,
            Err(e) => return HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        };

    HttpResponse::Ok().json(games)
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserAdminRequest {
    pub is_admin: bool,
}

pub async fn update_user_admin(
    pool: web::Data<PgPool>,
    user_id: web::Path<i32>,
    body: web::Json<UpdateUserAdminRequest>,
    req: HttpRequest,
) -> HttpResponse {
    let admin_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    let result = sqlx::query("UPDATE users SET is_admin = $1 WHERE id = $2")
        .bind(body.is_admin)
        .bind(*user_id)
        .execute(pool.get_ref())
        .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "User admin status updated successfully"
        })),
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

    // First delete related records
    let _ = sqlx::query("DELETE FROM game_results WHERE session_id IN (SELECT id FROM game_sessions WHERE game_id = $1)")
        .bind(*game_id)
        .execute(pool.get_ref())
        .await;

    let _ = sqlx::query("DELETE FROM game_sessions WHERE game_id = $1")
        .bind(*game_id)
        .execute(pool.get_ref())
        .await;

    let _ = sqlx::query("DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quiz_configs WHERE game_id = $1)")
        .bind(*game_id)
        .execute(pool.get_ref())
        .await;

    let _ = sqlx::query("DELETE FROM quiz_configs WHERE game_id = $1")
        .bind(*game_id)
        .execute(pool.get_ref())
        .await;

    let _ = sqlx::query("DELETE FROM word_search_configs WHERE game_id = $1")
        .bind(*game_id)
        .execute(pool.get_ref())
        .await;

    // Finally delete the game
    let result = sqlx::query("DELETE FROM games WHERE id = $1")
        .bind(*game_id)
        .execute(pool.get_ref())
        .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Game deleted successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Database error: {}", e),
        }),
    }
}

fn extract_user_id(req: &HttpRequest) -> Option<i32> {
    req.extensions().get::<i32>().copied()
}
