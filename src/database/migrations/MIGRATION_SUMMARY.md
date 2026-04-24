# Migration Summary

## Overview

This document summarizes the database schema migrations created for the Children's English Learning Platform.

## Files Created

### SQL Migration Files

1. **001_create_users_table.sql**
   - Creates `users` table for authentication
   - Implements username constraints (3-20 chars, alphanumeric + underscore)
   - Stores bcrypt password hashes
   - Requirements: 1.1, 1.5, 15.3

2. **002_create_words_table.sql**
   - Creates `words` table for vocabulary storage
   - Links to users via foreign key
   - Validates word format (letters and spaces only, max 50 chars)
   - Stores English word, Chinese translation, and image URL
   - Requirements: 4.2, 10.1

3. **003_create_review_schedules_table.sql**
   - Creates `review_schedules` table for spaced repetition
   - Implements Ebbinghaus forgetting curve intervals
   - Tracks completion status and due dates
   - Requirements: 4.3, 5.1, 5.2, 5.3

4. **004_create_review_attempts_table.sql**
   - Creates `review_attempts` table for performance tracking
   - Records correctness and response time
   - Links to schedules, words, and users
   - Requirements: 9.1, 9.2, 9.5

5. **005_create_image_cache_table.sql**
   - Creates `image_cache` table for URL caching
   - Reduces external API calls
   - Validates URLs every 30 days
   - Requirements: 12.4, 12.5

### Utility Files

6. **000_run_all_migrations.sql**
   - Master script to run all migrations in order
   - Enables pgcrypto extension
   - Verifies table creation

7. **999_rollback_all_migrations.sql**
   - Drops all tables in reverse order
   - Respects foreign key dependencies
   - For development/testing use

8. **README.md**
   - Comprehensive migration documentation
   - Usage instructions for all methods
   - Troubleshooting guide

### TypeScript Files

9. **migrate.ts**
   - Programmatic migration runner
   - CLI interface (up/down/verify commands)
   - Integration with Node.js application

### Documentation

10. **DATABASE_SETUP.md** (root directory)
    - Complete database setup guide
    - Installation instructions for all platforms
    - Schema documentation
    - Troubleshooting section

## Database Schema Summary

### Tables Created: 5

| Table | Rows (Initial) | Purpose |
|-------|----------------|---------|
| users | 0 | User authentication and profiles |
| words | 0 | Learned vocabulary |
| review_schedules | 0 | Spaced repetition schedules |
| review_attempts | 0 | Review performance history |
| image_cache | 0 | Cached image URLs |

### Indexes Created: 15

**users:**
- `idx_users_username` - Username lookups

**words:**
- `idx_words_user_id` - User's words
- `idx_words_learned_at` - Time-based queries
- `idx_words_user_word` - Composite user + word

**review_schedules:**
- `idx_review_schedules_user_due` - Due reviews (partial, WHERE completed = FALSE)
- `idx_review_schedules_word` - Word-based queries
- `idx_review_schedules_completed` - Completion tracking

**review_attempts:**
- `idx_review_attempts_user` - User statistics
- `idx_review_attempts_word` - Word performance
- `idx_review_attempts_attempted_at` - Recent activity
- `idx_review_attempts_user_time` - User performance over time
- `idx_review_attempts_schedule` - Schedule-based queries

**image_cache:**
- `idx_image_cache_search_term` - Search term lookups
- `idx_image_cache_validated_at` - Validation checks (partial, WHERE is_valid = TRUE)
- `idx_image_cache_valid` - Valid images

### Constraints

**Check Constraints:**
- Username length (≥3 characters)
- Username format (alphanumeric + underscore)
- Word length (1-50 characters)
- Word format (letters and spaces only)
- Interval days (>0)
- Response time (>0 or NULL)

**Foreign Key Constraints:**
- words.user_id → users.id (CASCADE DELETE)
- review_schedules.word_id → words.id (CASCADE DELETE)
- review_schedules.user_id → users.id (CASCADE DELETE)
- review_attempts.schedule_id → review_schedules.id (CASCADE DELETE)
- review_attempts.word_id → words.id (CASCADE DELETE)
- review_attempts.user_id → users.id (CASCADE DELETE)

**Unique Constraints:**
- users.username
- image_cache.(search_term, image_url)

## Usage

### Run Migrations

```bash
# Method 1: npm scripts (recommended)
npm run migrate:up

# Method 2: TypeScript
ts-node src/database/migrate.ts up

# Method 3: SQL directly
psql -U postgres -d children_english_learning -f src/database/migrations/000_run_all_migrations.sql
```

### Verify Schema

```bash
npm run migrate:verify
```

### Rollback

```bash
npm run migrate:down
```

## Requirements Coverage

This migration satisfies the following requirements from the design document:

- **1.1, 1.5** - User authentication and data isolation
- **4.2, 4.3** - Word storage and review schedule creation
- **5.1, 5.2, 5.3** - Ebbinghaus forgetting curve implementation
- **9.1, 9.2, 9.5** - Review progress tracking
- **10.1** - Data persistence
- **12.4, 12.5** - Image URL caching
- **15.3** - Password security (bcrypt hash storage)

## Testing Recommendations

1. **Unit Tests**
   - Test migration runner functions
   - Test rollback functionality
   - Test schema verification

2. **Integration Tests**
   - Test foreign key constraints
   - Test cascade deletes
   - Test unique constraints
   - Test check constraints

3. **Property Tests**
   - Property 3: Data integrity after save/retrieve
   - Property 12: Data consistency after operations

## Next Steps

After migrations are complete:

1. ✅ Task 2.1 - Database schema created
2. ⏭️ Task 2.2 (Optional) - Property test for data integrity
3. ⏭️ Task 2.3 (Optional) - Property test for data consistency
4. ⏭️ Task 3 - Implement authentication system

## Notes

- All tables use UUID primary keys for better distribution and security
- Cascade deletes ensure referential integrity
- Partial indexes optimize common queries (e.g., incomplete reviews)
- Comments on tables and columns provide inline documentation
- Migration files are idempotent (use IF NOT EXISTS)
