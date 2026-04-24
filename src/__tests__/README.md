# Integration and End-to-End Tests

This directory contains integration and end-to-end tests for the Children's English Learning Platform.

## Test Structure

### Integration Tests (`integration/`)

Integration tests verify that multiple components work together correctly:

- **learning-flow.integration.test.ts** (Task 15.1)
  - Tests complete learning flow: registration → login → translate → save
  - Verifies database state and review schedule creation
  - Requirements: 1.1, 2.1, 4.1, 4.3

- **review-flow.integration.test.ts** (Task 15.2)
  - Tests complete review flow: get due words → generate quiz → answer → record results
  - Verifies review schedule updates and attempt records
  - Requirements: 6.1, 7.1, 8.1, 9.1

- **external-services.integration.test.ts** (Task 15.3)
  - Tests Google Translate API integration
  - Tests Image API integration
  - Tests error handling and retry mechanisms
  - Requirements: 11.1, 11.2, 12.1

### End-to-End Tests (`e2e/`)

End-to-end tests verify complete user journeys:

- **user-flows.e2e.test.ts** (Task 15.4)
  - Tests user registration and login flow
  - Tests learning new word flow
  - Tests reviewing word flow
  - Tests complete learning cycle
  - Requirements: 1.1, 2.1, 6.1

## Prerequisites

### Database Setup

These tests require a PostgreSQL database. You can use either:

1. **Separate test database** (recommended):
   ```bash
   createdb english_learning_test
   ```

2. **Same database as development** (will clean up test data):
   The tests will use the database specified in your `.env` file.

### Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=english_learning_test
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=test_secret_key

# External APIs (optional - tests will skip if not configured)
GOOGLE_TRANSLATE_API_KEY=your_api_key
IMAGE_API_KEY=your_api_key
IMAGE_API_PROVIDER=unsplash
```

**Note:** External API tests will be skipped if API keys are not configured. The tests will log warnings but won't fail.

### Run Migrations

Before running tests, ensure database migrations are applied:

```bash
npm run migrate:up
```

## Running Tests

### Run All Integration and E2E Tests

```bash
npm test -- --testPathPattern="__tests__/(integration|e2e)"
```

### Run Specific Test Suites

```bash
# Learning flow integration tests
npm test -- --testPathPattern="integration/learning-flow"

# Review flow integration tests
npm test -- --testPathPattern="integration/review-flow"

# External services integration tests
npm test -- --testPathPattern="integration/external-services"

# End-to-end tests
npm test -- --testPathPattern="e2e/user-flows"
```

### Run with Coverage

```bash
npm test -- --testPathPattern="__tests__/(integration|e2e)" --coverage
```

### Run in Watch Mode

```bash
npm test -- --testPathPattern="integration/learning-flow" --watch
```

### Run with Verbose Output

```bash
npm test -- --testPathPattern="integration" --verbose
```

## Test Behavior

### Data Cleanup

All tests clean up their test data after execution:
- User accounts created during tests are deleted
- Associated words, schedules, and attempts are cascade-deleted
- Tests use unique usernames (with UUID) to avoid conflicts

### Test Isolation

Tests are designed to be isolated:
- Each test suite creates its own test users
- Tests don't depend on data from other tests
- Database state is verified and cleaned up

### External API Handling

Tests handle external API availability gracefully:
- If API keys are not configured, tests are skipped with warnings
- Tests don't fail due to missing API configuration
- Actual API integration is tested when keys are available

### Timeouts

Tests have appropriate timeouts:
- Standard tests: 10 seconds
- API integration tests: 10-15 seconds
- Complex flows: 15-30 seconds
- Batch operations: 20-40 seconds

## Troubleshooting

### Database Connection Errors

If you see database connection errors:

1. Verify PostgreSQL is running:
   ```bash
   pg_isready
   ```

2. Check database exists:
   ```bash
   psql -l | grep english_learning
   ```

3. Verify credentials in `.env` file

4. Test connection manually:
   ```bash
   psql -h localhost -U postgres -d english_learning_test
   ```

### Port Already in Use

If you see "port already in use" errors:

1. Stop any running instances of the application
2. Check for processes using port 3000:
   ```bash
   lsof -i :3000
   ```

### API Key Errors

If external API tests fail:

1. Verify API keys are set in `.env`
2. Check API key validity
3. Tests will skip if keys are missing (this is expected)

### Jest Timeout Errors

If tests timeout:

1. Increase timeout in test file:
   ```typescript
   it('test name', async () => {
     // test code
   }, 30000); // 30 second timeout
   ```

2. Or increase global timeout in `jest.config.js`

### Memory Issues

If you encounter memory issues:

1. Run tests with increased memory:
   ```bash
   NODE_OPTIONS=--max_old_space_size=4096 npm test
   ```

2. Run tests sequentially:
   ```bash
   npm test -- --runInBand
   ```

## Test Coverage

These tests cover:

- ✅ User authentication flow
- ✅ Word learning flow (translate + save)
- ✅ Review schedule creation
- ✅ Review flow (due words + quiz + answer)
- ✅ Review schedule updates
- ✅ External API integration
- ✅ Error handling
- ✅ Data validation
- ✅ Database state verification

## CI/CD Integration

To run these tests in CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Run Integration Tests
  run: npm test -- --testPathPattern="__tests__/(integration|e2e)" --ci
  env:
    DB_HOST: localhost
    DB_NAME: english_learning_test
    DB_USER: postgres
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

## Notes

- Tests marked as "optional" (可选) in tasks.md are still implemented for completeness
- All tests follow the requirements specified in the design document
- Tests use supertest for HTTP assertions
- Database queries use parameterized queries for security
- Test data uses realistic scenarios
