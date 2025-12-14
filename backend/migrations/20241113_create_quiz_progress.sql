-- Tabela para salvar progresso intermediário do quiz
CREATE TABLE IF NOT EXISTS quiz_progress (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    user_identifier VARCHAR(255) NOT NULL, -- 'user_123' ou 'session_abc123'
    progress_data JSONB NOT NULL, -- { answers: {...}, current_question: 3, elapsed_time: 45 }
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(room_id, user_identifier)
);

CREATE INDEX idx_quiz_progress_room_user ON quiz_progress(room_id, user_identifier);
