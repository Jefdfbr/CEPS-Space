use actix_web::{web, HttpResponse, HttpRequest, HttpMessage};
use sqlx::PgPool;
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use validator::Validate;
use chrono::{Utc, Duration};

use crate::models::{User, RegisterRequest, LoginRequest, LoginResponse, Claims, ErrorResponse};

pub async fn register(
    pool: web::Data<PgPool>,
    body: web::Json<RegisterRequest>,
) -> HttpResponse {
    if let Err(e) = body.validate() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: format!("Validation error: {}", e),
        });
    }

    let password_hash = match hash(&body.password, DEFAULT_COST) {
        Ok(h) => h,
        Err(_) => return HttpResponse::InternalServerError().json(ErrorResponse {
            error: "Error hashing password".to_string(),
        }),
    };

    // Normalize email to lowercase for case-insensitive comparison
    let normalized_email = body.email.to_lowercase();

    let result = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(&normalized_email)
    .bind(&password_hash)
    .bind(&body.name)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(user) => HttpResponse::Created().json(user),
        Err(e) => {
            if e.to_string().contains("duplicate key") {
                HttpResponse::Conflict().json(ErrorResponse {
                    error: "Email already exists".to_string(),
                })
            } else {
                HttpResponse::InternalServerError().json(ErrorResponse {
                    error: format!("Database error: {}", e),
                })
            }
        }
    }
}

pub async fn login(
    pool: web::Data<PgPool>,
    body: web::Json<LoginRequest>,
) -> HttpResponse {
    if let Err(e) = body.validate() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: format!("Validation error: {}", e),
        });
    }

    // Normalize email to lowercase for case-insensitive comparison
    let normalized_email = body.email.to_lowercase();

    let user = match sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1"
    )
    .bind(&normalized_email)
    .fetch_one(pool.get_ref())
    .await {
        Ok(u) => u,
        Err(_) => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Credenciais inválidas".to_string(),
        }),
    };

    let valid = match verify(&body.password, &user.password_hash) {
        Ok(v) => v,
        Err(_) => return HttpResponse::InternalServerError().json(ErrorResponse {
            error: "Error verifying password".to_string(),
        }),
    };

    if !valid {
        return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Credenciais inválidas".to_string(),
        });
    }

    let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let expiration = Utc::now()
        .checked_add_signed(Duration::days(7))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user.id,
        email: user.email.clone(),
        exp: expiration,
    };

    let token = match encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    ) {
        Ok(t) => t,
        Err(_) => return HttpResponse::InternalServerError().json(ErrorResponse {
            error: "Error creating token".to_string(),
        }),
    };

    HttpResponse::Ok().json(LoginResponse { token, user })
}

pub async fn get_profile(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Unauthorized".to_string(),
        }),
    };

    let user = match sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(pool.get_ref())
    .await {
        Ok(u) => u,
        Err(_) => return HttpResponse::NotFound().json(ErrorResponse {
            error: "User not found".to_string(),
        }),
    };

    HttpResponse::Ok().json(user)
}

fn extract_user_id(req: &HttpRequest) -> Option<i32> {
    req.extensions().get::<i32>().copied()
}
