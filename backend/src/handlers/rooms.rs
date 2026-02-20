use actix_web::{web, HttpResponse, HttpRequest, HttpMessage};
use sqlx::PgPool;
use validator::Validate;
use serde::Deserialize;
use rand::Rng;
use chrono::{Utc, Duration};

use crate::models::{
    CreateRoomRequest, JoinRoomRequest, JoinRoomAnonymousRequest, 
    AnonymousSessionResponse, GameRoom, RoomParticipant, 
    RoomAnswer, SubmitRoomAnswerRequest, RoomDetailsResponse,
    RoomParticipantInfo, Game, User, RoomFoundWord, RoomPlayerScore
};

// Cores disponíveis para jogadores
const PLAYER_COLORS: &[&str] = &[
    "#EF4444", // red
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // amber
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#14B8A6", // teal
    "#F97316", // orange
];

// Extrair user_id dos extensions (colocado pelo middleware Auth)
fn extract_user_id(req: &HttpRequest) -> Option<i32> {
    req.extensions().get::<i32>().copied()
}

// Atribuir cor ao jogador baseada no user_id (determinístico, sem race condition)
fn assign_player_color(user_id: i32) -> String {
    let index = (user_id as usize) % PLAYER_COLORS.len();
    PLAYER_COLORS[index].to_string()
}

// Atribuir cor a jogador anônimo baseada no hash do session_id (sem race condition)
fn assign_player_color_anon(session_id: &str) -> String {
    let hash: usize = session_id.bytes().fold(0usize, |acc, b| acc.wrapping_add(b as usize));
    PLAYER_COLORS[hash % PLAYER_COLORS.len()].to_string()
}

// Helper para buscar usuário
async fn get_user_from_id(user_id: i32, pool: &PgPool) -> Result<User, HttpResponse> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await;

    match user {
        Ok(Some(user)) => Ok(user),
        Ok(None) => Err(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "User not found"
        }))),
        Err(e) => Err(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        }))),
    }
}

// Gerar código aleatório para sala
fn generate_room_code() -> String {
    let chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    (0..6)
        .map(|_| {
            let idx = rng.gen_range(0..chars.len());
            chars.chars().nth(idx).unwrap()
        })
        .collect()
}

// Gerar session_id único para jogador anônimo
fn generate_session_id() -> String {
    use rand::distributions::Alphanumeric;
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}

// Criar sala
pub async fn create_room(
    req: HttpRequest,
    body: web::Json<CreateRoomRequest>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        })),
    };

    let user = match get_user_from_id(user_id, pool.get_ref()).await {
        Ok(user) => user,
        Err(e) => return e,
    };

    if let Err(e) = body.validate() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("Validation error: {}", e)
        }));
    }

    // Verificar se o jogo existe
    let game = sqlx::query_as::<_, Game>(
        "SELECT * FROM games WHERE id = $1 AND is_active = true"
    )
    .bind(body.game_id)
    .fetch_optional(pool.get_ref())
    .await;

    if let Err(e) = game {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        }));
    }

    if game.unwrap().is_none() {
        return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Game not found or inactive"
        }));
    }

    // Verificar se já existe sala com esse nome no mesmo jogo
    let existing_name = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE game_id = $1 AND room_name = $2 AND is_active = true"
    )
    .bind(body.game_id)
    .bind(&body.room_name)
    .fetch_optional(pool.get_ref())
    .await;

    match existing_name {
        Ok(Some(_)) => return HttpResponse::Conflict().json(serde_json::json!({
            "error": "Já existe uma sala ativa com esse nome neste jogo"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
        _ => {}
    }

    // Gerar código único
    let mut room_code = generate_room_code();
    loop {
        let existing = sqlx::query_as::<_, GameRoom>(
            "SELECT * FROM game_rooms WHERE room_code = $1"
        )
        .bind(&room_code)
        .fetch_optional(pool.get_ref())
        .await;

        match existing {
            Ok(None) => break,
            Ok(Some(_)) => room_code = generate_room_code(),
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Database error: {}", e)
            })),
        }
    }

    // Hash da senha se fornecida
    let password_hash = if let Some(password) = &body.password {
        match bcrypt::hash(password, bcrypt::DEFAULT_COST) {
            Ok(hash) => Some(hash),
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Password hashing error: {}", e)
            })),
        }
    } else {
        None
    };

    // Calcular expiração
    let expires_at = body.duration_hours.map(|hours| {
        Utc::now() + Duration::hours(hours as i64)
    });

    // Gerar seed única para a sala (garante mesmo jogo para todos)
    let game_seed = format!("{}{}", room_code, Utc::now().timestamp_millis());

    // Criar sala
    let room = sqlx::query_as::<_, GameRoom>(
        "INSERT INTO game_rooms (game_id, room_code, room_name, password_hash, max_players, created_by, expires_at, game_seed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *"
    )
    .bind(body.game_id)
    .bind(&room_code)
    .bind(&body.room_name)
    .bind(&password_hash)
    .bind(body.max_players.unwrap_or(50))
    .bind(user.id)
    .bind(expires_at)
    .bind(&game_seed)
    .fetch_one(pool.get_ref())
    .await;

    match room {
        Ok(room) => {
            // Atribuir cor ao criador baseada no user_id (sem race condition)
            let color = assign_player_color(user.id);
            
            // Adicionar criador como participante e host
            let _ = sqlx::query(
                "INSERT INTO room_participants (room_id, user_id, is_host, player_color) VALUES ($1, $2, true, $3)"
            )
            .bind(room.id)
            .bind(user.id)
            .bind(&color)
            .execute(pool.get_ref())
            .await;

            HttpResponse::Ok().json(room)
        },
        Err(e) => {
            log::error!("Failed to create room: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to create room: {}", e)
            }))
        },
    }
}

// Entrar em sala
pub async fn join_room(
    req: HttpRequest,
    body: web::Json<JoinRoomRequest>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        })),
    };

    let user = match get_user_from_id(user_id, pool.get_ref()).await {
        Ok(user) => user,
        Err(e) => return e,
    };

    // Buscar sala
    let room = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE room_code = $1 AND is_active = true"
    )
    .bind(&body.room_code)
    .fetch_optional(pool.get_ref())
    .await;

    let room = match room {
        Ok(Some(room)) => room,
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Room not found or inactive"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    };

    // Verificar expiração
    if let Some(expires_at) = room.expires_at {
        if expires_at < Utc::now() {
            return HttpResponse::Gone().json(serde_json::json!({
                "error": "Room has expired"
            }));
        }
    }

    // Verificar senha
    if let Some(password_hash) = &room.password_hash {
        let empty_password = String::new();
        let password = body.password.as_ref().unwrap_or(&empty_password);
        match bcrypt::verify(password, password_hash) {
            Ok(true) => {},
            Ok(false) => return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Invalid password"
            })),
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Password verification error: {}", e)
            })),
        }
    }

    // Verificar limite de participantes
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM room_participants WHERE room_id = $1"
    )
    .bind(room.id)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or((0,));

    if count.0 >= room.max_players as i64 {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Room is full"
        }));
    }

    // Atribuir cor ao novo participante baseada no user_id (sem race condition)
    let color = assign_player_color(user.id);

    // Adicionar participante
    let result = sqlx::query_as::<_, RoomParticipant>(
        "INSERT INTO room_participants (room_id, user_id, is_host, player_color)
         VALUES ($1, $2, false, $3)
         ON CONFLICT (room_id, user_id) DO UPDATE SET player_color = EXCLUDED.player_color, joined_at = NOW()
         RETURNING *"
    )
    .bind(room.id)
    .bind(user.id)
    .bind(&color)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Joined room successfully",
            "room": room
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to join room: {}", e)
        })),
    }
}

// Entrar em sala anonimamente (sem cadastro)
pub async fn join_room_anonymous(
    body: web::Json<JoinRoomAnonymousRequest>,
    pool: web::Data<PgPool>,
    room_manager: web::Data<crate::websocket::RoomManager>,
) -> HttpResponse {
    log::info!("join_room_anonymous called with room_code: {}, player_name: {}", 
        body.room_code, body.player_name);
    
    if let Err(e) = body.validate() {
        log::error!("Validation error: {}", e);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("Validation error: {}", e)
        }));
    }

    // Buscar sala pelo código
    let room = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE room_code = $1"
    )
    .bind(&body.room_code)
    .fetch_optional(pool.get_ref())
    .await;

    let room = match room {
        Ok(Some(room)) => room,
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Room not found"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    };

    // Verificar se sala está ativa
    if !room.is_active {
        return HttpResponse::Gone().json(serde_json::json!({
            "error": "Room is closed"
        }));
    }

    // Verificar expiração
    if let Some(expires_at) = room.expires_at {
        if expires_at < Utc::now() {
            return HttpResponse::Gone().json(serde_json::json!({
                "error": "Room has expired"
            }));
        }
    }

    // Verificar senha
    if let Some(password_hash) = &room.password_hash {
        let empty_password = String::new();
        let password = body.password.as_ref().unwrap_or(&empty_password);
        log::info!("Verifying password. Password provided: '{}', Hash: '{}'", password, password_hash);
        match bcrypt::verify(password, password_hash) {
            Ok(true) => {
                log::info!("Password verified successfully");
            },
            Ok(false) => {
                log::warn!("Invalid password for room {}", room.room_code);
                return HttpResponse::Unauthorized().json(serde_json::json!({
                    "error": "Invalid password"
                }));
            },
            Err(e) => {
                log::error!("Password verification error: {}", e);
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": format!("Password verification error: {}", e)
                }));
            },
        }
    }

    // Verificar se é uma reconexão via existing_session_id
    if let Some(ref existing_id) = body.existing_session_id {
        let existing_session = sqlx::query_as::<_, (String, String)>(
            "SELECT session_id, player_color 
             FROM room_participants 
             WHERE room_id = $1 AND session_id = $2
             LIMIT 1"
        )
        .bind(room.id)
        .bind(existing_id)
        .fetch_optional(pool.get_ref())
        .await;

        // Se encontrou sessão existente válida, retornar ela
        if let Ok(Some((session_id, player_color))) = existing_session {
            return HttpResponse::Ok().json(AnonymousSessionResponse {
                session_id,
                room_id: room.id,
                room_code: room.room_code,
                player_name: body.player_name.clone(),
                player_color,
            });
        }
    }

    // Verificar limite de participantes baseado em conexões WebSocket ativas
    let active_connections = {
        let manager = room_manager.lock().unwrap();
        manager.get(&room.id).map(|conns| conns.len()).unwrap_or(0)
    };

    log::info!("Room {} has {} active WebSocket connections out of {} max", 
        room.room_code, active_connections, room.max_players);

    // Se é o primeiro jogador entrando, iniciar o timer
    if active_connections == 0 {
        // Verificar se estava pausado
        let pause_info = sqlx::query_as::<_, (Option<chrono::DateTime<Utc>>, Option<i32>)>(
            "SELECT paused_at, total_pause_duration FROM game_rooms WHERE id = $1"
        )
        .bind(room.id)
        .fetch_one(pool.get_ref())
        .await;

        if let Ok((paused_at, total_pause)) = pause_info {
            if let Some(pause_time) = paused_at {
                // Calcular quanto tempo ficou pausado
                let pause_duration = (Utc::now() - pause_time).num_seconds() as i32;
                let total_pause_duration = total_pause.unwrap_or(0) + pause_duration;
                
                // Atualizar total de pausa e limpar paused_at
                let _ = sqlx::query(
                    "UPDATE game_rooms 
                     SET paused_at = NULL, total_pause_duration = $1 
                     WHERE id = $2"
                )
                .bind(total_pause_duration)
                .bind(room.id)
                .execute(pool.get_ref())
                .await;
                
                log::info!("Room {} resumed. Pause duration: {}s, Total pause: {}s", 
                    room.room_code, pause_duration, total_pause_duration);
            } else {
                // Primeira vez entrando, iniciar timer
                let _ = sqlx::query(
                    "UPDATE game_rooms SET started_at = NOW() WHERE id = $1 AND started_at IS NULL"
                )
                .bind(room.id)
                .execute(pool.get_ref())
                .await;
                
                log::info!("Room {} timer started", room.room_code);
            }
        }
    }

    if active_connections >= room.max_players as usize {
        log::warn!("Room {} is full ({}/{})", room.room_code, active_connections, room.max_players);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Room is full"
        }));
    }

    // Gerar session_id único
    let session_id = generate_session_id();

    // Atribuir cor ao jogador anônimo pelo hash do session_id (sem race condition)
    let player_color = assign_player_color_anon(&session_id);

    // Adicionar participante anônimo (opcional, apenas para histórico)
    let result = sqlx::query(
        "INSERT INTO room_participants (room_id, session_id, player_name, is_host, player_color)
         VALUES ($1, $2, $3, false, $4)"
    )
    .bind(room.id)
    .bind(&session_id)
    .bind(&body.player_name)
    .bind(&player_color)
    .execute(pool.get_ref())
    .await;

    if result.is_err() {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to join room: {}", result.unwrap_err())
        }));
    }

    // Criar registro inicial em room_player_scores para exibir o jogador com 0 pontos
    log::info!("🎯 Criando registro inicial de score - room_id: {}, session_id: {}, player_name: {}, color: {}", 
        room.id, session_id, body.player_name, player_color);
    
    let score_insert_result = sqlx::query(
        "INSERT INTO room_player_scores (room_id, session_id, player_name, player_color, words_found, total_score)
         VALUES ($1, $2, $3, $4, 0, 0)
         ON CONFLICT (room_id, session_id) DO UPDATE SET 
            player_name = EXCLUDED.player_name,
            player_color = EXCLUDED.player_color"
    )
    .bind(room.id)
    .bind(&session_id)
    .bind(&body.player_name)
    .bind(&player_color)
    .execute(pool.get_ref())
    .await;

    match score_insert_result {
        Ok(_) => log::info!("✅ Registro de score criado com sucesso para {}", body.player_name),
        Err(e) => log::error!("❌ Erro ao criar registro de score: {}", e),
    }

    HttpResponse::Ok().json(AnonymousSessionResponse {
        session_id,
        room_id: room.id,
        room_code: room.room_code,
        player_name: body.player_name.clone(),
        player_color,
    })
}

// Obter informações públicas da sala (sem autenticação)
pub async fn get_room_info_public(
    room_code: web::Path<String>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    // Buscar sala
    let room = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE room_code = $1"
    )
    .bind(room_code.as_str())
    .fetch_optional(pool.get_ref())
    .await;

    let room = match room {
        Ok(Some(room)) => room,
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Room not found"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    };

    // Buscar jogo
    let game = sqlx::query_as::<_, Game>(
        "SELECT * FROM games WHERE id = $1"
    )
    .bind(room.game_id)
    .fetch_one(pool.get_ref())
    .await;

    let game = match game {
        Ok(game) => game,
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to fetch game: {}", e)
        })),
    };

    HttpResponse::Ok().json(serde_json::json!({
        "room": room,
        "game": game
    }))
}

// Obter informações públicas da sala por ID (sem autenticação)
pub async fn get_room_info_by_id_public(
    room_id: web::Path<i32>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    // Buscar sala
    let room = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE id = $1"
    )
    .bind(room_id.into_inner())
    .fetch_optional(pool.get_ref())
    .await;

    let room = match room {
        Ok(Some(room)) => room,
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Room not found"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    };

    // Buscar jogo
    let game = sqlx::query_as::<_, Game>(
        "SELECT * FROM games WHERE id = $1"
    )
    .bind(room.game_id)
    .fetch_one(pool.get_ref())
    .await;

    let game = match game {
        Ok(game) => game,
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to fetch game: {}", e)
        })),
    };

    HttpResponse::Ok().json(serde_json::json!({
        "room": room,
        "game": game
    }))
}

// Listar salas por jogo (público)
pub async fn list_rooms_by_game(
    game_id: web::Path<i32>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let rooms = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE game_id = $1 AND is_active = true ORDER BY created_at DESC"
    )
    .bind(*game_id)
    .fetch_all(pool.get_ref())
    .await;

    match rooms {
        Ok(rooms) => HttpResponse::Ok().json(rooms),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    }
}

// Listar todas as salas ativas (público)
pub async fn list_active_rooms(
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let rooms = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE is_active = true ORDER BY created_at DESC"
    )
    .fetch_all(pool.get_ref())
    .await;

    match rooms {
        Ok(rooms) => HttpResponse::Ok().json(rooms),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    }
}

// Obter detalhes da sala
pub async fn get_room_details(
    req: HttpRequest,
    room_code: web::Path<String>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        })),
    };

    let user = match get_user_from_id(user_id, pool.get_ref()).await {
        Ok(user) => user,
        Err(e) => return e,
    };

    // Buscar sala
    let room = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE room_code = $1"
    )
    .bind(room_code.as_str())
    .fetch_optional(pool.get_ref())
    .await;

    let room = match room {
        Ok(Some(room)) => room,
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Room not found"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    };

    // Buscar jogo
    let game = sqlx::query_as::<_, Game>(
        "SELECT * FROM games WHERE id = $1"
    )
    .bind(room.game_id)
    .fetch_one(pool.get_ref())
    .await;

    let game = match game {
        Ok(game) => game,
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to fetch game: {}", e)
        })),
    };

    // Buscar participantes (incluindo anônimos)
    let participants = sqlx::query_as::<_, (i32, Option<i32>, String, chrono::DateTime<Utc>, bool, Option<String>)>(
        "SELECT rp.id, rp.user_id, 
                COALESCE(u.name, rp.player_name, 'Anônimo') as name, 
                rp.joined_at, rp.is_host, rp.player_color
         FROM room_participants rp
         LEFT JOIN users u ON rp.user_id = u.id
         WHERE rp.room_id = $1
         ORDER BY rp.joined_at"
    )
    .bind(room.id)
    .fetch_all(pool.get_ref())
    .await;

    let participants: Vec<RoomParticipantInfo> = match participants {
        Ok(rows) => rows.into_iter().map(|(id, user_id, name, joined_at, is_host, player_color)| {
            RoomParticipantInfo {
                id,
                user_id,
                name,
                joined_at,
                is_host,
                player_color,
            }
        }).collect(),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to fetch participants: {}", e)
        })),
    };

    // Verificar se usuário é participante
    let is_participant = participants.iter().any(|p| p.user_id == Some(user.id));
    let is_host = participants.iter().any(|p| p.user_id == Some(user.id) && p.is_host);

    HttpResponse::Ok().json(RoomDetailsResponse {
        room,
        game,
        participants,
        is_participant,
        is_host,
    })
}

// Listar salas ativas
pub async fn list_rooms(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let _user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        })),
    };

    let rooms = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms 
         WHERE is_active = true 
         AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC"
    )
    .fetch_all(pool.get_ref())
    .await;

    match rooms {
        Ok(rooms) => HttpResponse::Ok().json(rooms),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to fetch rooms: {}", e)
        })),
    }
}

// Enviar resposta na sala
pub async fn submit_room_answer(
    req: HttpRequest,
    room_id: web::Path<i32>,
    body: web::Json<SubmitRoomAnswerRequest>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    // Aceitar tanto user_id autenticado quanto session_id anônimo
    let user_id = extract_user_id(&req);
    let session_id = req.headers()
        .get("X-Session-Id")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());
    
    let identifier = if let Some(uid) = user_id {
        format!("user_{}", uid)
    } else if let Some(sid) = session_id {
        format!("session_{}", sid)
    } else {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "No authentication found"
        }));
    };

    // Para usuários autenticados, verificar se é participante
    if let Some(uid) = user_id {
        let user = match get_user_from_id(uid, pool.get_ref()).await {
            Ok(user) => user,
            Err(e) => return e,
        };

        // Verificar se usuário é participante
        let participant = sqlx::query_as::<_, RoomParticipant>(
            "SELECT * FROM room_participants WHERE room_id = $1 AND user_id = $2"
        )
        .bind(*room_id)
        .bind(user.id)
        .fetch_optional(pool.get_ref())
        .await;

        match participant {
            Ok(None) => return HttpResponse::Forbidden().json(serde_json::json!({
                "error": "You are not a participant of this room"
            })),
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Database error: {}", e)
            })),
            _ => {}
        }
    }
    // Para usuários anônimos, apenas continuar (já participaram se têm session_id válido)

    // Buscar tipo de jogo
    let game_type: (String,) = sqlx::query_as(
        "SELECT g.game_type FROM games g
         JOIN game_rooms gr ON g.id = gr.game_id
         WHERE gr.id = $1"
    )
    .bind(*room_id)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or((String::from("unknown"),));

    // Salvar resposta (usar user_id se autenticado, NULL se anônimo)
    let answer = sqlx::query_as::<_, RoomAnswer>(
        "INSERT INTO room_answers (room_id, user_id, game_type, answer_data, score)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *"
    )
    .bind(*room_id)
    .bind(user_id)  // Pode ser NULL para anônimos
    .bind(game_type.0)
    .bind(&body.answer_data)
    .bind(body.score)
    .fetch_one(pool.get_ref())
    .await;

    match answer {
        Ok(answer) => HttpResponse::Ok().json(answer),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to submit answer: {}", e)
        })),
    }
}

// Obter respostas da sala (para o host ver resultados)
pub async fn get_room_answers(
    req: HttpRequest,
    room_id: web::Path<i32>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        })),
    };

    let user = match get_user_from_id(user_id, pool.get_ref()).await {
        Ok(user) => user,
        Err(e) => return e,
    };

    // Verificar se usuário é participante
    let participant = sqlx::query_as::<_, RoomParticipant>(
        "SELECT * FROM room_participants WHERE room_id = $1 AND user_id = $2"
    )
    .bind(*room_id)
    .bind(user.id)
    .fetch_optional(pool.get_ref())
    .await;

    match participant {
        Ok(None) => return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You are not a participant of this room"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
        _ => {}
    }

    // Buscar respostas com informações dos usuários
    let answers = sqlx::query_as::<_, (i32, i32, i32, String, serde_json::Value, i32, chrono::DateTime<Utc>, String)>(
        "SELECT ra.id, ra.room_id, ra.user_id, ra.game_type, ra.answer_data, ra.score, ra.completed_at, u.name as user_name
         FROM room_answers ra
         JOIN users u ON ra.user_id = u.id
         WHERE ra.room_id = $1
         ORDER BY ra.score DESC, ra.completed_at ASC"
    )
    .bind(*room_id)
    .fetch_all(pool.get_ref())
    .await;

    match answers {
        Ok(answers) => {
            let result: Vec<_> = answers.into_iter().map(|(id, room_id, user_id, game_type, answer_data, score, completed_at, user_name)| {
                serde_json::json!({
                    "id": id,
                    "room_id": room_id,
                    "user_id": user_id,
                    "game_type": game_type,
                    "answer_data": answer_data,
                    "score": score,
                    "completed_at": completed_at,
                    "user_name": user_name
                })
            }).collect();
            HttpResponse::Ok().json(result)
        },
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to fetch answers: {}", e)
        })),
    }
}

// Fechar sala (apenas host)
pub async fn close_room(
    req: HttpRequest,
    room_id: web::Path<i32>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        })),
    };

    let user = match get_user_from_id(user_id, pool.get_ref()).await {
        Ok(user) => user,
        Err(e) => return e,
    };

    // Verificar se usuário é host
    let participant = sqlx::query_as::<_, RoomParticipant>(
        "SELECT * FROM room_participants WHERE room_id = $1 AND user_id = $2 AND is_host = true"
    )
    .bind(*room_id)
    .bind(user.id)
    .fetch_optional(pool.get_ref())
    .await;

    match participant {
        Ok(None) => return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You are not the host of this room"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
        _ => {}
    }

    // Desativar sala
    let result = sqlx::query(
        "UPDATE game_rooms SET is_active = false WHERE id = $1"
    )
    .bind(*room_id)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Room closed successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to close room: {}", e)
        })),
    }
}

// Salvar progresso do quiz (respostas intermediárias)
pub async fn save_quiz_progress(
    req: HttpRequest,
    room_id: web::Path<i32>,
    body: web::Json<serde_json::Value>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    // Identificar usuário (pode ser autenticado ou anônimo via session_id)
    let user_id = extract_user_id(&req);
    let session_id = req.headers()
        .get("X-Session-Id")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());
    
    let identifier = if let Some(uid) = user_id {
        format!("user_{}", uid)
    } else if let Some(sid) = session_id {
        format!("session_{}", sid)
    } else {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "No authentication found"
        }));
    };

    // Upsert: inserir ou atualizar progresso
    let result = sqlx::query(
        "INSERT INTO quiz_progress (room_id, user_identifier, progress_data, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (room_id, user_identifier) 
         DO UPDATE SET progress_data = $3, updated_at = NOW()"
    )
    .bind(*room_id)
    .bind(&identifier)
    .bind(&body.0)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Progress saved"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to save progress: {}", e)
        })),
    }
}

// Carregar progresso do quiz
pub async fn get_quiz_progress(
    req: HttpRequest,
    room_id: web::Path<i32>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = extract_user_id(&req);
    let session_id = req.headers()
        .get("X-Session-Id")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());
    
    let identifier = if let Some(uid) = user_id {
        format!("user_{}", uid)
    } else if let Some(sid) = session_id {
        format!("session_{}", sid)
    } else {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "No authentication found"
        }));
    };

    // PRIMEIRA TENTATIVA: Buscar progresso da sala (qualquer jogador que finalizou)
    let room_progress: Result<Option<(serde_json::Value,)>, sqlx::Error> = sqlx::query_as(
        "SELECT progress_data FROM quiz_progress 
         WHERE room_id = $1 AND progress_data->>'finished' = 'true'
         ORDER BY updated_at DESC
         LIMIT 1"
    )
    .bind(*room_id)
    .fetch_optional(pool.get_ref())
    .await;

    // Se alguém já finalizou, retornar esse progresso (para mostrar tela final)
    if let Ok(Some((data,))) = room_progress {
        return HttpResponse::Ok().json(data);
    }

    // SEGUNDA TENTATIVA: Buscar progresso individual (sessão atual)
    let progress: Result<(serde_json::Value,), sqlx::Error> = sqlx::query_as(
        "SELECT progress_data FROM quiz_progress 
         WHERE room_id = $1 AND user_identifier = $2"
    )
    .bind(*room_id)
    .bind(&identifier)
    .fetch_optional(pool.get_ref())
    .await
    .map(|opt| opt.unwrap_or((serde_json::json!({}),)));

    match progress {
        Ok((data,)) => HttpResponse::Ok().json(data),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to load progress: {}", e)
        })),
    }
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/rooms")
            .route("", web::post().to(create_room))
            .route("", web::get().to(list_rooms))
            .route("/join", web::post().to(join_room))
            .route("/{room_code}", web::get().to(get_room_details))
            .route("/{room_id}/answer", web::post().to(submit_room_answer))
            .route("/{room_id}/answers", web::get().to(get_room_answers))
            .route("/{room_id}/quiz-progress", web::post().to(save_quiz_progress))
            .route("/{room_id}/quiz-progress", web::get().to(get_quiz_progress))
            .route("/{room_id}/close", web::post().to(close_room))
    );
}

// Buscar palavras já encontradas na sala
pub async fn get_room_found_words(
    room_id: web::Path<i32>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let words = sqlx::query_as::<_, RoomFoundWord>(
        "SELECT * FROM room_found_words WHERE room_id = $1 ORDER BY found_at ASC"
    )
    .bind(*room_id)
    .fetch_all(pool.get_ref())
    .await;

    match words {
        Ok(words) => HttpResponse::Ok().json(words),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    }
}

// Buscar pontuações dos jogadores na sala
pub async fn get_room_scores(
    room_id: web::Path<i32>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    // Primeiro, buscar a sala para saber o tipo de jogo
    let room = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE id = $1"
    )
    .bind(*room_id)
    .fetch_optional(pool.get_ref())
    .await;

    let room = match room {
        Ok(Some(r)) => r,
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Room not found"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    };

    // Buscar o tipo de jogo
    let game = sqlx::query_as::<_, Game>(
        "SELECT * FROM games WHERE id = $1"
    )
    .bind(room.game_id)
    .fetch_optional(pool.get_ref())
    .await;

    let game = match game {
        Ok(Some(g)) => g,
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Game not found"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    };

    // Se for quiz, buscar de quiz_progress e calcular scores
    if game.game_type == "quiz" {
        // Primeiro, buscar o quiz_config_id do jogo
        let quiz_config_id: Result<Option<(i32,)>, _> = sqlx::query_as(
            "SELECT id FROM quiz_configs WHERE game_id = $1 LIMIT 1"
        )
        .bind(game.id)
        .fetch_optional(pool.get_ref())
        .await;

        let quiz_config_id = match quiz_config_id {
            Ok(Some((id,))) => id,
            Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Quiz configuration not found"
            })),
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to fetch quiz config: {}", e)
            })),
        };

        // Buscar as perguntas do quiz com respostas corretas e pontos
        let questions: Result<Vec<(i32, String, i32)>, _> = sqlx::query_as(
            "SELECT id, correct_option, points FROM quiz_questions WHERE quiz_config_id = $1 ORDER BY id"
        )
        .bind(quiz_config_id)
        .fetch_all(pool.get_ref())
        .await;

        let questions = match questions {
            Ok(q) => q,
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to fetch questions: {}", e)
            })),
        };

        // Buscar progresso dos jogadores
        let quiz_progress: Result<Vec<(String, serde_json::Value)>, _> = sqlx::query_as(
            "SELECT user_identifier, progress_data FROM quiz_progress WHERE room_id = $1"
        )
        .bind(*room_id)
        .fetch_all(pool.get_ref())
        .await;

        let progress = match quiz_progress {
            Ok(p) => p,
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to fetch progress: {}", e)
            })),
        };

        // Calcular scores para cada jogador
        let formatted_scores: Vec<serde_json::Value> = progress.iter()
            .filter_map(|(user_identifier, progress_data)| {
                // Extrair respostas do JSON
                let answers = progress_data.get("answers")?.as_object()?;
                
                // Calcular score
                let mut total_score = 0i64;
                let mut correct_answers = 0i32;
                
                for (idx, (_, correct_option, points)) in questions.iter().enumerate() {
                    if let Some(player_answer) = answers.get(&idx.to_string()) {
                        let player_answer_str = player_answer.as_str()?;
                        if player_answer_str == correct_option.trim() {
                            total_score += *points as i64;
                            correct_answers += 1;
                        }
                    }
                }
                
                // Extrair nome do jogador (do progress_data se disponível, senão do user_identifier)
                let player_name = progress_data
                    .get("player_name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| {
                        if user_identifier.starts_with("session_") {
                            format!("Jogador #{}", &user_identifier[8..12])
                        } else if user_identifier.starts_with("user_") {
                            user_identifier.to_string()
                        } else {
                            user_identifier.to_string()
                        }
                    });
                
                Some(serde_json::json!({
                    "player_name": player_name,
                    "total_score": total_score,
                    "words_found": correct_answers,
                    "player_color": "#6366f1"
                }))
            })
            .collect();

        // Ordenar por pontuação
        let mut sorted_scores = formatted_scores;
        sorted_scores.sort_by(|a, b| {
            let score_a = a.get("total_score").and_then(|v| v.as_i64()).unwrap_or(0);
            let score_b = b.get("total_score").and_then(|v| v.as_i64()).unwrap_or(0);
            score_b.cmp(&score_a)
        });

        return HttpResponse::Ok().json(sorted_scores);
    }

    // Se for caça-palavras, buscar de room_player_scores
    let scores = sqlx::query_as::<_, RoomPlayerScore>(
        "SELECT * FROM room_player_scores WHERE room_id = $1 ORDER BY total_score DESC"
    )
    .bind(*room_id)
    .fetch_all(pool.get_ref())
    .await;

    match scores {
        Ok(scores) => HttpResponse::Ok().json(scores),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    }
}

// Buscar detalhes de uma sala por ID (protegido)
pub async fn get_room_by_id(
    req: HttpRequest,
    room_id: web::Path<i32>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        })),
    };

    let room = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE id = $1"
    )
    .bind(*room_id)
    .fetch_optional(pool.get_ref())
    .await;

    match room {
        Ok(Some(room)) => HttpResponse::Ok().json(room),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Room not found"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    }
}

// Excluir uma sala (protegido)
pub async fn delete_room(
    req: HttpRequest,
    room_id: web::Path<i32>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        })),
    };

    // Verificar se o usuário é o criador da sala
    let room = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE id = $1"
    )
    .bind(*room_id)
    .fetch_optional(pool.get_ref())
    .await;

    let room = match room {
        Ok(Some(room)) => room,
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Room not found"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    };

    if room.created_by != user_id {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You are not the owner of this room"
        }));
    }

    // Excluir a sala (CASCADE vai excluir participantes, respostas, etc)
    let result = sqlx::query("DELETE FROM game_rooms WHERE id = $1")
        .bind(*room_id)
        .execute(pool.get_ref())
        .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Room deleted successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to delete room: {}", e)
        })),
    }
}

// Atualizar uma sala (protegido)
#[derive(Deserialize)]
pub struct UpdateRoomRequest {
    room_name: String,
    password: Option<String>,
    max_players: i32,
    reactivate: Option<bool>,
    duration_hours: Option<i32>,
}

pub async fn update_room(
    req: HttpRequest,
    room_id: web::Path<i32>,
    pool: web::Data<PgPool>,
    body: web::Json<UpdateRoomRequest>,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        })),
    };

    // Verificar se o usuário é o criador da sala
    let room = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE id = $1"
    )
    .bind(*room_id)
    .fetch_optional(pool.get_ref())
    .await;

    let room = match room {
        Ok(Some(room)) => room,
        Ok(None) => return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Room not found"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    };

    if room.created_by != user_id {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You are not the owner of this room"
        }));
    }

    // Verificar se já existe outra sala com esse nome no mesmo jogo
    let existing_name = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE game_id = $1 AND room_name = $2 AND id != $3 AND is_active = true"
    )
    .bind(room.game_id)
    .bind(&body.room_name)
    .bind(*room_id)
    .fetch_optional(pool.get_ref())
    .await;

    match existing_name {
        Ok(Some(_)) => return HttpResponse::Conflict().json(serde_json::json!({
            "error": "Já existe outra sala ativa com esse nome neste jogo"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
        _ => {}
    }

    // Atualizar a sala (com ou sem senha, com ou sem reativação, com ou sem ajuste de duração)
    let result = if body.reactivate == Some(true) {
        // Reativar sala com nova duração
        let duration_hours = body.duration_hours.unwrap_or(24);
        let new_expires_at = chrono::Utc::now() + chrono::Duration::hours(duration_hours as i64);

        if let Some(password) = &body.password {
            // Reativar com nova senha
            let password_hash = match bcrypt::hash(password, bcrypt::DEFAULT_COST) {
                Ok(hash) => hash,
                Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": format!("Password hashing error: {}", e)
                })),
            };

            sqlx::query(
                "UPDATE game_rooms SET room_name = $1, password_hash = $2, max_players = $3, is_active = true, expires_at = $4 WHERE id = $5"
            )
            .bind(&body.room_name)
            .bind(&password_hash)
            .bind(body.max_players)
            .bind(new_expires_at)
            .bind(*room_id)
            .execute(pool.get_ref())
            .await
        } else {
            // Reativar mantendo senha atual
            sqlx::query(
                "UPDATE game_rooms SET room_name = $1, max_players = $2, is_active = true, expires_at = $3 WHERE id = $4"
            )
            .bind(&body.room_name)
            .bind(body.max_players)
            .bind(new_expires_at)
            .bind(*room_id)
            .execute(pool.get_ref())
            .await
        }
    } else if body.duration_hours.is_some() {
        // Ajustar duração de sala ativa (sem reativação)
        let duration_hours = body.duration_hours.unwrap();
        let new_expires_at = chrono::Utc::now() + chrono::Duration::hours(duration_hours as i64);

        if let Some(password) = &body.password {
            // Ajustar duração com nova senha
            let password_hash = match bcrypt::hash(password, bcrypt::DEFAULT_COST) {
                Ok(hash) => hash,
                Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": format!("Password hashing error: {}", e)
                })),
            };

            sqlx::query(
                "UPDATE game_rooms SET room_name = $1, password_hash = $2, max_players = $3, expires_at = $4 WHERE id = $5"
            )
            .bind(&body.room_name)
            .bind(&password_hash)
            .bind(body.max_players)
            .bind(new_expires_at)
            .bind(*room_id)
            .execute(pool.get_ref())
            .await
        } else {
            // Ajustar duração mantendo senha atual
            sqlx::query(
                "UPDATE game_rooms SET room_name = $1, max_players = $2, expires_at = $3 WHERE id = $4"
            )
            .bind(&body.room_name)
            .bind(body.max_players)
            .bind(new_expires_at)
            .bind(*room_id)
            .execute(pool.get_ref())
            .await
        }
    } else if let Some(password) = &body.password {
        // Se senha foi fornecida, atualizar com hash (sem alteração de duração)
        let password_hash = match bcrypt::hash(password, bcrypt::DEFAULT_COST) {
            Ok(hash) => hash,
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Password hashing error: {}", e)
            })),
        };

        sqlx::query(
            "UPDATE game_rooms SET room_name = $1, password_hash = $2, max_players = $3 WHERE id = $4"
        )
        .bind(&body.room_name)
        .bind(&password_hash)
        .bind(body.max_players)
        .bind(*room_id)
        .execute(pool.get_ref())
        .await
    } else {
        // Se senha não foi fornecida e não há mudança de duração, mantém tudo atual
        sqlx::query(
            "UPDATE game_rooms SET room_name = $1, max_players = $2 WHERE id = $3"
        )
        .bind(&body.room_name)
        .bind(body.max_players)
        .bind(*room_id)
        .execute(pool.get_ref())
        .await
    };

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Room updated successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to update room: {}", e)
        })),
    }
}

pub async fn reset_room(
    req: HttpRequest,
    room_id: web::Path<i32>,
    pool: web::Data<PgPool>,
    room_manager: web::Data<crate::websocket::RoomManager>,
) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        })),
    };

    log::info!("Reset room {} requested by user {}", room_id, user_id);

    // Verificar se o usuário é o criador da sala
    let room = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE id = $1"
    )
    .bind(*room_id)
    .fetch_optional(pool.get_ref())
    .await;

    let room = match room {
        Ok(Some(room)) => room,
        Ok(None) => {
            log::warn!("Room {} not found", room_id);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Room not found"
            }))
        },
        Err(e) => {
            log::error!("Database error fetching room {}: {}", room_id, e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Database error: {}", e)
            }))
        },
    };

    if room.created_by != user_id {
        log::warn!("User {} is not the owner of room {}", user_id, room_id);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You are not the owner of this room"
        }));
    }

    log::info!("Starting reset for room {}", room_id);

    // Buscar informações da sala para determinar o tipo de jogo
    let room_info = sqlx::query_as::<_, GameRoom>(
        "SELECT * FROM game_rooms WHERE id = $1"
    )
    .bind(*room_id)
    .fetch_one(pool.get_ref())
    .await;

    let room = match room_info {
        Ok(room) => room,
        Err(e) => {
            log::error!("Failed to fetch room info: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to fetch room info: {}", e)
            }));
        }
    };

    // Buscar tipo do jogo
    let game_type: Result<(String,), sqlx::Error> = sqlx::query_as(
        "SELECT game_type FROM games WHERE id = $1"
    )
    .bind(room.game_id)
    .fetch_one(pool.get_ref())
    .await;

    let game_type = match game_type {
        Ok((gt,)) => gt,
        Err(e) => {
            log::warn!("Could not determine game type: {}", e);
            "word_search".to_string() // Default
        }
    };

    log::info!("Room {} is of type: {}", room_id, game_type);

    // Resetar todas as pontuações da sala
    let delete_results = sqlx::query("DELETE FROM game_results WHERE room_id = $1")
        .bind(*room_id)
        .execute(pool.get_ref())
        .await;

    if let Err(e) = delete_results {
        log::error!("Failed to delete game results for room {}: {}", room_id, e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to delete game results: {}", e)
        }));
    }
    log::info!("Game results deleted for room {}", room_id);

    // Resetar progresso de quiz
    let delete_progress = sqlx::query("DELETE FROM quiz_progress WHERE room_id = $1")
        .bind(*room_id)
        .execute(pool.get_ref())
        .await;

    if let Err(e) = delete_progress {
        log::error!("Failed to delete quiz progress for room {}: {}", room_id, e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to delete quiz progress: {}", e)
        }));
    }
    log::info!("Quiz progress deleted for room {}", room_id);

    // Resetar respostas do caça-palavras
    let delete_answers = sqlx::query("DELETE FROM room_answers WHERE room_id = $1")
        .bind(*room_id)
        .execute(pool.get_ref())
        .await;

    if let Err(e) = delete_answers {
        log::error!("Failed to delete room answers for room {}: {}", room_id, e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to delete room answers: {}", e)
        }));
    }
    log::info!("Room answers deleted for room {}", room_id);

    // Resetar palavras encontradas do caça-palavras
    let delete_found_words = sqlx::query("DELETE FROM room_found_words WHERE room_id = $1")
        .bind(*room_id)
        .execute(pool.get_ref())
        .await;

    if let Err(e) = delete_found_words {
        log::error!("Failed to delete room found words for room {}: {}", room_id, e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to delete room found words: {}", e)
        }));
    }
    log::info!("Room found words deleted for room {}", room_id);

    // Resetar pontuações dos jogadores
    let delete_player_scores = sqlx::query("DELETE FROM room_player_scores WHERE room_id = $1")
        .bind(*room_id)
        .execute(pool.get_ref())
        .await;

    if let Err(e) = delete_player_scores {
        log::error!("Failed to delete room player scores for room {}: {}", room_id, e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to delete room player scores: {}", e)
        }));
    }
    log::info!("Room player scores deleted for room {}", room_id);

    // Remover todos os participantes
    let delete_participants = sqlx::query("DELETE FROM room_participants WHERE room_id = $1")
        .bind(*room_id)
        .execute(pool.get_ref())
        .await;

    if let Err(e) = delete_participants {
        log::error!("Failed to delete participants for room {}: {}", room_id, e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to delete participants: {}", e)
        }));
    }
    log::info!("Participants deleted for room {}", room_id);

    // Limpeza específica por tipo de jogo
    match game_type.as_str() {
        "kahoot" => {
            // Limpar respostas do Kahoot usando game_id associado ao room
            // Note: Kahoot usa game_id próprio, não room_id
            log::info!("Cleaning Kahoot-specific data for room {}", room_id);
            
            // Buscar kahoot_game_id associado (se houver)
            // Por enquanto, kahoot usa sistema separado, então pode não ter nada
        },
        "open_question" => {
            // Limpar respostas do Open Question usando room_name
            log::info!("Cleaning Open Question data for room {}", room_id);
            
            let delete_open_responses = sqlx::query(
                "DELETE FROM open_question_responses WHERE room_name = $1"
            )
            .bind(&room.room_name)
            .execute(pool.get_ref())
            .await;
            
            match delete_open_responses {
                Ok(result) => log::info!("Open Question responses deleted: {} rows", result.rows_affected()),
                Err(e) => log::warn!("Failed to delete Open Question responses: {}", e),
            }
        },
        _ => {
            // Word search, quiz, etc já foram limpos acima
            log::info!("Standard game type, generic cleanup applied");
        }
    }

    // Resetar o cronômetro (zerando started_at, paused_at, etc)
    let reset_timer = sqlx::query(
        "UPDATE game_rooms SET started_at = NULL, paused_at = NULL, total_pause_duration = NULL, completed_at = NULL, completion_time = NULL WHERE id = $1"
    )
    .bind(*room_id)
    .execute(pool.get_ref())
    .await;

    match reset_timer {
        Ok(_) => {
            log::info!("Room {} reset successfully", room_id);
            
            // Notificar todos os jogadores conectados via WebSocket
            let manager = room_manager.lock().unwrap();
            if let Some(connections) = manager.get(&(*room_id)) {
                let message = crate::websocket::WsMessage::RoomReset {
                    reset_by: format!("user_{}", user_id),
                };
                let text = serde_json::to_string(&message).unwrap();
                
                log::info!("🔊 Broadcasting RoomReset to room {}: {} connections", room_id, connections.len());
                
                for conn_info in connections.iter() {
                    conn_info.addr.do_send(crate::websocket::SendMessage {
                        text: text.clone(),
                    });
                }
                
                log::info!("✅ Room reset broadcast sent to {} connections", connections.len());
            } else {
                log::warn!("No active connections in room {}", room_id);
            }
            drop(manager);
            
            HttpResponse::Ok().json(serde_json::json!({
                "message": "Room reset successfully"
            }))
        },
        Err(e) => {
            log::error!("Failed to reset room timer for room {}: {}", room_id, e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to reset room timer: {}", e)
            }))
        },
    }
}
