-- Tabela para jogos tipo Kahoot
CREATE TABLE IF NOT EXISTS kahoot_games (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    presenter_password VARCHAR(100) NOT NULL, -- Senha do apresentador
    room_password VARCHAR(100) NOT NULL, -- Senha da sala para jogadores
    is_active BOOLEAN DEFAULT true,
    current_question_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para perguntas do Kahoot
CREATE TABLE IF NOT EXISTS kahoot_questions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES kahoot_games(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_order INTEGER NOT NULL,
    time_limit INTEGER DEFAULT 30, -- Tempo em segundos
    points INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para alternativas das perguntas
CREATE TABLE IF NOT EXISTS kahoot_options (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES kahoot_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    option_order INTEGER NOT NULL, -- A, B, C, D
    is_correct BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para respostas dos jogadores
CREATE TABLE IF NOT EXISTS kahoot_answers (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES kahoot_games(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES kahoot_questions(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    selected_option_id INTEGER NOT NULL REFERENCES kahoot_options(id),
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_time INTEGER, -- Tempo em segundos que levou para responder
    UNIQUE(game_id, question_id, session_id)
);

-- Tabela para pontuação dos jogadores
CREATE TABLE IF NOT EXISTS kahoot_scores (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES kahoot_games(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    total_score INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, session_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_kahoot_games_user ON kahoot_games(user_id);
CREATE INDEX IF NOT EXISTS idx_kahoot_questions_game ON kahoot_questions(game_id);
CREATE INDEX IF NOT EXISTS idx_kahoot_options_question ON kahoot_options(question_id);
CREATE INDEX IF NOT EXISTS idx_kahoot_answers_game ON kahoot_answers(game_id);
CREATE INDEX IF NOT EXISTS idx_kahoot_answers_session ON kahoot_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_kahoot_scores_game ON kahoot_scores(game_id);
