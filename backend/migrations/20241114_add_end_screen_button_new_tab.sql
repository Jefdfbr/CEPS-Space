-- Add end_screen_button_new_tab column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS end_screen_button_new_tab BOOLEAN DEFAULT true;
