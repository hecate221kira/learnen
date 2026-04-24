-- Rollback All Migrations Script
-- Description: Drops all tables created by migrations (in reverse order)
-- Usage: psql -U <username> -d <database> -f 999_rollback_all_migrations.sql
-- WARNING: This will delete all data!

-- Drop tables in reverse order (respecting foreign key dependencies)
DROP TABLE IF EXISTS review_attempts CASCADE;
DROP TABLE IF EXISTS review_schedules CASCADE;
DROP TABLE IF EXISTS image_cache CASCADE;
DROP TABLE IF EXISTS words CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Verify tables were dropped
SELECT 
  table_name
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN ('users', 'words', 'review_schedules', 'review_attempts', 'image_cache');

-- Display success message
\echo 'All migrations rolled back successfully!'
