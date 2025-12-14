-- Add end_screen_button_new_tab column to quiz_configs table
ALTER TABLE quiz_configs ADD COLUMN IF NOT EXISTS end_screen_button_new_tab BOOLEAN DEFAULT true;
