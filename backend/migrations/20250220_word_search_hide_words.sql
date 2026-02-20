-- Add hide_words option to word_search_configs
-- When enabled, words are blurred in the word list until found by the player
ALTER TABLE word_search_configs
    ADD COLUMN IF NOT EXISTS hide_words BOOLEAN NOT NULL DEFAULT false;
