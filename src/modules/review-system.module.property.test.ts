import fc from 'fast-check';
import { pool } from '../config/database';
import { ReviewSystemModule } from './review-system.module';
import { randomUUID } from 'crypto';

describe('ReviewSystemModule - Property Tests', () => {
  let testUserId: string;
  let reviewSystemModule: ReviewSystemModule;

  beforeAll(async () => {
    reviewSystemModule = new ReviewSystemModule();
    
    // Create a test user with short username (max 20 chars)
    const userResult = await pool.query(
      `INSERT INTO users (username, password_hash, email) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      [`rvw_${randomUUID().substring(0, 8)}`, 'hash123', 'test@example.com']
    );
    testUserId = userResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  afterEach(async () => {
    // Clean up words and schedules after each test
    await pool.query('DELETE FROM words WHERE user_id = $1', [testUserId]);
  });

  // Feature: children-english-learning-platform, Property 6: 到期单词数量限制
  // 对于任意数据库状态和查询请求，返回的到期复习单词数量应该在1到20之间（如果有到期单词）或为0（如果没有到期单词）
  // **Validates: Requirements 6.2**
  describe('Property 6: Due word count limit', () => {
    it('should return word count within valid range (0 or 1-20)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate random number of due words (0-30 to test limit)
            dueWordCount: fc.integer({ min: 0, max: 30 }),
            // Generate random limit parameter (1-20)
            limit: fc.integer({ min: 1, max: 20 }),
          }),
          async ({ dueWordCount, limit }) => {
            // Setup: Create words with due schedules
            const wordIds: string[] = [];
            
            for (let i = 0; i < dueWordCount; i++) {
              const wordResult = await pool.query(
                `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                [
                  testUserId,
                  `word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + ((i / 26) % 26))}`,
                  `翻译${i}`,
                  `https://example.com/image${i}.jpg`,
                ]
              );
              wordIds.push(wordResult.rows[0].id);

              // Create a due schedule (due date in the past)
              await pool.query(
                `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
                 VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 day', 1, FALSE)`,
                [wordResult.rows[0].id, testUserId]
              );
            }

            // Execute: Query due words
            const result = await reviewSystemModule.getDueWords(testUserId, limit);

            // Verify: Count is within valid range
            const count = result.length;

            if (dueWordCount === 0) {
              // If no due words exist, count should be 0
              expect(count).toBe(0);
            } else {
              // If due words exist, count should be between 1 and min(limit, dueWordCount)
              const expectedMax = Math.min(limit, dueWordCount);
              expect(count).toBeGreaterThanOrEqual(1);
              expect(count).toBeLessThanOrEqual(expectedMax);
              expect(count).toBeLessThanOrEqual(20); // Never exceed 20
            }

            // Cleanup
            for (const wordId of wordIds) {
              await pool.query('DELETE FROM words WHERE id = $1', [wordId]);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000); // Increase timeout for property test
  });

  // Feature: children-english-learning-platform, Property 7: 到期单词排序
  // 对于任意返回的到期单词列表，单词应该按照到期日期升序排列，最早到期的单词排在最前面
  // **Validates: Requirements 6.3**
  describe('Property 7: Due word sorting', () => {
    it('should return words sorted by due date ascending, then learned_at ascending', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate random number of words (2-15 to test sorting)
            wordCount: fc.integer({ min: 2, max: 15 }),
          }),
          async ({ wordCount }) => {
            // Setup: Create words with random due dates
            const wordIds: string[] = [];
            const dueDates: Date[] = [];
            
            for (let i = 0; i < wordCount; i++) {
              // Random due date in the past (0-30 days ago)
              const daysAgo = Math.floor(Math.random() * 30);
              const dueDate = new Date();
              dueDate.setDate(dueDate.getDate() - daysAgo);
              dueDates.push(dueDate);

              // Random learned_at time (for secondary sorting)
              const learnedDate = new Date();
              learnedDate.setDate(learnedDate.getDate() - (daysAgo + Math.floor(Math.random() * 10)));

              const wordResult = await pool.query(
                `INSERT INTO words (user_id, english_word, chinese_translation, image_url, learned_at)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [
                  testUserId,
                  `sortword${String.fromCharCode(97 + (i % 26))}`,
                  `翻译${i}`,
                  `https://example.com/image${i}.jpg`,
                  learnedDate,
                ]
              );
              wordIds.push(wordResult.rows[0].id);

              // Create a due schedule
              await pool.query(
                `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
                 VALUES ($1, $2, $3, 1, FALSE)`,
                [wordResult.rows[0].id, testUserId, dueDate.toISOString().split('T')[0]]
              );
            }

            // Execute: Query due words
            const result = await reviewSystemModule.getDueWords(testUserId, 20);

            // Verify: Results are sorted by due_date ASC, then learned_at ASC
            if (result.length > 1) {
              for (let i = 0; i < result.length - 1; i++) {
                const current = result[i];
                const next = result[i + 1];

                const currentDueDate = new Date(current.dueDate).getTime();
                const nextDueDate = new Date(next.dueDate).getTime();

                // Primary sort: due_date ASC
                if (currentDueDate !== nextDueDate) {
                  expect(currentDueDate).toBeLessThanOrEqual(nextDueDate);
                } else {
                  // Secondary sort: learned_at ASC (when due dates are equal)
                  const currentLearnedAt = new Date(current.learnedAt).getTime();
                  const nextLearnedAt = new Date(next.learnedAt).getTime();
                  expect(currentLearnedAt).toBeLessThanOrEqual(nextLearnedAt);
                }
              }
            }

            // Cleanup
            for (const wordId of wordIds) {
              await pool.query('DELETE FROM words WHERE id = $1', [wordId]);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000); // Increase timeout for property test
  });

  // Feature: children-english-learning-platform, Property 11: 复习记录完整性
  // 对于任意复习尝试，保存到数据库的记录应该包含所有必需字段：用户ID、单词ID、尝试时间、正确/错误标记，且这些字段的值应该准确反映实际情况
  // **Validates: Requirements 9.2**
  describe('Property 11: Review record completeness', () => {
    it('should save complete review attempt records with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate random correctness
            correct: fc.boolean(),
            // Generate optional response time (0-10000ms)
            responseTimeMs: fc.option(fc.integer({ min: 1, max: 10000 })),
          }),
          async ({ correct, responseTimeMs }) => {
            // Setup: Create a word with a due schedule
            const wordResult = await pool.query(
              `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
               VALUES ($1, $2, $3, $4)
               RETURNING id`,
              [
                testUserId,
                `testword${randomUUID().substring(0, 4).replace(/[^a-z]/gi, 'x')}`,
                '测试翻译',
                'https://example.com/test.jpg',
              ]
            );
            const wordId = wordResult.rows[0].id;

            const scheduleResult = await pool.query(
              `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
               VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 day', 1, FALSE)
               RETURNING id`,
              [wordId, testUserId]
            );
            const scheduleId = scheduleResult.rows[0].id;

            // Execute: Complete the review
            const result = await reviewSystemModule.completeReview(
              scheduleId,
              testUserId,
              correct,
              responseTimeMs ?? undefined
            );

            // Verify: Check that the review attempt record exists and is complete
            const attemptQuery = await pool.query(
              `SELECT id, schedule_id, word_id, user_id, attempted_at, correct, response_time_ms
               FROM review_attempts
               WHERE id = $1`,
              [result.attemptId]
            );

            expect(attemptQuery.rows.length).toBe(1);
            const attempt = attemptQuery.rows[0];

            // Verify all required fields are present and correct
            expect(attempt.id).toBeTruthy();
            expect(attempt.schedule_id).toBe(scheduleId);
            expect(attempt.word_id).toBe(wordId);
            expect(attempt.user_id).toBe(testUserId);
            expect(attempt.attempted_at).toBeInstanceOf(Date);
            expect(attempt.correct).toBe(correct);

            // Verify optional response time
            if (responseTimeMs !== null) {
              expect(attempt.response_time_ms).toBe(responseTimeMs);
            } else {
              expect(attempt.response_time_ms).toBeNull();
            }

            // Cleanup
            await pool.query('DELETE FROM words WHERE id = $1', [wordId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000); // Increase timeout for property test
  });
});
