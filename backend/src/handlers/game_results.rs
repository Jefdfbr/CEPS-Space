use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Deserialize)]
pub struct CreateGameResult {
    pub game_id: i32,
    pub room_id: Option<i32>,
    pub time_seconds: i32,
    pub score: i32,
    pub completed: bool,
}

#[derive(Debug, Serialize)]
pub struct GameResult {
    pub id: i32,
    pub game_id: i32,
    pub user_id: i32,
    pub room_id: Option<i32>,
    pub time_seconds: i32,
    pub score: i32,
    pub completed: bool,
    pub created_at: chrono::NaiveDateTime,
}

// Extrair user_id do token ou session_id
fn extract_user_id(req: &HttpRequest) -> Option<i32> {
    // Tentar extrair do header Authorization (JWT)
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..];
                // Decodificar JWT para pegar user_id
                use jsonwebtoken::{decode, DecodingKey, Validation};
                use serde::{Deserialize};
                
                #[derive(Debug, Deserialize)]
                struct Claims {
                    sub: String,
                    exp: usize,
                }
                
                let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
                if let Ok(token_data) = decode::<Claims>(
                    token,
                    &DecodingKey::from_secret(secret.as_bytes()),
                    &Validation::default(),
                ) {
                    if let Ok(user_id) = token_data.claims.sub.parse::<i32>() {
                        return Some(user_id);
                    }
                }
            }
        }
    }
    
    // Tentar extrair do header X-Session-Id
    if let Some(session_header) = req.headers().get("X-Session-Id") {
        if let Ok(session_id) = session_header.to_str() {
            // Aqui precisaríamos buscar o user_id associado ao session_id
            // Por enquanto, vamos retornar None para sessões anônimas
            // mas salvar o resultado mesmo assim usando um user_id padrão
            log::info!("Session ID detectado: {}", session_id);
        }
    }
    
    None
}

pub async fn create_game_result(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    data: web::Json<CreateGameResult>,
) -> Result<HttpResponse> {
    // Extrair user_id ou usar None para jogadores anônimos
    let user_id = extract_user_id(&req);
    
    // Verificar se já existe resultado
    let existing = if let Some(room_id) = data.room_id {
        // Para salas (multiplayer), verificar se já existe resultado dessa sala
        sqlx::query(
            "SELECT id, game_id, user_id, room_id, time_seconds, score, completed, created_at 
             FROM game_results 
             WHERE game_id = $1 AND room_id = $2 
             ORDER BY created_at ASC 
             LIMIT 1"
        )
        .bind(data.game_id)
        .bind(room_id)
        .fetch_optional(pool.get_ref())
        .await
        .map_err(|e| {
            eprintln!("Erro ao verificar resultado existente: {:?}", e);
            actix_web::error::ErrorInternalServerError("Failed to check existing result")
        })?
    } else {
        None
    };
    
    // Se já existe resultado, retornar o existente
    if let Some(row) = existing {
        let id: i32 = row.get(0);
        let game_id: i32 = row.get(1);
        let user_id: Option<i32> = row.get(2);
        let room_id: Option<i32> = row.get(3);
        let time_seconds: i32 = row.get(4);
        let score: i32 = row.get(5);
        let completed: bool = row.get(6);
        let created_at: chrono::NaiveDateTime = row.get(7);
        
        log::info!("Resultado já existe, retornando existente: {} segundos", time_seconds);
        
        return Ok(HttpResponse::Ok().json(serde_json::json!({
            "id": id,
            "game_id": game_id,
            "user_id": user_id,
            "room_id": room_id,
            "time_seconds": time_seconds,
            "score": score,
            "completed": completed,
            "created_at": created_at,
            "already_exists": true
        })));
    }
    
    // Se não existe, criar novo resultado
    // Para caça-palavras, calcular score baseado no tempo (mesma lógica do multiplayer)
    let calculated_score = if data.time_seconds <= 60 {
        100  // Primeiro minuto: 100 pontos
    } else if data.time_seconds <= 300 {
        // De 1 a 5 minutos: diminui de 100 para 50
        let elapsed = data.time_seconds - 60;  // 0 a 240 segundos
        let reduction = (elapsed as f32 / 240.0) * 50.0;  // 0 a 50 pontos de redução
        (100.0 - reduction).floor() as i32
    } else if data.time_seconds <= 600 {
        // De 5 a 10 minutos: diminui de 50 para 20
        let elapsed = data.time_seconds - 300;  // 0 a 300 segundos
        let reduction = (elapsed as f32 / 300.0) * 30.0;  // 0 a 30 pontos de redução
        (50.0 - reduction).floor() as i32
    } else {
        10  // Acima de 10 minutos: pontuação mínima
    };
    
    let result = sqlx::query(
        r#"
        INSERT INTO game_results (game_id, user_id, room_id, time_seconds, score, completed)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, game_id, user_id, room_id, time_seconds, score, completed, created_at
        "#
    )
    .bind(data.game_id)
    .bind(user_id)
    .bind(data.room_id)
    .bind(data.time_seconds)
    .bind(calculated_score)  // Usar o score calculado pelo backend
    .bind(data.completed)
    .fetch_one(pool.get_ref())
    .await
    .map_err(|e| {
        eprintln!("Erro ao criar resultado: {:?}", e);
        actix_web::error::ErrorInternalServerError("Failed to create game result")
    })?;

    let id: i32 = result.get(0);
    let game_id: i32 = result.get(1);
    let user_id: Option<i32> = result.get(2);
    let room_id: Option<i32> = result.get(3);
    let time_seconds: i32 = result.get(4);
    let score: i32 = result.get(5);
    let completed: bool = result.get(6);
    let created_at: chrono::NaiveDateTime = result.get(7);
    
    log::info!("Novo resultado salvo: {} segundos", time_seconds);

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "id": id,
        "game_id": game_id,
        "user_id": user_id,
        "room_id": room_id,
        "time_seconds": time_seconds,
        "score": score,
        "completed": completed,
        "created_at": created_at,
        "already_exists": false
    })))
}

pub async fn get_game_result(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    path: web::Path<(i32, Option<i32>)>,
) -> Result<HttpResponse> {
    let (game_id, room_id) = path.into_inner();
    let user_id = extract_user_id(&req);
    
    let result = if let Some(room_id) = room_id {
        // Buscar resultado por sala (multiplayer) - primeiro resultado da sala
        sqlx::query(
            r#"
            SELECT id, game_id, user_id, room_id, time_seconds, score, completed, created_at
            FROM game_results
            WHERE game_id = $1 AND room_id = $2
            ORDER BY created_at ASC
            LIMIT 1
            "#
        )
        .bind(game_id)
        .bind(room_id)
        .fetch_optional(pool.get_ref())
        .await
        .map_err(|e| {
            eprintln!("Erro ao buscar resultado: {:?}", e);
            actix_web::error::ErrorInternalServerError("Failed to fetch game result")
        })?
    } else {
        // Buscar resultado por usuário (solo) - último resultado
        if let Some(uid) = user_id {
            sqlx::query(
                r#"
                SELECT id, game_id, user_id, room_id, time_seconds, score, completed, created_at
                FROM game_results
                WHERE game_id = $1 AND user_id = $2 AND room_id IS NULL
                ORDER BY created_at DESC
                LIMIT 1
                "#
            )
            .bind(game_id)
            .bind(uid)
            .fetch_optional(pool.get_ref())
            .await
            .map_err(|e| {
                eprintln!("Erro ao buscar resultado: {:?}", e);
                actix_web::error::ErrorInternalServerError("Failed to fetch game result")
            })?
        } else {
            None
        }
    };

    match result {
        Some(r) => {
            let id: i32 = r.get(0);
            let game_id: i32 = r.get(1);
            let user_id: Option<i32> = r.get(2);
            let room_id: Option<i32> = r.get(3);
            let time_seconds: i32 = r.get(4);
            let score: i32 = r.get(5);
            let completed: bool = r.get(6);
            let created_at: chrono::NaiveDateTime = r.get(7);
            
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "id": id,
                "game_id": game_id,
                "user_id": user_id,
                "room_id": room_id,
                "time_seconds": time_seconds,
                "score": score,
                "completed": completed,
                "created_at": created_at
            })))
        },
        None => Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Game result not found"
        })))
    }
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/game-results")
            .route("", web::post().to(create_game_result))
            .route("/{game_id}", web::get().to(get_game_result))
            .route("/{game_id}/{room_id}", web::get().to(get_game_result))
    );
}
