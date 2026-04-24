# Data Consistency Property Test

## Overview

This directory contains the property-based test for **Property 12: Data Consistency** (Task 2.3).

**Property 12** validates that after any sequence of data modification operations (adding words, completing reviews, updating schedules), the database maintains a consistent state with no orphaned records or references to non-existent foreign keys.

**Validates: Requirements 10.3**

## Test File

- `data-consistency.property.test.ts` - Property-based test with 100+ iterations testing arbitrary sequences of database operations

## Requirements

This test requires a **live PostgreSQL database connection** because it tests:
- Foreign key constraints
- Cascading deletes
- Referential integrity
- Transaction consistency

Unlike other tests in the project that use mocked databases, this test must interact with a real PostgreSQL instance to verify database-level consistency guarantees.

## Setup Instructions

### 1. Install and Start PostgreSQL

Ensure PostgreSQL is installed and running on your system.

### 2. Create Test Database

```bash
createdb english_learning_test
```

### 3. Set Environment Variables

Create a `.env` file or set environment variables:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=english_learning_test
export DB_USER=postgres
export DB_PASSWORD=your_password
export JWT_SECRET=test_secret_key
export BCRYPT_SALT_ROUNDS=10
```

### 4. Run Database Migrations

```bash
npm run migrate:up
```

This will create all necessary tables (users, words, review_schedules, review_attempts, image_cache) with proper foreign key constraints.

### 5. Run the Test

```bash
npm test -- src/database/data-consistency.property.test.ts
```

## Test Coverage

The test suite includes 5 property-based tests, each running 100 iterations:

1. **Arbitrary Operation Sequences** - Tests random sequences of addWord, completeReview, and deleteWord operations
2. **Multiple Word Addition** - Tests consistency when adding multiple words
3. **Multiple Review Completion** - Tests consistency when completing multiple reviews
4. **Cascading Deletes** - Tests consistency when deleting words (should cascade to schedules and attempts)
5. **User Isolation** - Tests consistency across multiple users to ensure data isolation

## What the Test Validates

For each test iteration, the test:

1. Creates a test user
2. Performs a sequence of database operations
3. Verifies database consistency by checking:
   - No orphaned words (all words have valid user_id)
   - No orphaned review_schedules (all schedules have valid word_id and user_id)
   - No orphaned review_attempts (all attempts have valid schedule_id, word_id, and user_id)
   - All review_schedules for a word belong to the same user as the word
   - All review_attempts for a word belong to the same user as the word
   - All review_attempts reference schedules that belong to the same word

## Skipping the Test

If you don't have a PostgreSQL database available, you can skip this test by setting:

```bash
export SKIP_DB_TESTS=true
npm test
```

## Troubleshooting

### Database Connection Errors

If you see `DatabaseError: 注册失败，请重试`, check:
- PostgreSQL is running
- Database exists: `psql -l | grep english_learning_test`
- Environment variables are set correctly
- User has permissions to access the database

### Migration Errors

If migrations fail:
```bash
# Reset database
dropdb english_learning_test
createdb english_learning_test
npm run migrate:up
```

### Test Timeout

The tests have a 60-second timeout per test case. If tests timeout:
- Check database performance
- Ensure no other processes are locking the database
- Reduce the number of iterations (change `numRuns` in the test file)

## Implementation Details

### Test Structure

```typescript
// Generate arbitrary operations
const operationArbitrary = fc.constantFrom('addWord', 'completeReview', 'deleteWord');

// Generate arbitrary word data
const wordDataArbitrary = fc.record({
  englishWord: fc.stringOf(...),
  chineseTranslation: fc.string(...),
  imageUrl: fc.webUrl(),
});

// Run property test
fc.assert(
  fc.asyncProperty(
    fc.array(operations, { minLength: 1, maxLength: 10 }),
    async (operations) => {
      // Execute operations
      // Verify consistency
    }
  ),
  { numRuns: 100 }
);
```

### Consistency Checks

The `verifyDatabaseConsistency` function runs 6 SQL queries to check:

1. Orphaned words check
2. Orphaned schedules check
3. Orphaned attempts check
4. Schedule-word user mismatch check
5. Attempt-word user mismatch check
6. Attempt-schedule word mismatch check

All checks must pass for the database to be considered consistent.

## Related Files

- `src/database/migrations/` - Database schema definitions
- `src/services/word.service.ts` - Word CRUD operations
- `src/services/review-schedule.service.ts` - Review schedule management
- `src/services/auth.service.ts` - User authentication

## Design Document Reference

See `.kiro/specs/children-english-learning-platform/design.md`:
- **Property 12: 数据一致性** (Section: 正确性属性)
- **Requirements 10.3** (Section: 需求 10：会话管理和数据持久化)
