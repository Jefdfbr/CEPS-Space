#!/bin/bash
export $(cat ../.env | grep -v '^#' | xargs)
psql "$DATABASE_URL" -f migrations/20241113_create_quiz_progress.sql
