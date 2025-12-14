use actix::{Actor, StreamHandler, Handler, Message as ActixMessage, Context, AsyncContext, Addr, ActorContext};
use actix_web::{web, HttpRequest, HttpResponse, Error, HttpMessage};
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

// Mensagens do WebSocket
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsMessage {
    WordFound {
        word: String,
        cells: Vec<CellPosition>,
        #[serde(skip_serializing_if = "Option::is_none")]
        player_id: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        player_color: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        player_name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "foundAt")]
        found_at: Option<i32>,  // Tempo em segundos quando a palavra foi encontrada
    },
    QuizAnswer {
        question_index: i32,
        answer: String,
        player_id: i32,
        player_name: String,
    },
    QuizConsensus {
        question_index: i32,
        answer: String,
        votes: i32,
        total_players: i32,
    },
    QuizAdvance {
        question_index: i32,
    },
    QuizTimerSync {
        elapsed_time: i32,  // Tempo decorrido em segundos
        player_id: i32,
    },
    QuizCurrentQuestion {
        question_index: i32,
        player_id: i32,
    },
    QuizFinished {
        player_id: i32,
    },
    PlayerJoined {
        username: String,
        player_id: i32,
    },
    PlayerLeft {
        username: String,
        player_id: i32,
    },
    PlayersList {
        players: Vec<PlayerInfo>,
    },
    RoomReset {
        reset_by: String,  // Nome do usuário que resetou
    },
    QuizVoteState {
        // Estado completo dos votos para sincronização
        votes: serde_json::Value,  // { "0": { "A": [{"player_id": 1, "player_name": "João"}], "B": [...] }, "1": {...} }
    },
    GameState {
        // Para sincronizar estado do jogo
        data: serde_json::Value,
    },
    OpenQuestionResponse {
        question_id: i32,
        response_text: String,
        player_name: Option<String>,
        room_name: Option<String>,
        created_at: String,
    },
    OpenQuestionToggle {
        question_id: i32,
        is_open: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerInfo {
    pub player_id: i32,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellPosition {
    pub row: i32,
    pub col: i32,
}

// Estrutura para armazenar conexão com info do jogador
pub struct ConnectionInfo {
    pub addr: Addr<GameWebSocket>,
    pub player_id: i32,
    pub username: String,
    pub session_id: String,
}

// Gerenciador de salas
pub type RoomManager = Arc<Mutex<HashMap<i32, Vec<ConnectionInfo>>>>;

// Gerenciador de votos (room_id -> votos)
pub type VotesManager = Arc<Mutex<HashMap<i32, serde_json::Value>>>;

// Mensagem para broadcast
#[derive(ActixMessage, Clone)]
#[rtype(result = "()")]
pub struct BroadcastMessage {
    pub room_id: i32,
    pub message: WsMessage,
    pub exclude_user: Option<i32>,
}

// Actor WebSocket
pub struct GameWebSocket {
    pub room_id: i32,
    pub user_id: i32,
    pub username: String,
    pub player_color: String,
    pub session_id: String,
    pub room_manager: RoomManager,
    pub pool: sqlx::PgPool,
}

impl Actor for GameWebSocket {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        log::info!("WebSocket started for user {} in room {}", self.user_id, self.room_id);
        
        // Adicionar à lista de conexões da sala e coletar lista de jogadores existentes
        let (was_empty, existing_players) = {
            let mut manager = self.room_manager.lock().unwrap();
            let connections = manager.entry(self.room_id).or_insert_with(Vec::new);
            let was_empty = connections.is_empty();
            
            // Remover conexões antigas do mesmo session_id (reconexão)
            connections.retain(|conn| conn.session_id != self.session_id);
            
            // Coletar lista de jogadores já conectados (após remoção de duplicatas)
            let existing_players: Vec<PlayerInfo> = connections.iter()
                .map(|conn| PlayerInfo {
                    player_id: conn.player_id,
                    username: conn.username.clone(),
                })
                .collect();
            
            // Adicionar nova conexão
            connections.push(ConnectionInfo {
                addr: ctx.address(),
                player_id: self.user_id,
                username: self.username.clone(),
                session_id: self.session_id.clone(),
            });
            
            (was_empty, existing_players)
        };
        
        // Enviar lista de jogadores já conectados APENAS para o novo jogador
        if !existing_players.is_empty() {
            ctx.text(serde_json::to_string(&WsMessage::PlayersList {
                players: existing_players,
            }).unwrap());
        }
        
        // Notificar TODOS que um novo jogador entrou
        self.broadcast(WsMessage::PlayerJoined {
            player_id: self.user_id,
            username: self.username.clone(),
        }, None);
        
        // Se é a primeira conexão, iniciar/retomar timer
        if was_empty {
            let room_id = self.room_id;
            let pool = self.pool.clone();
            
            actix::spawn(async move {
                // Verificar se estava pausado
                let pause_info = sqlx::query_as::<_, (Option<chrono::DateTime<chrono::Utc>>, Option<i32>)>(
                    "SELECT paused_at, total_pause_duration FROM game_rooms WHERE id = $1"
                )
                .bind(room_id)
                .fetch_one(&pool)
                .await;

                if let Ok((paused_at, total_pause)) = pause_info {
                    if let Some(pause_time) = paused_at {
                        // Calcular quanto tempo ficou pausado
                        let pause_duration = (chrono::Utc::now() - pause_time).num_seconds() as i32;
                        let total_pause_duration = total_pause.unwrap_or(0) + pause_duration;
                        
                        // Atualizar total de pausa e limpar paused_at
                        let _ = sqlx::query(
                            "UPDATE game_rooms 
                             SET paused_at = NULL, total_pause_duration = $1 
                             WHERE id = $2"
                        )
                        .bind(total_pause_duration)
                        .bind(room_id)
                        .execute(&pool)
                        .await;
                        
                        log::info!("Room {} resumed via WebSocket. Pause duration: {}s, Total pause: {}s", 
                            room_id, pause_duration, total_pause_duration);
                    } else {
                        // Primeira vez entrando, iniciar timer
                        let _ = sqlx::query(
                            "UPDATE game_rooms SET started_at = NOW() WHERE id = $1 AND started_at IS NULL"
                        )
                        .bind(room_id)
                        .execute(&pool)
                        .await;
                        
                        log::info!("Room {} timer started via WebSocket", room_id);
                    }
                }
            });
        }
    }

    fn stopped(&mut self, ctx: &mut Self::Context) {
        log::info!("WebSocket stopped for user {} in room {}", self.user_id, self.room_id);
        
        // Notificar todos que um jogador saiu
        self.broadcast(WsMessage::PlayerLeft {
            player_id: self.user_id,
            username: self.username.clone(),
        }, None);
        
        // Remover da lista de conexões
        let remaining_connections = {
            let mut manager = self.room_manager.lock().unwrap();
            if let Some(connections) = manager.get_mut(&self.room_id) {
                let before = connections.len();
                connections.retain(|conn| conn.addr != ctx.address());
                let after = connections.len();
                log::info!("🔌 Removendo conexão da sala {}. Antes: {}, Depois: {}", self.room_id, before, after);
                if after == 0 {
                    manager.remove(&self.room_id);
                }
                after
            } else {
                0
            }
        };
        
        // Se não há mais conexões, pausar o timer
        if remaining_connections == 0 {
            let room_id = self.room_id;
            let pool = self.pool.clone();
            
            actix::spawn(async move {
                let _ = sqlx::query(
                    "UPDATE game_rooms SET paused_at = NOW() WHERE id = $1"
                )
                .bind(room_id)
                .execute(&pool)
                .await;
                
                log::info!("Room {} timer paused (all players left)", room_id);
            });
        }
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for GameWebSocket {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                log::info!("Received WebSocket text message: {}", text);
                // Parse mensagem recebida
                match serde_json::from_str::<WsMessage>(&text) {
                    Ok(mut ws_msg) => {
                        log::info!("Parsed WS message: {:?}", ws_msg);
                    
                    // Adicionar player_id e player_color nas mensagens WordFound
                    ws_msg = match ws_msg {
                        WsMessage::WordFound { word, cells, found_at, .. } => {
                            let word_msg = WsMessage::WordFound {
                                word: word.clone(),
                                cells: cells.clone(),
                                player_id: Some(self.user_id),
                                player_color: Some(self.player_color.clone()),
                                player_name: Some(self.username.clone()),
                                found_at,
                            };
                            
                            // Salvar palavra encontrada no banco de dados
                            let room_id = self.room_id;
                            let session_id = self.session_id.clone();
                            let player_name = self.username.clone();
                            let player_color = self.player_color.clone();
                            let pool = self.pool.clone();
                            
                            actix::spawn(async move {
                                let cells_json = serde_json::to_value(&cells).unwrap();
                                let word_upper = word.to_uppercase();
                                
                                // Salvar palavra encontrada
                                let result = sqlx::query(
                                    "INSERT INTO room_found_words 
                                     (room_id, word, found_by_session_id, found_by_name, player_color, cells)
                                     VALUES ($1, $2, $3, $4, $5, $6)
                                     ON CONFLICT (room_id, word) DO NOTHING"
                                )
                                .bind(room_id)
                                .bind(&word_upper)
                                .bind(&session_id)
                                .bind(&player_name)
                                .bind(&player_color)
                                .bind(&cells_json)
                                .execute(&pool)
                                .await;
                                
                                if let Err(e) = result {
                                    log::error!("Error saving found word: {}", e);
                                    return;
                                }
                                
                                // Calcular pontuação da palavra baseada no tempo
                                // Pontuação diminui gradualmente:
                                // 0-60s: 100 pontos (100%)
                                // 61-300s (5min): diminui de 100 para 50 (50%)
                                // 301-600s (10min): diminui de 50 para 20 (20%)
                                // Acima de 600s: 10 pontos (mínimo)
                                log::info!("💰 Calculando pontuação - found_at: {:?}", found_at);
                                let total_score = if let Some(found_at) = found_at {
                                    if found_at <= 60 {
                                        100  // Primeiro minuto: 100 pontos
                                    } else if found_at <= 300 {
                                        // De 1 a 5 minutos: diminui de 100 para 50
                                        let elapsed = found_at - 60;  // 0 a 240 segundos
                                        let reduction = (elapsed as f32 / 240.0) * 50.0;  // 0 a 50 pontos de redução
                                        (100.0 - reduction).floor() as i32
                                    } else if found_at <= 600 {
                                        // De 5 a 10 minutos: diminui de 50 para 20
                                        let elapsed = found_at - 300;  // 0 a 300 segundos
                                        let reduction = (elapsed as f32 / 300.0) * 30.0;  // 0 a 30 pontos de redução
                                        (50.0 - reduction).floor() as i32
                                    } else {
                                        10  // Acima de 10 minutos: pontuação mínima
                                    }
                                } else {
                                    log::warn!("⚠️ found_at é None, usando pontuação máxima");
                                    100  // Se não tiver tempo, pontuação máxima
                                };
                                log::info!("💰 Pontuação calculada: {} pontos (tempo: {:?}s)", total_score, found_at);
                                
                                // Atualizar pontuação do jogador
                                let _ = sqlx::query(
                                    "INSERT INTO room_player_scores 
                                     (room_id, session_id, player_name, player_color, words_found, total_score)
                                     VALUES ($1, $2, $3, $4, 1, $5)
                                     ON CONFLICT (room_id, session_id) 
                                     DO UPDATE SET 
                                        words_found = room_player_scores.words_found + 1,
                                        total_score = room_player_scores.total_score + $5,
                                        last_updated = NOW()"
                                )
                                .bind(room_id)
                                .bind(&session_id)
                                .bind(&player_name)
                                .bind(&player_color)
                                .bind(total_score)
                                .execute(&pool)
                                .await;
                                
                                // Atualizar pontuação total da sala
                                let _ = sqlx::query(
                                    "UPDATE game_rooms 
                                     SET total_score = COALESCE(total_score, 0) + $1
                                     WHERE id = $2"
                                )
                                .bind(total_score)
                                .bind(room_id)
                                .execute(&pool)
                                .await;
                            });
                            
                            word_msg
                        },
                        WsMessage::QuizAnswer { question_index, answer, player_id, player_name } => {
                            let quiz_msg = WsMessage::QuizAnswer {
                                question_index,
                                answer: answer.clone(),
                                player_id,
                                player_name: player_name.clone(),
                            };
                            
                            // Processar votação do quiz
                            let room_id = self.room_id;
                            let room_manager = self.room_manager.clone();
                            
                            actix::spawn(async move {
                                // Contar votos atuais
                                let manager = room_manager.lock().unwrap();
                                let total_players = if let Some(connections) = manager.get(&room_id) {
                                    connections.len() as i32
                                } else {
                                    return;
                                };
                                drop(manager);
                                
                                // Aqui você pode salvar o voto em memória ou banco
                                // Por simplicidade, vamos apenas broadcast e deixar o frontend gerenciar
                                
                                log::info!("Quiz vote - Room {}, Question {}, Answer {}, Total players: {}", 
                                    room_id, question_index, answer, total_players);
                            });
                            
                            quiz_msg
                        },
                        WsMessage::QuizAdvance { question_index } => {
                            // Repassar sinal de avanço para todos
                            WsMessage::QuizAdvance { question_index }
                        },
                        WsMessage::QuizTimerSync { elapsed_time, player_id } => {
                            // Repassar sincronização de timer para todos
                            WsMessage::QuizTimerSync { elapsed_time, player_id }
                        },
                        other => other,
                    };
                    
                    // Broadcast para todos na sala
                    self.broadcast(ws_msg, Some(self.user_id));
                    },
                    Err(e) => {
                        log::error!("Failed to parse WebSocket message: {}. Raw text: {}", e, text);
                    }
                }
            }
            Ok(ws::Message::Binary(_)) => {},
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => {}
        }
    }
}

impl GameWebSocket {
    fn broadcast(&self, message: WsMessage, exclude_user: Option<i32>) {
        let manager = self.room_manager.lock().unwrap();
        if let Some(connections) = manager.get(&self.room_id) {
            let text = serde_json::to_string(&message).unwrap();
            
            log::info!("🔊 Broadcasting to room {}: {} connections. Message type: {:?}", 
                self.room_id, connections.len(), message);
            
            // Enviar para todos os jogadores na sala
            for (index, conn_info) in connections.iter().enumerate() {
                log::info!("📤 Enviando para conexão {} da sala {}", index, self.room_id);
                conn_info.addr.do_send(SendMessage {
                    text: text.clone(),
                });
            }
            
            log::info!("✅ Broadcast concluído para {} conexões", connections.len());
        } else {
            log::warn!("⚠️ Sala {} não encontrada no manager", self.room_id);
        }
    }
}

// Mensagem para enviar texto
#[derive(ActixMessage)]
#[rtype(result = "()")]
pub struct SendMessage {
    pub text: String,
}

impl Handler<SendMessage> for GameWebSocket {
    type Result = ();

    fn handle(&mut self, msg: SendMessage, ctx: &mut Self::Context) {
        ctx.text(msg.text);
    }
}

// Endpoint WebSocket
pub async fn room_websocket(
    req: HttpRequest,
    stream: web::Payload,
    room_id: web::Path<i32>,
    room_manager: web::Data<RoomManager>,
    pool: web::Data<sqlx::PgPool>,
) -> Result<HttpResponse, Error> {
    // Tentar extrair user_id do token (usuário autenticado)
    let mut user_id_from_token = req.extensions().get::<i32>().copied();
    
    // Se não veio pelo middleware (header), tentar extrair do query parameter
    if user_id_from_token.is_none() {
        if let Some(token_param) = req.uri().query().and_then(|q| {
            url::form_urlencoded::parse(q.as_bytes())
                .find(|(key, _)| key == "token")
                .map(|(_, value)| value.to_string())
        }) {
            // Validar token
            use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
            
            let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
            let mut validation = Validation::new(Algorithm::HS256);
            validation.validate_exp = true;
            
            if let Ok(token_data) = decode::<serde_json::Value>(
                &token_param,
                &DecodingKey::from_secret(jwt_secret.as_bytes()),
                &validation,
            ) {
                // Tentar pegar "sub" ou "user_id" do token
                if let Some(user_id) = token_data.claims.get("sub")
                    .and_then(|v| v.as_i64())
                    .or_else(|| token_data.claims.get("user_id").and_then(|v| v.as_i64())) 
                {
                    user_id_from_token = Some(user_id as i32);
                }
            }
        }
    }
    
    // Tentar extrair session_id do query parameter (jogador anônimo)
    // WebSocket do navegador não suporta headers customizados
    let session_id = req
        .uri()
        .query()
        .and_then(|q| {
            url::form_urlencoded::parse(q.as_bytes())
                .find(|(key, _)| key == "session_id")
                .map(|(_, value)| value.to_string())
        });
    
    // Buscar participante (autenticado ou anônimo)
    let participant_result = if let Some(user_id) = user_id_from_token {
        // Usuário autenticado
        sqlx::query_as::<_, (String, Option<String>)>(
            r#"
            SELECT u.name, rp.player_color
            FROM room_participants rp
            JOIN users u ON u.id = rp.user_id
            WHERE rp.room_id = $1 AND rp.user_id = $2
            "#
        )
        .bind(*room_id)
        .bind(user_id)
        .fetch_optional(pool.get_ref())
        .await
    } else if let Some(ref sid) = session_id {
        // Jogador anônimo
        log::info!("🔍 Buscando jogador anônimo - room_id: {}, session_id: {}", room_id, sid);
        let result = sqlx::query_as::<_, (String, Option<String>)>(
            r#"
            SELECT COALESCE(rp.player_name, 'Anônimo'), rp.player_color
            FROM room_participants rp
            WHERE rp.room_id = $1 AND rp.session_id = $2
            "#
        )
        .bind(*room_id)
        .bind(sid)
        .fetch_optional(pool.get_ref())
        .await;
        
        log::info!("🔍 Resultado da busca: {:?}", result);
        result
    } else {
        return Err(actix_web::error::ErrorUnauthorized("No authentication provided"));
    };
    
    let (username, player_color) = match participant_result {
        Ok(Some((name, color))) => {
            log::info!("✅ Jogador encontrado: {} (cor: {:?})", name, color);
            (
                name,
                color.unwrap_or_else(|| "#10B981".to_string())
            )
        },
        Ok(None) => {
            log::warn!("⚠️ Nenhum participante encontrado no banco");
            ("Unknown".to_string(), "#10B981".to_string())
        },
        Err(e) => {
            log::error!("❌ Erro ao buscar participante: {}", e);
            ("Unknown".to_string(), "#10B981".to_string())
        }
    };
    
    let session_id_str = session_id.clone().unwrap_or_else(|| format!("user_{}", user_id_from_token.unwrap_or(0)));
    
    // Para anônimos, gerar um player_id único baseado no session_id
    let player_id = if let Some(uid) = user_id_from_token {
        uid
    } else if let Some(ref sid) = session_id {
        // Gerar ID único do hash do session_id
        let hash = sid.chars().fold(0i32, |acc, c| acc.wrapping_add(c as i32));
        hash.abs() % 1000000 + 1 // ID entre 1 e 1000000
    } else {
        0
    };
    
    let ws = GameWebSocket {
        room_id: *room_id,
        user_id: player_id,  // Usar player_id gerado
        username,
        player_color,
        session_id: session_id_str,
        room_manager: room_manager.get_ref().clone(),
        pool: pool.get_ref().clone(),
    };
    
    ws::start(ws, &req, stream)
}
