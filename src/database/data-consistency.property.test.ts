// Load environment variables before importing any modules
import dotenv from 'dotenv';
dotenv.config();

import fc from 'fast-check';
import { pool } from '../config/database';
import { AuthService } from '../services/auth.service';
import { WordService } from '../services/word.service';
import { ReviewScheduleService } from '../services/review-schedule.service';

/**
 * Property-Based Test: Data Consistency (Property 12)
 * 
 * Feature: children-english-learning-platform, Property 12: 数据一致性
 * **Validates: Requirements 10.3**
 * 
 * 对于任意数据修改操作序列（添加单词、完成复习、更新计划），
 * 在所有操作完成后，数据库中的数据应该保持一致状态，
 * 不应出现孤立记录或引用不存在的外键。
 * 
 * IMPORTANT: This test requires a live PostgreSQL database connection.
 * 
 * Setup Instructions:
 * 1. Ensure PostgreSQL is running
 * 2. Create a test database: createdb english_learning_test
 * 3. Run migrations: npm run migrate:up
 * 4. Set environment variables:
 *    - DB_HOST=localhost
 *    - DB_PORT=5432
 *    - DB_NAME=english_learning_test
 *    - DB_USER=postgres
 *    - DB_PASSWORD=your_password
 *    - JWT_SECRET=test_secret
 * 5. Run this test: npm test -- src/database/data-consistency.property.test.ts
 * 
 * To skip this test when database is not available, set SKIP_DB_TESTS=true
 */

// Skip these tests if SKIP_DB_TESTS environment variable is set
const describeOrSkip = process.env.SKIP_DB_TESTS === 'true' ? describe.skip : describe;

describeOrSkip('Database Data Consistency - Property-Based Tests', () => {
  let authService: AuthService;
  let wordService: WordService;
  let reviewScheduleService: ReviewScheduleService;

  // Test user IDs for cleanup
  const testUserIds: string[] = [];

  beforeAll(async () => {
    authService = new AuthService();
    wordService = new WordService();
    reviewScheduleService = new ReviewScheduleService();
  });

  afterEach(async () => {
    // Clean up test data after each test
    for (const userId of testUserIds) {
      try {
        // Delete user (cascade will delete all related records)
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    testUserIds.length = 0;
  });

  afterAll(async () => {
    // Close database connection
    await pool.end();
  });

  /**
   * Helper function to create a test user
   */
  async function createTestUser(usernamePrefix: string = 'test'): Promise<string> {
    // Generate a unique username that meets validation requirements (3-20 chars)
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const username = `${usernamePrefix}${timestamp}${random}`.substring(0, 20);
    
    const result = await authService.register({
      username,
      password: 'testpass123',
      email: `${username}@test.com`,
    });
    if (!result.userId) {
      throw new Error('Failed to create test user: userId is undefined');
    }
    testUserIds.push(result.userId);
    return result.userId;
  }

  /**
   * Helper function to verify database consistency
   * Checks for:
   * 1. No orphaned words (all words have valid user_id)
   * 2. No orphaned review_schedules (all schedules have valid word_id and user_id)
   * 3. No orphaned review_attempts (all attempts have valid schedule_id, word_id, and user_id)
   * 4. All foreign key relationships are valid
   */
  async function verifyDatabaseConsistency(userId: string): Promise<{
    consistent: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Check 1: All words have valid user_id
      const orphanedWordsQuery = `
        SELECT w.id
        FROM words w
        LEFT JOIN users u ON w.user_id = u.id
        WHERE w.user_id = $1 AND u.id IS NULL
      `;
      const orphanedWords = await pool.query(orphanedWordsQuery, [userId]);
      if (orphanedWords.rows.length > 0) {
        errors.push(
          `Found ${orphanedWords.rows.length} orphaned words with invalid user_id`
        );
      }

      // Check 2: All review_schedules have valid word_id and user_id
      const orphanedSchedulesQuery = `
        SELECT rs.id, rs.word_id, rs.user_id
        FROM review_schedules rs
        LEFT JOIN words w ON rs.word_id = w.id
        LEFT JOIN users u ON rs.user_id = u.id
        WHERE rs.user_id = $1 AND (w.id IS NULL OR u.id IS NULL)
      `;
      const orphanedSchedules = await pool.query(orphanedSchedulesQuery, [userId]);
      if (orphanedSchedules.rows.length > 0) {
        errors.push(
          `Found ${orphanedSchedules.rows.length} orphaned review_schedules with invalid foreign keys`
        );
      }

      // Check 3: All review_attempts have valid schedule_id, word_id, and user_id
      const orphanedAttemptsQuery = `
        SELECT ra.id, ra.schedule_id, ra.word_id, ra.user_id
        FROM review_attempts ra
        LEFT JOIN review_schedules rs ON ra.schedule_id = rs.id
        LEFT JOIN words w ON ra.word_id = w.id
        LEFT JOIN users u ON ra.user_id = u.id
        WHERE ra.user_id = $1 AND (rs.id IS NULL OR w.id IS NULL OR u.id IS NULL)
      `;
      const orphanedAttempts = await pool.query(orphanedAttemptsQuery, [userId]);
      if (orphanedAttempts.rows.length > 0) {
        errors.push(
          `Found ${orphanedAttempts.rows.length} orphaned review_attempts with invalid foreign keys`
        );
      }

      // Check 4: All review_schedules for a word belong to the same user as the word
      const mismatchedSchedulesQuery = `
        SELECT rs.id, rs.word_id, rs.user_id, w.user_id as word_user_id
        FROM review_schedules rs
        JOIN words w ON rs.word_id = w.id
        WHERE rs.user_id = $1 AND rs.user_id != w.user_id
      `;
      const mismatchedSchedules = await pool.query(mismatchedSchedulesQuery, [userId]);
      if (mismatchedSchedules.rows.length > 0) {
        errors.push(
          `Found ${mismatchedSchedules.rows.length} review_schedules with user_id mismatch`
        );
      }

      // Check 5: All review_attempts for a word belong to the same user as the word
      const mismatchedAttemptsQuery = `
        SELECT ra.id, ra.word_id, ra.user_id, w.user_id as word_user_id
        FROM review_attempts ra
        JOIN words w ON ra.word_id = w.id
        WHERE ra.user_id = $1 AND ra.user_id != w.user_id
      `;
      const mismatchedAttempts = await pool.query(mismatchedAttemptsQuery, [userId]);
      if (mismatchedAttempts.rows.length > 0) {
        errors.push(
          `Found ${mismatchedAttempts.rows.length} review_attempts with user_id mismatch`
        );
      }

      // Check 6: All review_attempts reference schedules that belong to the same word
      const mismatchedAttemptSchedulesQuery = `
        SELECT ra.id, ra.schedule_id, ra.word_id, rs.word_id as schedule_word_id
        FROM review_attempts ra
        JOIN review_schedules rs ON ra.schedule_id = rs.id
        WHERE ra.user_id = $1 AND ra.word_id != rs.word_id
      `;
      const mismatchedAttemptSchedules = await pool.query(
        mismatchedAttemptSchedulesQuery,
        [userId]
      );
      if (mismatchedAttemptSchedules.rows.length > 0) {
        errors.push(
          `Found ${mismatchedAttemptSchedules.rows.length} review_attempts with word_id/schedule_id mismatch`
        );
      }

      return {
        consistent: errors.length === 0,
        errors,
      };
    } catch (error: any) {
      errors.push(`Database consistency check failed: ${error.message}`);
      return {
        consistent: false,
        errors,
      };
    }
  }

  /**
   * Generate arbitrary database operations
   */
  const operationArbitrary = fc.constantFrom(
    'addWord',
    'completeReview',
    'deleteWord'
  );

  /**
   * Generate arbitrary word data
   */
  const wordDataArbitrary = fc.record({
    englishWord: fc
      .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', ' '), {
        minLength: 1,
        maxLength: 20,
      })
      .filter((s) => s.trim().length > 0),
    chineseTranslation: fc.string({ minLength: 1, maxLength: 20 }),
    imageUrl: fc.webUrl(),
  });

  describe('Property 12: Data Consistency', () => {
    it('should maintain database consistency after arbitrary sequences of operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              operation: operationArbitrary,
              wordData: wordDataArbitrary,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (operations) => {
            // Create a unique test user for this test run
            const userId = await createTestUser('usr');

            // Track created word IDs for operations
            const wordIds: string[] = [];

            // Execute operations sequentially
            for (const op of operations) {
              try {
                switch (op.operation) {
                  case 'addWord': {
                    // Add a new word
                    const result = await wordService.saveWord(
                      userId,
                      op.wordData.englishWord,
                      op.wordData.chineseTranslation,
                      op.wordData.imageUrl
                    );
                    wordIds.push(result.word.id);
                    break;
                  }

                  case 'completeReview': {
                    // Complete a review if there are words
                    if (wordIds.length > 0) {
                      // Get due schedules
                      const schedules = await reviewScheduleService.getDueSchedules(
                        userId,
                        5
                      );

                      if (schedules.length > 0) {
                        const schedule = schedules[0];

                        // Record review attempt
                        const correct = Math.random() > 0.5;
                        await pool.query(
                          `INSERT INTO review_attempts (schedule_id, word_id, user_id, correct)
                           VALUES ($1, $2, $3, $4)`,
                          [schedule.id, schedule.wordId, userId, correct]
                        );

                        // Mark schedule as completed
                        await reviewScheduleService.markScheduleCompleted(schedule.id);

                        // Create next schedule
                        await reviewScheduleService.createNextSchedule(
                          schedule.wordId,
                          userId,
                          schedule.intervalDays,
                          correct
                        );
                      }
                    }
                    break;
                  }

                  case 'deleteWord': {
                    // Delete a word if there are words
                    if (wordIds.length > 0) {
                      const wordIdToDelete = wordIds[Math.floor(Math.random() * wordIds.length)];
                      await wordService.deleteWord(wordIdToDelete);
                      // Remove from tracking
                      wordIds.splice(wordIds.indexOf(wordIdToDelete), 1);
                    }
                    break;
                  }
                }
              } catch (error) {
                // Some operations may fail due to business logic constraints
                // This is acceptable - we're testing consistency, not success
              }
            }

            // Verify database consistency after all operations
            const consistencyCheck = await verifyDatabaseConsistency(userId);

            // Assert consistency
            expect(consistencyCheck.consistent).toBe(true);
            if (!consistencyCheck.consistent) {
              console.error('Consistency errors:', consistencyCheck.errors);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000); // Increase timeout to 60 seconds for this test

    it('should maintain consistency when adding multiple words', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(wordDataArbitrary, { minLength: 1, maxLength: 5 }),
          async (wordsData) => {
            // Create a unique test user
            const userId = await createTestUser('usr');

            // Add all words
            for (const wordData of wordsData) {
              try {
                await wordService.saveWord(
                  userId,
                  wordData.englishWord,
                  wordData.chineseTranslation,
                  wordData.imageUrl
                );
              } catch (error) {
                // Ignore validation errors
              }
            }

            // Verify consistency
            const consistencyCheck = await verifyDatabaseConsistency(userId);
            expect(consistencyCheck.consistent).toBe(true);
            if (!consistencyCheck.consistent) {
              console.error('Consistency errors:', consistencyCheck.errors);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should maintain consistency when completing multiple reviews', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(wordDataArbitrary, { minLength: 2, maxLength: 5 }),
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
          async (wordsData, reviewResults) => {
            // Create a unique test user
            const userId = await createTestUser('usr');

            // Add words
            const wordIds: string[] = [];
            for (const wordData of wordsData) {
              try {
                const result = await wordService.saveWord(
                  userId,
                  wordData.englishWord,
                  wordData.chineseTranslation,
                  wordData.imageUrl
                );
                wordIds.push(result.word.id);
              } catch (error) {
                // Ignore validation errors
              }
            }

            // Complete reviews
            for (const correct of reviewResults) {
              try {
                const schedules = await reviewScheduleService.getDueSchedules(userId, 1);
                if (schedules.length > 0) {
                  const schedule = schedules[0];

                  // Record attempt
                  await pool.query(
                    `INSERT INTO review_attempts (schedule_id, word_id, user_id, correct)
                     VALUES ($1, $2, $3, $4)`,
                    [schedule.id, schedule.wordId, userId, correct]
                  );

                  // Mark completed
                  await reviewScheduleService.markScheduleCompleted(schedule.id);

                  // Create next schedule
                  await reviewScheduleService.createNextSchedule(
                    schedule.wordId,
                    userId,
                    schedule.intervalDays,
                    correct
                  );
                }
              } catch (error) {
                // Ignore errors
              }
            }

            // Verify consistency
            const consistencyCheck = await verifyDatabaseConsistency(userId);
            expect(consistencyCheck.consistent).toBe(true);
            if (!consistencyCheck.consistent) {
              console.error('Consistency errors:', consistencyCheck.errors);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should maintain consistency when deleting words with cascading deletes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(wordDataArbitrary, { minLength: 3, maxLength: 5 }),
          async (wordsData) => {
            // Create a unique test user
            const userId = await createTestUser('usr');

            // Add words
            const wordIds: string[] = [];
            for (const wordData of wordsData) {
              try {
                const result = await wordService.saveWord(
                  userId,
                  wordData.englishWord,
                  wordData.chineseTranslation,
                  wordData.imageUrl
                );
                wordIds.push(result.word.id);
              } catch (error) {
                // Ignore validation errors
              }
            }

            // Delete some words (should cascade delete schedules and attempts)
            const wordsToDelete = wordIds.slice(0, Math.floor(wordIds.length / 2));
            for (const wordId of wordsToDelete) {
              try {
                await wordService.deleteWord(wordId);
              } catch (error) {
                // Ignore errors
              }
            }

            // Verify consistency
            const consistencyCheck = await verifyDatabaseConsistency(userId);
            expect(consistencyCheck.consistent).toBe(true);
            if (!consistencyCheck.consistent) {
              console.error('Consistency errors:', consistencyCheck.errors);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should maintain consistency across user isolation boundaries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(wordDataArbitrary, { minLength: 1, maxLength: 3 }),
          async (wordsData) => {
            // Create two test users
            const userId1 = await createTestUser('usr1');
            const userId2 = await createTestUser('usr2');

            // Add words for both users
            for (const wordData of wordsData) {
              try {
                await wordService.saveWord(
                  userId1,
                  wordData.englishWord,
                  wordData.chineseTranslation,
                  wordData.imageUrl
                );
                await wordService.saveWord(
                  userId2,
                  wordData.englishWord + '2',
                  wordData.chineseTranslation,
                  wordData.imageUrl
                );
              } catch (error) {
                // Ignore validation errors
              }
            }

            // Verify consistency for both users
            const consistencyCheck1 = await verifyDatabaseConsistency(userId1);
            const consistencyCheck2 = await verifyDatabaseConsistency(userId2);

            expect(consistencyCheck1.consistent).toBe(true);
            expect(consistencyCheck2.consistent).toBe(true);

            if (!consistencyCheck1.consistent) {
              console.error('User 1 consistency errors:', consistencyCheck1.errors);
            }
            if (!consistencyCheck2.consistent) {
              console.error('User 2 consistency errors:', consistencyCheck2.errors);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });
});
