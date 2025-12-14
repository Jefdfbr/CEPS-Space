use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use validator::Validate;
use serde_json::Value as JsonValue;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: i32,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub name: String,
    pub is_admin: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 6))]
    pub password: String,
    #[validate(length(min = 2))]
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i32,
    pub email: String,
    pub exp: usize,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Game {
    pub id: i32,
    pub name: String,
    pub game_type: String,
    pub description: Option<String>,
    pub created_by: Option<i32>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub end_screen_text: Option<String>,
    pub end_screen_button_text: Option<String>,
    pub end_screen_button_url: Option<String>,
    pub end_screen_button_new_tab: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateGameRequest {
    #[validate(length(min = 3, max = 100))]
    pub name: String,
    pub game_type: String, // "word_search" ou "quiz"
    pub description: Option<String>,
    pub is_active: Option<bool>,
    pub end_screen_text: Option<String>,
    pub end_screen_button_text: Option<String>,
    pub end_screen_button_url: Option<String>,
    pub end_screen_button_new_tab: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct UpdateGameRequest {
    #[validate(length(min = 3, max = 100))]
    pub name: String,
    pub game_type: String,
    pub description: Option<String>,
    pub is_active: Option<bool>,
    pub end_screen_text: Option<String>,
    pub end_screen_button_text: Option<String>,
    pub end_screen_button_url: Option<String>,
    pub end_screen_button_new_tab: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct WordSearchConfig {
    pub id: i32,
    pub game_id: i32,
    pub grid_size: i32,
    pub words: Vec<String>,
    pub time_limit: Option<i32>,
    pub allowed_directions: Option<serde_json::Value>,
    pub concepts: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateWordSearchRequest {
    pub game_id: i32,
    #[validate(range(min = 10, max = 20))]
    pub grid_size: i32,
    #[validate(length(min = 1, max = 20))]
    pub words: Vec<String>,
    pub time_limit: Option<i32>,
    pub allowed_directions: Option<serde_json::Value>,
    pub concepts: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct QuizConfig {
    pub id: i32,
    pub game_id: i32,
    pub time_limit: Option<i32>,
    pub end_screen_text: Option<String>,
    pub end_screen_button_text: Option<String>,
    pub end_screen_button_url: Option<String>,
    pub end_screen_button_new_tab: Option<bool>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct QuizQuestion {
    pub id: i32,
    pub quiz_config_id: i32,
    pub question: String,
    pub option_a: String,
    pub option_b: String,
    pub option_c: String,
    pub option_d: String,
    pub correct_option: String,
    pub justification: Option<String>,
    pub points: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateQuizConfigRequest {
    pub game_id: i32,
    pub time_limit: Option<i32>,
    pub end_screen_text: Option<String>,
    pub end_screen_button_text: Option<String>,
    pub end_screen_button_url: Option<String>,
    pub end_screen_button_new_tab: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateQuizQuestionRequest {
    #[validate(length(min = 5))]
    pub question: String,
    pub option_a: String,
    pub option_b: String,
    pub option_c: String,
    pub option_d: String,
    pub correct_option: String, // "A", "B", "C", ou "D"
    pub justification: Option<String>,
    pub points: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct GameSession {
    pub id: i32,
    pub game_id: i32,
    pub session_code: String,
    pub password: Option<String>,
    pub is_active: bool,
    pub max_players: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateSessionRequest {
    pub game_id: i32,
    pub password: Option<String>,
    pub max_players: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JoinSessionRequest {
    pub session_code: String,
    pub password: Option<String>,
    pub player_name: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct GameResult {
    pub id: i32,
    pub session_id: i32,
    pub player_name: String,
    pub score: i32,
    pub completed_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitScoreRequest {
    pub session_id: i32,
    pub player_name: String,
    pub score: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
}

// Room Models
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct GameRoom {
    pub id: i32,
    pub game_id: i32,
    pub room_code: String,
    pub room_name: String,
    pub password_hash: Option<String>,
    pub max_players: i32,
    pub is_active: bool,
    pub created_by: i32,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub game_seed: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub paused_at: Option<DateTime<Utc>>,
    pub total_pause_duration: Option<i32>,
    pub total_score: Option<i32>,
    pub completed_at: Option<DateTime<Utc>>,
    pub completion_time: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateRoomRequest {
    pub game_id: i32,
    #[validate(length(min = 3, max = 100))]
    pub room_name: String,
    pub password: Option<String>,
    #[validate(range(min = 2, max = 100))]
    pub max_players: Option<i32>,
    pub duration_hours: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JoinRoomRequest {
    pub room_code: String,
    pub password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct JoinRoomAnonymousRequest {
    #[validate(length(min = 4, max = 10))]
    pub room_code: String,
    pub password: Option<String>,
    #[validate(length(min = 2, max = 50))]
    pub player_name: String,
    pub existing_session_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnonymousSessionResponse {
    pub session_id: String,
    pub room_id: i32,
    pub room_code: String,
    pub player_name: String,
    pub player_color: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RoomParticipant {
    pub id: i32,
    pub room_id: i32,
    pub user_id: Option<i32>,
    pub session_id: Option<String>,
    pub player_name: Option<String>,
    pub joined_at: DateTime<Utc>,
    pub is_host: bool,
    pub player_color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoomParticipantInfo {
    pub id: i32,
    pub user_id: Option<i32>,
    pub name: String,
    pub joined_at: DateTime<Utc>,
    pub is_host: bool,
    pub player_color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RoomAnswer {
    pub id: i32,
    pub room_id: i32,
    pub user_id: i32,
    pub game_type: String,
    pub answer_data: serde_json::Value,
    pub score: i32,
    pub completed_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitRoomAnswerRequest {
    pub answer_data: serde_json::Value,
    pub score: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoomDetailsResponse {
    pub room: GameRoom,
    pub game: Game,
    pub participants: Vec<RoomParticipantInfo>,
    pub is_participant: bool,
    pub is_host: bool,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RoomFoundWord {
    pub id: i32,
    pub room_id: i32,
    pub word: String,
    pub found_by_session_id: String,
    pub found_by_name: String,
    pub player_color: String,
    pub cells: JsonValue,
    pub found_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RoomPlayerScore {
    pub id: i32,
    pub room_id: i32,
    pub session_id: String,
    pub player_name: String,
    pub player_color: String,
    pub words_found: i32,
    pub total_score: i32,
    pub last_updated: DateTime<Utc>,
}
