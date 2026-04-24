-- Run All Migrations Script
-- Description: Executes all database migrations in order
-- Usage: psql -U <username> -d <database> -f 000_run_all_migrations.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Run migrations in order
\i 001_create_users_table.sql
\i 002_create_words_table.sql
\i 003_create_review_schedules_table.sql
\i 004_create_review_attempts_table.sql
\i 005_create_image_cache_table.sql

-- Verify tables were created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN ('users', 'words', 'review_schedules', 'review_attempts', 'image_cache')
ORDER BY table_name;

-- Display success message
\echo 'All migrations completed successfully!'
