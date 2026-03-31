-- Migration 012: Add description field to chat_sessions
-- Created: 2026-03-10

ALTER TABLE chat_sessions ADD COLUMN description TEXT;
