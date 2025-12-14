-- Add justification column to quiz_questions table
ALTER TABLE quiz_questions 
ADD COLUMN IF NOT EXISTS justification TEXT;
