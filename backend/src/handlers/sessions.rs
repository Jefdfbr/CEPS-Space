use actix_web::{web, HttpResponse, HttpRequest, HttpMessage};
use sqlx::PgPool;
use validator::Validate;
use rand::Rng;

use crate::models::{
    GameSession, CreateSessionRequest, JoinSessionRequest, 
    GameResult, SubmitScoreRequest, ErrorResponse,
};

fn generate_session_code() -> String {
    let mut rng = rand::thread_rng();
    let code: String = (0..6)
        .map(|_| {
            let idx = rng.gen_range(0..36);
            if idx < 10 {
                (b'0' + idx) as char
            } else {
                (b'A' + (idx - 10)) as char
            }
        })
        .collect();
    code
}

pub async fn create_session(
    pool: web::Data<PgPool>,
    body: web::Json<CreateSessionRequest>,
    req: HttpRequest,
) -> HttpResponse {
    let _user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    let session_code = generate_session_code();

    let result = sqlx::query_as::<_, GameSession>(
        "INSERT INTO game_sessions (game_id, session_code, password, max_players) 
         VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(body.game_id)
    .bind(&session_code)
    .bind(&body.password)
    .bind(body.max_players)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(session) => HttpResponse::Created().json(session),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Database error: {}", e),
        }),
    }
}

pub async fn get_session(
    pool: web::Data<PgPool>,
    session_code: web::Path<String>,
) -> HttpResponse {
    let session = match sqlx::query_as::<_, GameSession>(
        "SELECT * FROM game_sessions WHERE session_code = $1"
    )
    .bind(session_code.into_inner())
    .fetch_one(pool.get_ref())
    .await {
        Ok(s) => s,
        Err(_) => return HttpResponse::NotFound().json(ErrorResponse {
            error: "Session not found".to_string(),
        }),
    };

    HttpResponse::Ok().json(session)
}

pub async fn join_session(
    pool: web::Data<PgPool>,
    body: web::Json<JoinSessionRequest>,
) -> HttpResponse {
    let session = match sqlx::query_as::<_, GameSession>(
        "SELECT * FROM game_sessions WHERE session_code = $1 AND is_active = true"
    )
    .bind(&body.session_code)
    .fetch_one(pool.get_ref())
    .await {
        Ok(s) => s,
        Err(_) => return HttpResponse::NotFound().json(ErrorResponse {
            error: "Session not found or inactive".to_string(),
        }),
    };

    // Check password if required
    if let Some(ref session_password) = session.password {
        if let Some(ref provided_password) = body.password {
            if session_password != provided_password {
                return HttpResponse::Unauthorized().json(ErrorResponse {
                    error: "Invalid password".to_string(),
                });
            }
        } else {
            return HttpResponse::Unauthorized().json(ErrorResponse {
                error: "Password required".to_string(),
            });
        }
    }

    // Check max players if set
    if let Some(max_players) = session.max_players {
        let current_players = match sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM game_results WHERE session_id = $1"
        )
        .bind(session.id)
        .fetch_one(pool.get_ref())
        .await {
            Ok(count) => count,
            Err(e) => return HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Database error: {}", e),
            }),
        };

        if current_players >= max_players as i64 {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "Session is full".to_string(),
            });
        }
    }

    HttpResponse::Ok().json(session)
}

pub async fn start_session(
    pool: web::Data<PgPool>,
    session_id: web::Path<i32>,
    req: HttpRequest,
) -> HttpResponse {
    let _user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    let result = sqlx::query_as::<_, GameSession>(
        "UPDATE game_sessions SET started_at = NOW() WHERE id = $1 RETURNING *"
    )
    .bind(session_id.into_inner())
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(session) => HttpResponse::Ok().json(session),
        Err(_) => HttpResponse::NotFound().json(ErrorResponse {
            error: "Session not found".to_string(),
        }),
    }
}

pub async fn end_session(
    pool: web::Data<PgPool>,
    session_id: web::Path<i32>,
    req: HttpRequest,
) -> HttpResponse {
    let _user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    let result = sqlx::query_as::<_, GameSession>(
        "UPDATE game_sessions SET ended_at = NOW(), is_active = false WHERE id = $1 RETURNING *"
    )
    .bind(session_id.into_inner())
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(session) => HttpResponse::Ok().json(session),
        Err(_) => HttpResponse::NotFound().json(ErrorResponse {
            error: "Session not found".to_string(),
        }),
    }
}

pub async fn submit_score(
    pool: web::Data<PgPool>,
    body: web::Json<SubmitScoreRequest>,
) -> HttpResponse {
    let result = sqlx::query_as::<_, GameResult>(
        "INSERT INTO game_results (session_id, player_name, score) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(body.session_id)
    .bind(&body.player_name)
    .bind(body.score)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(result) => HttpResponse::Created().json(result),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Database error: {}", e),
        }),
    }
}

pub async fn get_session_results(
    pool: web::Data<PgPool>,
    session_id: web::Path<i32>,
) -> HttpResponse {
    let results = match sqlx::query_as::<_, GameResult>(
        "SELECT * FROM game_results WHERE session_id = $1 ORDER BY score DESC, completed_at ASC"
    )
    .bind(session_id.into_inner())
    .fetch_all(pool.get_ref())
    .await {
        Ok(r) => r,
        Err(e) => return HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Database error: {}", e),
        }),
    };

    HttpResponse::Ok().json(results)
}

fn extract_user_id(req: &HttpRequest) -> Option<i32> {
    req.extensions().get::<i32>().copied()
}
