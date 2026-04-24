# Database Setup Guide

This guide will help you set up the PostgreSQL database for the Children's English Learning Platform.

## Prerequisites

- PostgreSQL 12 or higher installed
- Node.js 18+ and npm installed
- Basic familiarity with command line

## Quick Start

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Create Database

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database
CREATE DATABASE children_english_learning;

# Create user (optional, for production)
CREATE USER english_learning_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE children_english_learning TO english_learning_user;

# Exit psql
\q
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and update database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=children_english_learning
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### 4. Run Migrations

**Option A: Using npm scripts (Recommended)**

```bash
# Run all migrations
npm run migrate:up

# Verify schema
npm run migrate:verify

# Rollback (if needed)
npm run migrate:down
```

**Option B: Using psql directly**

```bash
cd src/database/migrations
psql -U postgres -d children_english_learning -f 000_run_all_migrations.sql
```

**Option C: Using TypeScript directly**

```bash
ts-node src/database/migrate.ts up
```

## Database Schema

The migration creates 5 tables:

### 1. users
Stores user authentication and profile information.

**Columns:**
- `id` (UUID, PK) - Unique user identifier
- `username` (VARCHAR(20), UNIQUE) - Username (3-20 chars)
- `password_hash` (VARCHAR(255)) - Bcrypt hashed password
- `email` (VARCHAR(255)) - Optional email
- `created_at` (TIMESTAMP) - Account creation time
- `updated_at` (TIMESTAMP) - Last update time

**Constraints:**
- Username must be 3-20 characters
- Username format: alphanumeric and underscore only

### 2. words
Stores vocabulary words learned by users.

**Columns:**
- `id` (UUID, PK) - Unique word record identifier
- `user_id` (UUID, FK) - References users(id)
- `english_word` (VARCHAR(50)) - English word
- `chinese_translation` (VARCHAR(100)) - Chinese translation
- `image_url` (TEXT) - Associated image URL
- `image_validated_at` (TIMESTAMP) - Last URL validation
- `learned_at` (TIMESTAMP) - When user learned this word

**Constraints:**
- Word length: 1-50 characters
- Word format: letters and spaces only

### 3. review_schedules
Implements Ebbinghaus forgetting curve for spaced repetition.

**Columns:**
- `id` (UUID, PK) - Unique schedule identifier
- `word_id` (UUID, FK) - References words(id)
- `user_id` (UUID, FK) - References users(id)
- `due_date` (DATE) - When review is due
- `interval_days` (INTEGER) - Current interval (1, 3, 7, 15, 30, 60, 90)
- `completed` (BOOLEAN) - Whether review is completed
- `completed_at` (TIMESTAMP) - Completion time

**Intervals:**
Initial: 1, 3, 7, 15, 30 days
Extended: 60, 90 days (for mastered words)

### 4. review_attempts
Tracks all review attempts for performance analysis.

**Columns:**
- `id` (UUID, PK) - Unique attempt identifier
- `schedule_id` (UUID, FK) - References review_schedules(id)
- `word_id` (UUID, FK) - References words(id)
- `user_id` (UUID, FK) - References users(id)
- `attempted_at` (TIMESTAMP) - Attempt time
- `correct` (BOOLEAN) - Whether answer was correct
- `response_time_ms` (INTEGER) - Response time in milliseconds

### 5. image_cache
Caches image URLs to reduce external API calls.

**Columns:**
- `id` (UUID, PK) - Unique cache entry identifier
- `search_term` (VARCHAR(100)) - Search term (usually English word)
- `image_url` (TEXT) - Cached image URL
- `source` (VARCHAR(50)) - Image source (e.g., "unsplash")
- `cached_at` (TIMESTAMP) - When cached
- `validated_at` (TIMESTAMP) - Last validation time
- `is_valid` (BOOLEAN) - Whether URL is still valid

**Cache Strategy:**
- URLs validated every 30 days
- Invalid URLs trigger re-fetch from API

## Verification

After running migrations, verify the setup:

```bash
# Using npm script
npm run migrate:verify

# Or using psql
psql -U postgres -d children_english_learning -c "\dt"
```

Expected output:
```
             List of relations
 Schema |       Name        | Type  |  Owner   
--------+-------------------+-------+----------
 public | image_cache       | table | postgres
 public | review_attempts   | table | postgres
 public | review_schedules  | table | postgres
 public | users             | table | postgres
 public | words             | table | postgres
```

## Troubleshooting

### Error: "database does not exist"

Create the database first:
```bash
psql -U postgres -c "CREATE DATABASE children_english_learning;"
```

### Error: "role does not exist"

Create the user:
```bash
psql -U postgres -c "CREATE USER postgres WITH PASSWORD 'your_password';"
```

### Error: "permission denied"

Grant privileges:
```bash
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE children_english_learning TO postgres;"
```

### Error: "extension pgcrypto does not exist"

Enable the extension:
```bash
psql -U postgres -d children_english_learning -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

### Connection refused

Check if PostgreSQL is running:
```bash
# macOS
brew services list

# Linux
sudo systemctl status postgresql

# Start if not running
brew services start postgresql@14  # macOS
sudo systemctl start postgresql     # Linux
```

## Rollback

To drop all tables and start fresh:

```bash
# Using npm script
npm run migrate:down

# Or using psql
psql -U postgres -d children_english_learning -f src/database/migrations/999_rollback_all_migrations.sql
```

**⚠️ WARNING:** This will delete all data!

## Next Steps

After successful database setup:

1. ✅ Database created and configured
2. ✅ Migrations run successfully
3. ✅ Schema verified
4. ⏭️ Implement authentication system (Task 3)
5. ⏭️ Integrate Google Translate API (Task 5)
6. ⏭️ Implement word learning module (Task 7)

## Production Considerations

For production deployment:

1. **Use strong passwords** - Generate secure passwords for database users
2. **Enable SSL** - Configure PostgreSQL to use SSL connections
3. **Backup strategy** - Set up automated backups
4. **Connection pooling** - Configure appropriate pool size in application
5. **Monitoring** - Set up database monitoring and alerting
6. **Read replicas** - Consider read replicas for scaling

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js pg library](https://node-postgres.com/)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl.html)
