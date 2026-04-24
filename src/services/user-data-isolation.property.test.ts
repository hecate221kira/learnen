// Load environment variables before importing any modules
import dotenv from 'dotenv';
dotenv.config();

import fc from 'fast-check';
import { pool } from '../config/database';
import { WordService } from './word.service';
import { ReviewScheduleService } from './review-schedule.service';
import { AuthService } from './auth.service';

/**
 * Property-Based Test: User Data Isolation
 * 
 * Feature: children-english-learning-platform, Property 1: 用户数据隔离
 * **Validates: Requirements 1.5, 10.5**
 * 
 * 对于任意用户和学习记录，系统返回的所有学习数据都应该仅属于该用户，不应包含其他用户的数据。
 */

// Skip these tests if SKIP_DB_TESTS environment variable is set
const describeOrSkip = process.env.SKIP_DB_TESTS === 'true' ? describe.skip : describe;

describeOrSkip('Property-Based Test: User Data Isolation', () => {
  let wordService: WordService;
  let reviewScheduleService: ReviewScheduleService;
  let authService: AuthService;

  // Test user IDs for cleanup
  const testUserIds: string[] = [];

  beforeAll(async () => {
    wordService = new WordService();
    reviewScheduleService = new ReviewScheduleService();
    authService = new AuthService();
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

  it('should ensure each user can only access their own learning data', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary test data for multiple users
        fc.record({
          // Generate 2-5 users with their learning data
          numUsers: fc.integer({ min: 2, max: 5 }),
          wordsPerUser: fc.array(
            fc.array(
              fc.record({
                englishWord: fc.stringMatching(/^[a-zA-Z ]{1,50}$/).filter(s => s.trim().length > 0),
                chineseTranslation: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                imageUrl: fc.webUrl(),
              }),
              { minLength: 1, maxLength: 5 }
            ),
            { minLength: 2, maxLength: 5 }
          ),
        }),
        async ({ numUsers, wordsPerUser }) => {
          // Setup: Create users
          const userIds: string[] = [];
          for (let i = 0; i < numUsers; i++) {
            const userId = await createTestUser(`usr${i}`);
            userIds.push(userId);
          }

          // Setup: Create words for each user
          const userWordIds: Map<string, string[]> = new Map();

          for (let i = 0; i < userIds.length && i < wordsPerUser.length; i++) {
            const userId = userIds[i];
            const words = wordsPerUser[i];
            const wordIds: string[] = [];

            for (const wordData of words) {
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

            userWordIds.set(userId, wordIds);
          }

          // Property Test: Verify data isolation for each user
          for (const userId of userIds) {
            // Test 1: getUserWords should only return words belonging to this user
            const userWords = await wordService.getUserWords(userId);

            // All returned words should belong to this user
            for (const word of userWords) {
              expect(word.userId).toBe(userId);
            }

            // Verify that no words from other users are included
            const expectedWordIds = userWordIds.get(userId) || [];
            const returnedWordIds = userWords.map(w => w.id);

            // All returned word IDs should be in the expected set
            for (const returnedId of returnedWordIds) {
              expect(expectedWordIds).toContain(returnedId);
            }

            // No word IDs from other users should be present
            for (const otherUserId of userIds) {
              if (otherUserId !== userId) {
                const otherUserWordIds = userWordIds.get(otherUserId) || [];
                for (const otherWordId of otherUserWordIds) {
                  expect(returnedWordIds).not.toContain(otherWordId);
                }
              }
            }

            // Test 2: getDueSchedules should only return schedules belonging to this user
            const dueSchedules = await reviewScheduleService.getDueSchedules(userId, 20);

            // All returned schedules should belong to this user
            for (const schedule of dueSchedules) {
              expect(schedule.userId).toBe(userId);

              // The word associated with this schedule should also belong to this user
              const word = await wordService.getWordById(schedule.wordId);
              expect(word).not.toBeNull();
              expect(word!.userId).toBe(userId);
            }

            // Test 3: Verify that accessing a word by ID respects ownership
            const userWordIds_local = userWordIds.get(userId) || [];
            for (const wordId of userWordIds_local) {
              const word = await wordService.getWordById(wordId);
              expect(word).not.toBeNull();
              expect(word!.userId).toBe(userId);
            }
          }

          // Additional Property: Cross-user verification
          // Ensure that no user's data appears in another user's results
          for (let i = 0; i < userIds.length; i++) {
            const userA = userIds[i];
            const userAWords = await wordService.getUserWords(userA);
            const userAWordIds = new Set(userAWords.map(w => w.id));

            for (let j = 0; j < userIds.length; j++) {
              if (i !== j) {
                const userB = userIds[j];
                const userBWords = await wordService.getUserWords(userB);
                const userBWordIds = new Set(userBWords.map(w => w.id));

                // No overlap should exist between user A's words and user B's words
                for (const wordId of userAWordIds) {
                  expect(userBWordIds.has(wordId)).toBe(false);
                }
              }
            }
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as required
    );
  }, 60000); // Increase timeout to 60 seconds

  it('should ensure review schedules are isolated per user', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test data for 2 users with overlapping word content
        fc.record({
          word1: fc.record({
            englishWord: fc.stringMatching(/^[a-zA-Z ]{1,50}$/).filter(s => s.trim().length > 0),
            chineseTranslation: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            imageUrl: fc.webUrl(),
          }),
          word2: fc.record({
            englishWord: fc.stringMatching(/^[a-zA-Z ]{1,50}$/).filter(s => s.trim().length > 0),
            chineseTranslation: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            imageUrl: fc.webUrl(),
          }),
        }),
        async ({ word1, word2 }) => {
          // Setup: Create both users
          const user1Id = await createTestUser('usr1');
          const user2Id = await createTestUser('usr2');

          // Setup: Both users learn words (potentially the same word content)
          const word1Result = await wordService.saveWord(
            user1Id,
            word1.englishWord,
            word1.chineseTranslation,
            word1.imageUrl
          );

          const word2Result = await wordService.saveWord(
            user2Id,
            word2.englishWord,
            word2.chineseTranslation,
            word2.imageUrl
          );

          // Property Test: Review schedules should be isolated
          const user1Schedules = await reviewScheduleService.getDueSchedules(user1Id, 20);
          const user2Schedules = await reviewScheduleService.getDueSchedules(user2Id, 20);

          // All schedules for user1 should reference user1's word
          for (const schedule of user1Schedules) {
            expect(schedule.userId).toBe(user1Id);
            expect(schedule.wordId).toBe(word1Result.word.id);
          }

          // All schedules for user2 should reference user2's word
          for (const schedule of user2Schedules) {
            expect(schedule.userId).toBe(user2Id);
            expect(schedule.wordId).toBe(word2Result.word.id);
          }

          // No schedule from user1 should appear in user2's results and vice versa
          const user1ScheduleIds = new Set(user1Schedules.map(s => s.id));
          const user2ScheduleIds = new Set(user2Schedules.map(s => s.id));

          for (const scheduleId of user1ScheduleIds) {
            expect(user2ScheduleIds.has(scheduleId)).toBe(false);
          }

          for (const scheduleId of user2ScheduleIds) {
            expect(user1ScheduleIds.has(scheduleId)).toBe(false);
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as required
    );
  }, 60000); // Increase timeout to 60 seconds

  it('should ensure word retrieval by ID respects user ownership', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          word: fc.record({
            englishWord: fc.stringMatching(/^[a-zA-Z ]{1,50}$/).filter(s => s.trim().length > 0),
            chineseTranslation: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            imageUrl: fc.webUrl(),
          }),
        }),
        async ({ word }) => {
          // Setup: Create both users
          const ownerUserId = await createTestUser('owner');
          const otherUserId = await createTestUser('other');

          // Setup: Owner user creates a word
          const savedWord = await wordService.saveWord(
            ownerUserId,
            word.englishWord,
            word.chineseTranslation,
            word.imageUrl
          );

          // Property Test: Word retrieval should show correct ownership
          const retrievedWord = await wordService.getWordById(savedWord.word.id);

          expect(retrievedWord).not.toBeNull();
          expect(retrievedWord!.userId).toBe(ownerUserId);
          expect(retrievedWord!.userId).not.toBe(otherUserId);

          // The word should appear in owner's word list
          const ownerWords = await wordService.getUserWords(ownerUserId);
          const ownerWordIds = ownerWords.map(w => w.id);
          expect(ownerWordIds).toContain(savedWord.word.id);

          // The word should NOT appear in other user's word list
          const otherUserWords = await wordService.getUserWords(otherUserId);
          const otherUserWordIds = otherUserWords.map(w => w.id);
          expect(otherUserWordIds).not.toContain(savedWord.word.id);
        }
      ),
      { numRuns: 100 } // Run 100 iterations as required
    );
  }, 60000); // Increase timeout to 60 seconds
});
