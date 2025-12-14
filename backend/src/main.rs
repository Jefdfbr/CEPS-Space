mod db;
mod models;
mod handlers;
mod middleware;
mod websocket;

use actix_web::{web, App, HttpServer, middleware::Logger};
use actix_cors::Cors;
use dotenv::dotenv;
use std::env;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    env_logger::init();

    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());

    log::info!("Connecting to database...");
    let pool = db::create_pool().await.expect("Failed to create pool");
    log::info!("Database connected!");
    
    // Executar migrations
    log::info!("Running migrations...");
    let create_table = "
        CREATE TABLE IF NOT EXISTS quiz_progress (
            id SERIAL PRIMARY KEY,
            room_id INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
            user_identifier VARCHAR(255) NOT NULL,
            progress_data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(room_id, user_identifier)
        )";
    
    let create_index = "CREATE INDEX IF NOT EXISTS idx_quiz_progress_room_user ON quiz_progress(room_id, user_identifier)";
    
    let add_justification = "ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS justification TEXT";
    
    let add_points = "ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 100";
    
    let add_concepts = "ALTER TABLE word_search_configs ADD COLUMN IF NOT EXISTS concepts JSONB DEFAULT '{}'::jsonb";
    
    let create_game_results = "
        CREATE TABLE IF NOT EXISTS game_results (
            id SERIAL PRIMARY KEY,
            game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            room_id INTEGER REFERENCES game_rooms(id) ON DELETE CASCADE,
            time_seconds INTEGER NOT NULL,
            score INTEGER NOT NULL,
            completed BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )";
    
    let drop_game_results = "DROP TABLE IF EXISTS game_results CASCADE";
    
    let create_results_index = "CREATE INDEX IF NOT EXISTS idx_game_results_game_user ON game_results(game_id, user_id)";
    let create_results_room_index = "CREATE INDEX IF NOT EXISTS idx_game_results_room ON game_results(room_id)";
    
    match sqlx::query(create_table).execute(&pool).await {
        Ok(_) => log::info!("Table quiz_progress created/verified"),
        Err(e) => log::warn!("Table creation error: {}", e),
    }
    
    match sqlx::query(create_index).execute(&pool).await {
        Ok(_) => log::info!("Index created/verified"),
        Err(e) => log::warn!("Index creation error: {}", e),
    }
    
    match sqlx::query(add_justification).execute(&pool).await {
        Ok(_) => log::info!("Column justification added/verified"),
        Err(e) => log::warn!("Column addition error: {}", e),
    }
    
    match sqlx::query(add_points).execute(&pool).await {
        Ok(_) => log::info!("Column points added/verified"),
        Err(e) => log::warn!("Add points column error: {}", e),
    }
    
    match sqlx::query(add_concepts).execute(&pool).await {
        Ok(_) => log::info!("Column concepts added/verified"),
        Err(e) => log::warn!("Add concepts column error: {}", e),
    }
    
    // Recriar tabela game_results para garantir estrutura correta
    match sqlx::query(drop_game_results).execute(&pool).await {
        Ok(_) => log::info!("Table game_results dropped (se existia)"),
        Err(e) => log::warn!("Drop game_results error: {}", e),
    }
    
    match sqlx::query(create_game_results).execute(&pool).await {
        Ok(_) => log::info!("Table game_results created"),
        Err(e) => log::warn!("Create game_results table error: {}", e),
    }
    
    match sqlx::query(create_results_index).execute(&pool).await {
        Ok(_) => log::info!("Index idx_game_results_game_user created/verified"),
        Err(e) => log::warn!("Create results index error: {}", e),
    }
    
    match sqlx::query(create_results_room_index).execute(&pool).await {
        Ok(_) => log::info!("Index idx_game_results_room created/verified"),
        Err(e) => log::warn!("Create results room index error: {}", e),
    }
    
    // Open Question tables - Create if not exists (removed DROP to preserve data)
    let create_open_question_games = "
        CREATE TABLE IF NOT EXISTS open_question_games (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            game_password VARCHAR(255) NOT NULL,
            presenter_password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )";
    
    let create_open_question_questions = "
        CREATE TABLE IF NOT EXISTS open_question_questions (
            id SERIAL PRIMARY KEY,
            game_id INTEGER NOT NULL REFERENCES open_question_games(id) ON DELETE CASCADE,
            question_text TEXT NOT NULL,
            order_index INTEGER NOT NULL,
            is_open BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW()
        )";
    
    let create_open_question_responses = "
        CREATE TABLE IF NOT EXISTS open_question_responses (
            id SERIAL PRIMARY KEY,
            question_id INTEGER NOT NULL REFERENCES open_question_questions(id) ON DELETE CASCADE,
            response_text TEXT NOT NULL,
            player_name VARCHAR(255),
            room_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW()
        )";
    
    let create_oqg_user_index = "CREATE INDEX IF NOT EXISTS idx_open_question_games_user ON open_question_games(user_id)";
    let create_oqq_game_index = "CREATE INDEX IF NOT EXISTS idx_open_question_questions_game ON open_question_questions(game_id)";
    let create_oqq_order_index = "CREATE INDEX IF NOT EXISTS idx_open_question_questions_order ON open_question_questions(game_id, order_index)";
    let create_oqr_question_index = "CREATE INDEX IF NOT EXISTS idx_open_question_responses_question ON open_question_responses(question_id)";
    let create_oqr_created_index = "CREATE INDEX IF NOT EXISTS idx_open_question_responses_created ON open_question_responses(question_id, created_at)";
    
    match sqlx::query(create_open_question_games).execute(&pool).await {
        Ok(_) => log::info!("Table open_question_games created/verified"),
        Err(e) => log::warn!("Create open_question_games table error: {}", e),
    }
    
    match sqlx::query(create_open_question_questions).execute(&pool).await {
        Ok(_) => log::info!("Table open_question_questions created/verified"),
        Err(e) => log::warn!("Create open_question_questions table error: {}", e),
    }
    
    match sqlx::query(create_open_question_responses).execute(&pool).await {
        Ok(_) => log::info!("Table open_question_responses created/verified"),
        Err(e) => log::warn!("Create open_question_responses table error: {}", e),
    }
    
    match sqlx::query(create_oqg_user_index).execute(&pool).await {
        Ok(_) => log::info!("Index idx_open_question_games_user created/verified"),
        Err(e) => log::warn!("Create open_question_games user index error: {}", e),
    }
    
    match sqlx::query(create_oqq_game_index).execute(&pool).await {
        Ok(_) => log::info!("Index idx_open_question_questions_game created/verified"),
        Err(e) => log::warn!("Create open_question_questions game index error: {}", e),
    }
    
    match sqlx::query(create_oqq_order_index).execute(&pool).await {
        Ok(_) => log::info!("Index idx_open_question_questions_order created/verified"),
        Err(e) => log::warn!("Create open_question_questions order index error: {}", e),
    }
    
    match sqlx::query(create_oqr_question_index).execute(&pool).await {
        Ok(_) => log::info!("Index idx_open_question_responses_question created/verified"),
        Err(e) => log::warn!("Create open_question_responses question index error: {}", e),
    }
    
    match sqlx::query(create_oqr_created_index).execute(&pool).await {
        Ok(_) => log::info!("Index idx_open_question_responses_created created/verified"),
        Err(e) => log::warn!("Create open_question_responses created index error: {}", e),
    }

    log::info!("Migrations completed!");
    log::info!("Starting server at {}:{}", host, port);

    // Criar gerenciador de salas WebSocket
    let room_manager = web::Data::new(Arc::new(Mutex::new(HashMap::<i32, Vec<websocket::ConnectionInfo>>::new())));

    HttpServer::new(move || {
        let cors = Cors::permissive();

        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(room_manager.clone())
            .wrap(cors)
            .wrap(Logger::default())
            // Public routes
            .route("/api/auth/register", web::post().to(handlers::auth::register))
            .route("/api/auth/login", web::post().to(handlers::auth::login))
            .route("/api/games", web::get().to(handlers::games::get_games))
            .route("/api/games/{id}", web::get().to(handlers::games::get_game))
            .route("/api/sessions/{code}", web::get().to(handlers::sessions::get_session))
            .route("/api/sessions/join", web::post().to(handlers::sessions::join_session))
            .route("/api/sessions/{id}/results", web::get().to(handlers::sessions::get_session_results))
            .route("/api/scores", web::post().to(handlers::sessions::submit_score))
            .route("/api/word-search/{game_id}", web::get().to(handlers::word_search::get_word_search_config))
            .route("/api/quiz/{game_id}", web::get().to(handlers::quiz::get_quiz_config))
            .route("/api/quiz/{game_id}/questions", web::get().to(handlers::quiz::get_quiz_questions))
            // Game results public routes
            .route("/api/game-results", web::post().to(handlers::game_results::create_game_result))
            .route("/api/game-results/{game_id}", web::get().to(handlers::game_results::get_game_result))
            .route("/api/game-results/{game_id}/{room_id}", web::get().to(handlers::game_results::get_game_result))
            // Room public routes
            .route("/api/rooms/join-anonymous", web::post().to(handlers::rooms::join_room_anonymous))
            .route("/api/rooms/info/{room_code}", web::get().to(handlers::rooms::get_room_info_public))
            .route("/api/rooms/info-by-id/{room_id}", web::get().to(handlers::rooms::get_room_info_by_id_public))
            .route("/api/rooms/by-game/{game_id}", web::get().to(handlers::rooms::list_rooms_by_game))
            .route("/api/rooms/active", web::get().to(handlers::rooms::list_active_rooms))
            .route("/api/rooms/{room_id}/found-words", web::get().to(handlers::rooms::get_room_found_words))
            .route("/api/rooms/{room_id}/scores", web::get().to(handlers::rooms::get_room_scores))
            .route("/api/rooms/{room_id}/quiz-progress", web::post().to(handlers::rooms::save_quiz_progress))
            .route("/api/rooms/{room_id}/quiz-progress", web::get().to(handlers::rooms::get_quiz_progress))
            .route("/api/rooms/{room_id}/answer", web::post().to(handlers::rooms::submit_room_answer))
            .route("/api/rooms/{room_id}/answers", web::get().to(handlers::rooms::get_room_answers))
            // Kahoot public routes
            .route("/api/kahoot/games/{id}", web::get().to(handlers::kahoot::get_game))
            .route("/api/kahoot/games/{id}/join", web::post().to(handlers::kahoot::join_game))
            .route("/api/kahoot/games/{id}/players", web::get().to(handlers::kahoot::get_players))
            .route("/api/kahoot/games/{game_id}/questions/{index}", web::get().to(handlers::kahoot::get_question))
            .route("/api/kahoot/games/{id}/answer", web::post().to(handlers::kahoot::submit_answer))
            .route("/api/kahoot/games/{id}/advance", web::post().to(handlers::kahoot::advance_question))
            .route("/api/kahoot/games/{id}/finish", web::post().to(handlers::kahoot::finish_game))
            .route("/api/kahoot/games/{id}/results", web::get().to(handlers::kahoot::get_results))
            // Open Question public routes
            .route("/api/open-question/games/{id}", web::get().to(handlers::open_question::get_game))
            .route("/api/open-question/games/{id}/auth", web::post().to(handlers::open_question::authenticate_game))
            .route("/api/open-question/games/{id}/presenter-public", web::get().to(handlers::open_question::get_game_presenter_public))
            .route("/api/open-question/games/{id}/respond", web::post().to(handlers::open_question::submit_response))
            .route("/api/open-question/questions/{id}/toggle-public", web::post().to(handlers::open_question::toggle_question_public))
            .route("/api/open-question/questions/{id}/responses-public", web::get().to(handlers::open_question::get_question_responses_public))
            // WebSocket público - suporta autenticação via JWT ou session_id
            .route("/api/rooms/{room_id}/ws", web::get().to(websocket::room_websocket))
            // Protected routes
            .service(
                web::scope("/api/protected")
                    .wrap(middleware::Auth)
                    .route("/profile", web::get().to(handlers::auth::get_profile))
                    .route("/games", web::post().to(handlers::games::create_game))
                    .route("/games/my", web::get().to(handlers::games::get_my_games))
                    .service(
                        web::resource("/games/{id}")
                            .route(web::get().to(handlers::games::get_game))
                            .route(web::put().to(handlers::games::update_game))
                            .route(web::delete().to(handlers::games::delete_game))
                    )
                    .route("/word-search", web::post().to(handlers::word_search::create_word_search_config))
                    .route("/word-search/{game_id}", web::put().to(handlers::word_search::update_word_search_config))
                    .route("/quiz", web::post().to(handlers::quiz::create_quiz_config))
                    .route("/quiz/{game_id}", web::put().to(handlers::quiz::update_quiz_config))
                    .route("/quiz/{game_id}/questions", web::post().to(handlers::quiz::create_question))
                    .route("/quiz/{game_id}/questions", web::delete().to(handlers::quiz::delete_all_questions))
                    .route("/sessions", web::post().to(handlers::sessions::create_session))
                    .route("/sessions/{id}/start", web::post().to(handlers::sessions::start_session))
                    .route("/sessions/{id}/end", web::post().to(handlers::sessions::end_session))
                    // Room routes
                    .route("/rooms", web::post().to(handlers::rooms::create_room))
                    .route("/rooms", web::get().to(handlers::rooms::list_rooms))
                    .route("/rooms/join", web::post().to(handlers::rooms::join_room))
                    .route("/rooms/by-id/{room_id}", web::get().to(handlers::rooms::get_room_by_id))
                    .route("/rooms/by-id/{room_id}", web::put().to(handlers::rooms::update_room))
                    .route("/rooms/by-id/{room_id}", web::delete().to(handlers::rooms::delete_room))
                    .route("/rooms/by-id/{room_id}/reset", web::post().to(handlers::rooms::reset_room))
                    .route("/rooms/{room_code}", web::get().to(handlers::rooms::get_room_details))
                    .route("/rooms/{room_id}/close", web::post().to(handlers::rooms::close_room))
                    // Kahoot protected routes (criação de jogos)
                    .route("/kahoot/games", web::post().to(handlers::kahoot::create_game))
                    // Open Question protected routes
                    .route("/open-question/games", web::post().to(handlers::open_question::create_game))
                    .route("/open-question/games/{id}/edit", web::get().to(handlers::open_question::get_game_for_edit))
                    .route("/open-question/games/{id}", web::put().to(handlers::open_question::update_game))
                    .route("/open-question/games/{id}/presenter", web::get().to(handlers::open_question::get_game_presenter))
                    .route("/open-question/questions/{id}/toggle", web::post().to(handlers::open_question::toggle_question))
                    .route("/open-question/questions/{id}/responses", web::get().to(handlers::open_question::get_question_responses))
            )
            // Admin routes
            .service(
                web::scope("/api/admin")
                    .wrap(middleware::AdminAuth)
                    .route("/dashboard", web::get().to(handlers::admin::get_dashboard_stats))
                    .route("/users", web::get().to(handlers::admin::get_all_users))
                    .route("/users/{id}/admin", web::put().to(handlers::admin::update_user_admin))
                    .route("/games", web::get().to(handlers::admin::get_all_games))
                    .route("/games/{id}", web::delete().to(handlers::admin::delete_game))
            )
    })
    .bind(format!("{}:{}", host, port))?
    .run()
    .await
}
