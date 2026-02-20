-- Add min_players to quiz_configs
-- When set, a quiz room requires at least this many players to have answered
-- before consensus can be reached and the question can be advanced.
ALTER TABLE quiz_configs
    ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT NULL;
