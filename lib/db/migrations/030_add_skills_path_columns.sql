-- Migration 030: Add local file path support for skills
-- Adds columns for storing local file paths and GitHub/SkillsMP URLs

-- Add path column for local SKILL.md file storage
ALTER TABLE skills ADD COLUMN path TEXT;

-- Add flag to indicate if content should be read from file
ALTER TABLE skills ADD COLUMN is_content_from_path BOOLEAN DEFAULT 0;

-- Add GitHub URL for reference
ALTER TABLE skills ADD COLUMN github_url TEXT;

-- Add SkillsMP URL for reference
ALTER TABLE skills ADD COLUMN skill_url TEXT;

-- Create index for path lookups
CREATE INDEX IF NOT EXISTS idx_skills_path ON skills(path);

-- Create index for content source flag
CREATE INDEX IF NOT EXISTS idx_skills_content_source ON skills(workspace_id, is_content_from_path);
