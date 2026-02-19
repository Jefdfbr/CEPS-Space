-- Initial database schema for CEPS Space

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    end_screen_text TEXT,
    end_screen_button_text VARCHAR(255),
    end_screen_button_url TEXT,
    end_screen_button_new_tab BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_games_created_by ON games(created_by);
CREATE INDEX IF NOT EXISTS idx_games_type ON games(game_type);

-- Word Search Configs
CREATE TABLE IF NOT EXISTS word_search_configs (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    grid_size INTEGER NOT NULL,
    words TEXT[] NOT NULL,
    time_limit INTEGER,
    allowed_directions JSONB,
    concepts JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id)
);

CREATE INDEX IF NOT EXISTS idx_word_search_game ON word_search_configs(game_id);

-- Quiz Configs
CREATE TABLE IF NOT EXISTS quiz_configs (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    time_limit INTEGER,
    end_screen_text TEXT,
    end_screen_button_text VARCHAR(255),
    end_screen_button_url TEXT,
    end_screen_button_new_tab BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_configs_game ON quiz_configs(game_id);

-- Quiz Questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_config_id INTEGER NOT NULL REFERENCES quiz_configs(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1) NOT NULL,
    justification TEXT,
    points INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_config ON quiz_questions(quiz_config_id);

-- Game Rooms (Sessions)
CREATE TABLE IF NOT EXISTS game_rooms (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    session_code VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    max_players INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_rooms_game ON game_rooms(game_id);
CREATE INDEX IF NOT EXISTS idx_game_rooms_code ON game_rooms(session_code);

-- Game Scores (Results)
CREATE TABLE IF NOT EXISTS game_scores (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    player_name VARCHAR(255) NOT NULL,
    score INTEGER NOT NULL,
    time_seconds INTEGER,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_scores_room ON game_scores(room_id);
CREATE INDEX IF NOT EXISTS idx_game_scores_player ON game_scores(player_name);
