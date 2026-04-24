# Database Migrations

This directory contains SQL migration scripts for the Children's English Learning Platform database schema.

## Prerequisites

- PostgreSQL 12 or higher installed
- Database created (e.g., `children_english_learning`)
- User with appropriate permissions

## Migration Files

| File | Description | Requirements |
|------|-------------|--------------|
| `001_create_users_table.sql` | Creates users table for authentication | 1.1, 1.5, 15.3 |
| `002_create_words_table.sql` | Creates words table for vocabulary storage | 4.2, 10.1 |
| `003_create_review_schedules_table.sql` | Creates review schedules (Ebbinghaus curve) | 4.3, 5.1, 5.2, 5.3 |
| `004_create_review_attempts_table.sql` | Creates review attempts tracking | 9.1, 9.2, 9.5 |
| `005_create_image_cache_table.sql` | Creates image URL cache | 12.4, 12.5 |

## Running Migrations

### Option 1: Run All Migrations at Once

```bash
psql -U your_username -d children_english_learning -f 000_run_all_migrations.sql
```

### Option 2: Run Individual Migrations

```bash
# Navigate to migrations directory
cd src/database/migrations

# Run migrations in order
psql -U your_username -d children_english_learning -f 001_create_users_table.sql
psql -U your_username -d children_english_learning -f 002_create_words_table.sql
psql -U your_username -d children_english_learning -f 003_create_review_schedules_table.sql
psql -U your_username -d children_english_learning -f 004_create_review_attempts_table.sql
psql -U your_username -d children_english_learning -f 005_create_image_cache_table.sql
```

### Option 3: Using Environment Variables

```bash
# Set environment variables
export PGUSER=your_username
export PGDATABASE=children_english_learning
export PGHOST=localhost
export PGPORT=5432

# Run migrations
psql -f 000_run_all_migrations.sql
```

## Rollback

To drop all tables and start fresh:

```bash
psql -U your_username -d children_english_learning -f 999_rollback_all_migrations.sql
```

**⚠️ WARNING:** This will delete all data in the database!

## Database Schema Overview

### Tables

1. **users** - User authentication and profiles
   - Primary key: `id` (UUID)
   - Unique constraint: `username`
   - Password stored as bcrypt hash

2. **words** - Learned vocabulary
   - Primary key: `id` (UUID)
   - Foreign key: `user_id` → `users(id)`
   - Constraints: word format (letters and spaces only), length (1-50 chars)

3. **review_schedules** - Spaced repetition schedules
   - Primary key: `id` (UUID)
   - Foreign keys: `word_id` → `words(id)`, `user_id` → `users(id)`
   - Implements Ebbinghaus intervals: 1, 3, 7, 15, 30, 60, 90 days

4. **review_attempts** - Review performance tracking
   - Primary key: `id` (UUID)
   - Foreign keys: `schedule_id`, `word_id`, `user_id`
   - Tracks correctness and response time

5. **image_cache** - Cached image URLs
   - Primary key: `id` (UUID)
   - Unique constraint: `(search_term, image_url)`
   - Validates URLs every 30 days

### Indexes

All tables include optimized indexes for common query patterns:
- User-based queries (filtering by user_id)
- Time-based queries (sorting by dates)
- Composite indexes for complex queries

## Verification

After running migrations, verify the schema:

```sql
-- List all tables
\dt

-- Describe a specific table
\d users
\d words
\d review_schedules
\d review_attempts
\d image_cache

-- Check indexes
\di

-- Check constraints
SELECT conname, contype, conrelid::regclass 
FROM pg_constraint 
WHERE conrelid IN ('users'::regclass, 'words'::regclass, 'review_schedules'::regclass, 'review_attempts'::regclass, 'image_cache'::regclass);
```

## Next Steps

After running migrations:
1. Update `.env` file with database connection details
2. Configure database connection in `src/config/database.ts`
3. Run tests to verify database connectivity
4. Proceed with implementing authentication system (Task 3)

## Troubleshooting

### Error: "extension pgcrypto does not exist"

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Error: "permission denied"

Ensure your database user has CREATE privileges:

```sql
GRANT CREATE ON DATABASE children_english_learning TO your_username;
```

### Error: "relation already exists"

Tables already exist. Either:
- Drop tables manually
- Run rollback script: `999_rollback_all_migrations.sql`
- Use `DROP TABLE IF EXISTS` in individual migrations
