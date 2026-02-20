-- Multiplayer room schema: rename columns, add new columns, create auxiliary tables

-- 1. Rename session_code -> room_code (if still old name)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'game_rooms' AND column_name = 'session_code'
    ) THEN
        ALTER TABLE game_rooms RENAME COLUMN session_code TO room_code;
    END IF;
END $$;

-- 2. Rename password -> password_hash (if still old name)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'game_rooms' AND column_name = 'password'
    ) THEN
        ALTER TABLE game_rooms RENAME COLUMN password TO password_hash;
    END IF;
END $$;

-- 3. Increase password_hash column type if needed
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'game_rooms' AND column_name = 'password_hash'
          AND character_maximum_length < 255
    ) THEN
        ALTER TABLE game_rooms ALTER COLUMN password_hash TYPE VARCHAR(255);
    END IF;
END $$;

-- 4. Add room_name (NOT NULL with default to avoid issues on existing rows)
ALTER TABLE game_rooms
    ADD COLUMN IF NOT EXISTS room_name VARCHAR(255) NOT NULL DEFAULT '';

-- Remove the DEFAULT after adding so new rows must supply it
ALTER TABLE game_rooms ALTER COLUMN room_name DROP DEFAULT;

-- 5. Add remaining columns
ALTER TABLE game_rooms
    ADD COLUMN IF NOT EXISTS created_by     INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS expires_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS game_seed      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS paused_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_pause_duration INTEGER,
    ADD COLUMN IF NOT EXISTS total_score    INTEGER,
    ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completion_time INTEGER;

-- 6. Convert legacy TIMESTAMP columns to TIMESTAMPTZ
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'game_rooms' AND column_name = 'created_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE game_rooms
            ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
            ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'game_rooms' AND column_name = 'started_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE game_rooms
            ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC';
    END IF;
END $$;

-- Drop ended_at if still present (replaced by completed_at)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'game_rooms' AND column_name = 'ended_at'
    ) THEN
        ALTER TABLE game_rooms DROP COLUMN ended_at;
    END IF;
END $$;

-- 7. Update index on room_code (may still be named idx_game_rooms_code on session_code)
DROP INDEX IF EXISTS idx_game_rooms_code;
CREATE INDEX IF NOT EXISTS idx_game_rooms_code ON game_rooms(room_code);

-- 8. room_participants table
CREATE TABLE IF NOT EXISTS room_participants (
    id           SERIAL PRIMARY KEY,
    room_id      INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    user_id      INTEGER REFERENCES users(id),
    session_id   VARCHAR(255),
    player_name  VARCHAR(255),
    joined_at    TIMESTAMPTZ DEFAULT now(),
    is_host      BOOLEAN DEFAULT false,
    player_color VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_room_participants_room    ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user    ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_session ON room_participants(session_id);

-- UNIQUE only on (room_id, user_id) for authenticated players
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'room_participants_room_user_unique'
    ) THEN
        ALTER TABLE room_participants
            ADD CONSTRAINT room_participants_room_user_unique UNIQUE (room_id, user_id);
    END IF;
END $$;

-- 9. room_found_words table
CREATE TABLE IF NOT EXISTS room_found_words (
    id                  SERIAL PRIMARY KEY,
    room_id             INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    word                VARCHAR(255) NOT NULL,
    found_by_session_id VARCHAR(255) NOT NULL,
    found_by_name       VARCHAR(255) NOT NULL,
    player_color        VARCHAR(50)  NOT NULL,
    cells               JSONB        NOT NULL DEFAULT '[]',
    found_at            TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT room_found_words_room_id_word_key UNIQUE (room_id, word)
);

CREATE INDEX IF NOT EXISTS idx_room_found_words_room ON room_found_words(room_id);

-- 10. room_player_scores table
CREATE TABLE IF NOT EXISTS room_player_scores (
    id           SERIAL PRIMARY KEY,
    room_id      INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    session_id   VARCHAR(255) NOT NULL,
    player_name  VARCHAR(255) NOT NULL,
    player_color VARCHAR(50)  NOT NULL,
    words_found  INTEGER NOT NULL DEFAULT 0,
    total_score  INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT room_player_scores_room_id_session_id_key UNIQUE (room_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_room_player_scores_room ON room_player_scores(room_id);
