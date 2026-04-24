import { pool } from '../config/database';
import { ReviewSystemModule } from './review-system.module';
import { ValidationError } from '../utils/errors';
import { randomUUID } from 'crypto';

describe('ReviewSystemModule - Unit Tests', () => {
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

  describe('getDueWords', () => {
    // Requirements: 6.1, 6.4
    it('should return due words for a user', async () => {
      // Create a word with a due schedule
      const wordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [testUserId, 'apple', '苹果', 'https://example.com/apple.jpg']
      );
      const wordId = wordResult.rows[0].id;

      await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 day', 1, FALSE)`,
        [wordId, testUserId]
      );

      const result = await reviewSystemModule.getDueWords(testUserId, 20);

      expect(result.length).toBe(1);
      expect(result[0].word).toBe('apple');
      expect(result[0].translation).toBe('苹果');
      expect(result[0].imageUrl).toBe('https://example.com/apple.jpg');
    });

    // Requirements: 6.4
    it('should return empty array when no due words exist', async () => {
      const result = await reviewSystemModule.getDueWords(testUserId, 20);
      expect(result).toEqual([]);
    });

    // Requirements: 6.2
    it('should respect the limit parameter', async () => {
      // Create 5 words with due schedules
      const words = ['apple', 'banana', 'cat', 'dog', 'elephant'];
      for (let i = 0; i < 5; i++) {
        const wordResult = await pool.query(
          `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [testUserId, words[i], `翻译${i}`, `https://example.com/word${i}.jpg`]
        );

        await pool.query(
          `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
           VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 day', 1, FALSE)`,
          [wordResult.rows[0].id, testUserId]
        );
      }

      const result = await reviewSystemModule.getDueWords(testUserId, 3);
      expect(result.length).toBe(3);
    });

    // Requirements: 6.3
    it('should sort words by due_date ASC, then learned_at ASC', async () => {
      // Create words with different due dates
      const word1Result = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url, learned_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP - INTERVAL '5 days')
         RETURNING id`,
        [testUserId, 'apple', '翻译1', 'https://example.com/word1.jpg']
      );

      const word2Result = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url, learned_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP - INTERVAL '3 days')
         RETURNING id`,
        [testUserId, 'banana', '翻译2', 'https://example.com/word2.jpg']
      );

      // word1 due 2 days ago
      await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE - INTERVAL '2 days', 1, FALSE)`,
        [word1Result.rows[0].id, testUserId]
      );

      // word2 due 1 day ago (more recent, should come after word1)
      await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 day', 1, FALSE)`,
        [word2Result.rows[0].id, testUserId]
      );

      const result = await reviewSystemModule.getDueWords(testUserId, 20);

      expect(result.length).toBe(2);
      expect(result[0].word).toBe('word1'); // Earlier due date
      expect(result[1].word).toBe('word2'); // Later due date
    });

    it('should throw ValidationError for empty userId', async () => {
      await expect(reviewSystemModule.getDueWords('', 20)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid limit', async () => {
      await expect(reviewSystemModule.getDueWords(testUserId, 0)).rejects.toThrow(ValidationError);
      await expect(reviewSystemModule.getDueWords(testUserId, 21)).rejects.toThrow(ValidationError);
    });

    it('should not return completed schedules', async () => {
      const wordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [testUserId, 'completed', '已完成', 'https://example.com/completed.jpg']
      );

      await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 day', 1, TRUE)`,
        [wordResult.rows[0].id, testUserId]
      );

      const result = await reviewSystemModule.getDueWords(testUserId, 20);
      expect(result.length).toBe(0);
    });

    it('should not return future schedules', async () => {
      const wordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [testUserId, 'future', '未来', 'https://example.com/future.jpg']
      );

      await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE + INTERVAL '1 day', 1, FALSE)`,
        [wordResult.rows[0].id, testUserId]
      );

      const result = await reviewSystemModule.getDueWords(testUserId, 20);
      expect(result.length).toBe(0);
    });
  });

  describe('completeReview', () => {
    // Requirements: 5.4, 5.5, 9.1, 9.2, 9.3, 9.4
    it('should complete a review and create next schedule when correct', async () => {
      // Create a word with a due schedule
      const wordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [testUserId, 'test', '测试', 'https://example.com/test.jpg']
      );
      const wordId = wordResult.rows[0].id;

      const scheduleResult = await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 day', 1, FALSE)
         RETURNING id`,
        [wordId, testUserId]
      );
      const scheduleId = scheduleResult.rows[0].id;

      const result = await reviewSystemModule.completeReview(scheduleId, testUserId, true, 1500);

      // Verify next review date is returned
      expect(result.nextReviewDate).toBeInstanceOf(Date);
      expect(result.attemptId).toBeTruthy();

      // Verify review attempt was recorded (Requirement 9.1, 9.2)
      const attemptQuery = await pool.query(
        'SELECT * FROM review_attempts WHERE id = $1',
        [result.attemptId]
      );
      expect(attemptQuery.rows.length).toBe(1);
      expect(attemptQuery.rows[0].correct).toBe(true);
      expect(attemptQuery.rows[0].response_time_ms).toBe(1500);

      // Verify original schedule was marked completed (Requirement 5.4)
      const scheduleQuery = await pool.query(
        'SELECT completed FROM review_schedules WHERE id = $1',
        [scheduleId]
      );
      expect(scheduleQuery.rows[0].completed).toBe(true);

      // Verify next schedule was created (Requirement 9.3)
      const nextScheduleQuery = await pool.query(
        'SELECT * FROM review_schedules WHERE word_id = $1 AND completed = FALSE',
        [wordId]
      );
      expect(nextScheduleQuery.rows.length).toBe(1);
      expect(nextScheduleQuery.rows[0].interval_days).toBe(3); // Next interval after 1
    });

    it('should reset interval to 1 day when incorrect', async () => {
      // Create a word with interval 7
      const wordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [testUserId, 'test', '测试', 'https://example.com/test.jpg']
      );
      const wordId = wordResult.rows[0].id;

      const scheduleResult = await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 day', 7, FALSE)
         RETURNING id`,
        [wordId, testUserId]
      );
      const scheduleId = scheduleResult.rows[0].id;

      await reviewSystemModule.completeReview(scheduleId, testUserId, false);

      // Verify next schedule has interval 1 (Requirement 9.4)
      const nextScheduleQuery = await pool.query(
        'SELECT interval_days FROM review_schedules WHERE word_id = $1 AND completed = FALSE',
        [wordId]
      );
      expect(nextScheduleQuery.rows[0].interval_days).toBe(1);
    });

    it('should throw ValidationError for empty scheduleId', async () => {
      await expect(
        reviewSystemModule.completeReview('', testUserId, true)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty userId', async () => {
      await expect(
        reviewSystemModule.completeReview('some-id', '', true)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for non-boolean correct', async () => {
      await expect(
        reviewSystemModule.completeReview('some-id', testUserId, 'true' as any)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for negative responseTimeMs', async () => {
      await expect(
        reviewSystemModule.completeReview('some-id', testUserId, true, -100)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for non-existent schedule', async () => {
      await expect(
        reviewSystemModule.completeReview(randomUUID(), testUserId, true)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for already completed schedule', async () => {
      const wordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [testUserId, 'test', '测试', 'https://example.com/test.jpg']
      );

      const scheduleResult = await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE, 1, TRUE)
         RETURNING id`,
        [wordResult.rows[0].id, testUserId]
      );

      await expect(
        reviewSystemModule.completeReview(scheduleResult.rows[0].id, testUserId, true)
      ).rejects.toThrow(ValidationError);
    });

    it('should handle optional responseTimeMs', async () => {
      const wordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [testUserId, 'test', '测试', 'https://example.com/test.jpg']
      );

      const scheduleResult = await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE, 1, FALSE)
         RETURNING id`,
        [wordResult.rows[0].id, testUserId]
      );

      const result = await reviewSystemModule.completeReview(
        scheduleResult.rows[0].id,
        testUserId,
        true
      );

      const attemptQuery = await pool.query(
        'SELECT response_time_ms FROM review_attempts WHERE id = $1',
        [result.attemptId]
      );
      expect(attemptQuery.rows[0].response_time_ms).toBeNull();
    });
  });
});
