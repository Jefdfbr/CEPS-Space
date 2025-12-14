-- Migration: Create Open Question tables
-- Description: Tables for open-ended question game where presenter controls when responses are open

-- Table for open question games
CREATE TABLE IF NOT EXISTS open_question_games (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    question_text TEXT NOT NULL,
    is_open BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for responses
CREATE TABLE IF NOT EXISTS open_question_responses (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES open_question_games(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    player_name VARCHAR(100),
    room_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_open_question_games_user ON open_question_games(user_id);
CREATE INDEX IF NOT EXISTS idx_open_question_responses_game ON open_question_responses(game_id);
CREATE INDEX IF NOT EXISTS idx_open_question_responses_created ON open_question_responses(game_id, created_at DESC);
