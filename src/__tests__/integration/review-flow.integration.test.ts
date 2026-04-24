/**
 * Integration Test: Complete Review Flow
 * Task 15.2 - 编写集成测试：完整复习流程
 * Requirements: 6.1, 7.1, 8.1, 9.1
 * 
 * Tests the complete review journey:
 * - Getting due words for review
 * - Generating quiz questions
 * - Answering quiz questions
 * - Recording results
 * - Verifying review schedule updates
 * - Verifying review attempt records
 */

import request from 'supertest';
import app from '../../index';
import { pool } from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

describe('Integration Test: Complete Review Flow', () => {
  let authToken: string;
  let userId: string;
  let wordId: string;
  let scheduleId: string;
  const testUsername = `reviewtest_${uuidv4().substring(0, 8)}`;

  beforeAll(async () => {
    // Setup: Create test user and word with due review
    await pool.query('SELECT 1');

    // 1. Register user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: testUsername,
        password: 'ReviewTest123',
      });

    userId = registerResponse.body.userId;
    authToken = registerResponse.body.token;

    // 2. Create a word directly in database
    const wordResult = await pool.query(
      `INSERT INTO words (user_id, english_word, chinese_translation, image_url, learned_at)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '2 days')
       RETURNING id`,
      [userId, 'test', '测试', 'https://example.com/test.jpg']
    );
    wordId = wordResult.rows[0].id;

    // 3. Create a due review schedule (due yesterday)
    const scheduleResult = await pool.query(
      `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
       VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 day', 1, FALSE)
       RETURNING id`,
      [wordId, userId]
    );
    scheduleId = scheduleResult.rows[0].id;

    // 4. Create additional words for distractor images
    for (let i = 0; i < 3; i++) {
      await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, $2, $3, $4)`,
        [userId, `word${i}`, `词${i}`, `https://example.com/word${i}.jpg`]
      );
    }
  }, 15000);

  afterAll(async () => {
    // Cleanup
    if (userId) {
      try {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    await pool.end();
  });

  describe('Step 1: Get Due Reviews', () => {
    /**
     * Test: Retrieve due words for review
     * Requirement: 6.1
     */
    it('should get due reviews for user', async () => {
      const response = await request(app)
        .get('/api/reviews/due')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('reviews');
      expect(response.body).toHaveProperty('totalDue');
      expect(Array.isArray(response.body.reviews)).toBe(true);
      expect(response.body.reviews.length).toBeGreaterThan(0);

      // Verify review structure
      const review = response.body.reviews[0];
      expect(review).toHaveProperty('wordId');
      expect(review).toHaveProperty('word');
      expect(review).toHaveProperty('translation');
      expect(review).toHaveProperty('imageUrl');
      expect(review).toHaveProperty('dueDate');
      expect(review).toHaveProperty('scheduleId');
    });

    /**
     * Test: Due reviews are sorted correctly
     * Requirement: 6.3
     */
    it('should return reviews sorted by due date', async () => {
      // Create multiple due reviews with different dates
      const word2Result = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, 'word2', '词2', 'https://example.com/word2.jpg')
         RETURNING id`,
        [userId]
      );

      await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE - INTERVAL '3 days', 1, FALSE)`,
        [word2Result.rows[0].id, userId]
      );

      const response = await request(app)
        .get('/api/reviews/due')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const reviews = response.body.reviews;
      expect(reviews.length).toBeGreaterThanOrEqual(2);

      // Verify sorting (earliest due date first)
      for (let i = 1; i < reviews.length; i++) {
        const prevDate = new Date(reviews[i - 1].dueDate);
        const currDate = new Date(reviews[i].dueDate);
        expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime());
      }
    });

    /**
     * Test: Limit parameter works correctly
     * Requirement: 6.2
     */
    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/reviews/due?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.reviews.length).toBeLessThanOrEqual(1);
    });

    /**
     * Test: No due reviews returns empty array
     * Requirement: 6.4
     */
    it('should return empty array when no reviews are due', async () => {
      // Create new user with no due reviews
      const newUsername = `noreviews_${uuidv4().substring(0, 8)}`;
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: newUsername,
          password: 'NoReviews123',
        });

      const newToken = registerResponse.body.token;
      const newUserId = registerResponse.body.userId;

      try {
        const response = await request(app)
          .get('/api/reviews/due')
          .set('Authorization', `Bearer ${newToken}`)
          .expect(200);

        expect(response.body.reviews).toEqual([]);
        expect(response.body.totalDue).toBe(0);
      } finally {
        await pool.query('DELETE FROM users WHERE id = $1', [newUserId]);
      }
    });
  });

  describe('Step 2: Generate Quiz', () => {
    /**
     * Test: Generate quiz for due words
     * Requirement: 7.1
     */
    it('should generate quiz questions for due words', async () => {
      const response = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('questions');
      expect(Array.isArray(response.body.questions)).toBe(true);
      expect(response.body.questions.length).toBeGreaterThan(0);

      // Verify question structure
      const question = response.body.questions[0];
      expect(question).toHaveProperty('questionId');
      expect(question).toHaveProperty('word');
      expect(question).toHaveProperty('translation');
      expect(question).toHaveProperty('options');
      expect(question).toHaveProperty('scheduleId');

      // Verify options structure
      expect(Array.isArray(question.options)).toBe(true);
      expect(question.options).toHaveLength(4);

      question.options.forEach((option: any) => {
        expect(option).toHaveProperty('imageUrl');
        expect(option.imageUrl).toMatch(/^https?:\/\//);
      });
    });

    /**
     * Test: Quiz has exactly 4 options
     * Requirement: 7.2
     */
    it('should generate exactly 4 image options per question', async () => {
      const response = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.questions.forEach((question: any) => {
        expect(question.options).toHaveLength(4);
      });
    });

    /**
     * Test: Correct answer is included in options
     * Requirement: 7.3
     */
    it('should include correct answer in quiz options', async () => {
      const response = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get the word's actual image URL
      const wordResult = await pool.query(
        'SELECT image_url FROM words WHERE id = $1',
        [wordId]
      );
      const correctImageUrl = wordResult.rows[0].image_url;

      // Find question for our test word
      const question = response.body.questions.find(
        (q: any) => q.word === 'test'
      );

      if (question) {
        const hasCorrectAnswer = question.options.some(
          (opt: any) => opt.imageUrl === correctImageUrl
        );
        expect(hasCorrectAnswer).toBe(true);
      }
    });
  });

  describe('Step 3: Answer Quiz', () => {
    let questionId: string;
    let correctImageUrl: string;

    beforeAll(async () => {
      // Generate quiz to get question
      const quizResponse = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`);

      const question = quizResponse.body.questions[0];
      questionId = question.questionId;

      // Get correct image URL from database
      const wordResult = await pool.query(
        'SELECT image_url FROM words WHERE id = $1',
        [wordId]
      );
      correctImageUrl = wordResult.rows[0].image_url;
    });

    /**
     * Test: Answer quiz correctly
     * Requirement: 8.1, 8.2
     */
    it('should validate correct answer', async () => {
      const response = await request(app)
        .post('/api/quiz/answer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionId,
          selectedImageUrl: correctImageUrl,
          scheduleId,
          responseTimeMs: 2000,
        })
        .expect(200);

      expect(response.body).toHaveProperty('correct', true);
      expect(response.body).toHaveProperty('correctImageUrl', correctImageUrl);
    });

    /**
     * Test: Answer quiz incorrectly
     * Requirement: 8.1, 8.3
     */
    it('should validate incorrect answer', async () => {
      // Generate new quiz
      const quizResponse = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`);

      const question = quizResponse.body.questions[0];
      const wrongImageUrl = 'https://example.com/wrong.jpg';

      const response = await request(app)
        .post('/api/quiz/answer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionId: question.questionId,
          selectedImageUrl: wrongImageUrl,
          scheduleId: question.scheduleId,
          responseTimeMs: 3000,
        })
        .expect(200);

      expect(response.body).toHaveProperty('correct', false);
      expect(response.body).toHaveProperty('correctImageUrl');
      expect(response.body.correctImageUrl).not.toBe(wrongImageUrl);
    });
  });

  describe('Step 4: Record Review Results', () => {
    /**
     * Test: Review attempt is recorded in database
     * Requirement: 9.1, 9.2
     */
    it('should record review attempt in database', async () => {
      // Answer a quiz question
      const quizResponse = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`);

      const question = quizResponse.body.questions[0];

      const wordResult = await pool.query(
        'SELECT image_url FROM words WHERE english_word = $1 AND user_id = $2',
        [question.word, userId]
      );
      const correctUrl = wordResult.rows[0].image_url;

      await request(app)
        .post('/api/quiz/answer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionId: question.questionId,
          selectedImageUrl: correctUrl,
          scheduleId: question.scheduleId,
          responseTimeMs: 1500,
        })
        .expect(200);

      // Verify review attempt was recorded
      const attemptResult = await pool.query(
        `SELECT * FROM review_attempts 
         WHERE schedule_id = $1 AND user_id = $2
         ORDER BY attempted_at DESC
         LIMIT 1`,
        [question.scheduleId, userId]
      );

      expect(attemptResult.rows.length).toBeGreaterThan(0);
      const attempt = attemptResult.rows[0];
      expect(attempt.correct).toBe(true);
      expect(attempt.response_time_ms).toBe(1500);
      expect(attempt.user_id).toBe(userId);
    });

    /**
     * Test: Review schedule is updated after correct answer
     * Requirement: 9.3
     */
    it('should update review schedule after correct answer', async () => {
      // Create a new word and schedule for this test
      const newWordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, 'schedule_test', '计划测试', 'https://example.com/schedule.jpg')
         RETURNING id`,
        [userId]
      );
      const newWordId = newWordResult.rows[0].id;

      const newScheduleResult = await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE, 1, FALSE)
         RETURNING id`,
        [newWordId, userId]
      );
      const newScheduleId = newScheduleResult.rows[0].id;

      // Generate quiz and answer correctly
      const quizResponse = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`);

      const question = quizResponse.body.questions.find(
        (q: any) => q.word === 'schedule_test'
      );

      if (question) {
        const wordResult = await pool.query(
          'SELECT image_url FROM words WHERE id = $1',
          [newWordId]
        );

        await request(app)
          .post('/api/quiz/answer')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            questionId: question.questionId,
            selectedImageUrl: wordResult.rows[0].image_url,
            scheduleId: question.scheduleId,
            responseTimeMs: 2000,
          })
          .expect(200);

        // Verify old schedule is marked completed
        const oldSchedule = await pool.query(
          'SELECT completed, completed_at FROM review_schedules WHERE id = $1',
          [newScheduleId]
        );

        expect(oldSchedule.rows[0].completed).toBe(true);
        expect(oldSchedule.rows[0].completed_at).toBeTruthy();

        // Verify new schedule was created with increased interval
        const newSchedules = await pool.query(
          `SELECT * FROM review_schedules 
           WHERE word_id = $1 AND completed = FALSE
           ORDER BY due_date ASC`,
          [newWordId]
        );

        expect(newSchedules.rows.length).toBeGreaterThan(0);
        const nextSchedule = newSchedules.rows[0];
        expect(nextSchedule.interval_days).toBeGreaterThan(1);
      }
    });

    /**
     * Test: Incorrect answer creates 1-day review
     * Requirement: 9.4
     */
    it('should schedule 1-day review after incorrect answer', async () => {
      // Create a new word and schedule
      const newWordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, 'incorrect_test', '错误测试', 'https://example.com/incorrect.jpg')
         RETURNING id`,
        [userId]
      );
      const newWordId = newWordResult.rows[0].id;

      const newScheduleResult = await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE, 3, FALSE)
         RETURNING id`,
        [newWordId, userId]
      );
      const newScheduleId = newScheduleResult.rows[0].id;

      // Generate quiz and answer incorrectly
      const quizResponse = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`);

      const question = quizResponse.body.questions.find(
        (q: any) => q.word === 'incorrect_test'
      );

      if (question) {
        await request(app)
          .post('/api/quiz/answer')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            questionId: question.questionId,
            selectedImageUrl: 'https://example.com/wrong.jpg',
            scheduleId: question.scheduleId,
            responseTimeMs: 2500,
          })
          .expect(200);

        // Verify new schedule has 1-day interval
        const newSchedules = await pool.query(
          `SELECT * FROM review_schedules 
           WHERE word_id = $1 AND completed = FALSE
           ORDER BY due_date ASC`,
          [newWordId]
        );

        expect(newSchedules.rows.length).toBeGreaterThan(0);
        const nextSchedule = newSchedules.rows[0];
        expect(nextSchedule.interval_days).toBe(1);

        // Verify due date is tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dueDate = new Date(nextSchedule.due_date);
        expect(dueDate.toDateString()).toBe(tomorrow.toDateString());
      }
    });
  });

  describe('Step 5: Complete Review Flow', () => {
    /**
     * Test: Full review flow from due words to completion
     * Requirements: 6.1, 7.1, 8.1, 9.1
     */
    it('should complete entire review flow', async () => {
      // 1. Get due reviews
      const dueResponse = await request(app)
        .get('/api/reviews/due')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(dueResponse.body.reviews.length).toBeGreaterThan(0);

      // 2. Generate quiz
      const quizResponse = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(quizResponse.body.questions.length).toBeGreaterThan(0);
      const question = quizResponse.body.questions[0];

      // 3. Get correct answer
      const wordResult = await pool.query(
        'SELECT image_url FROM words WHERE english_word = $1 AND user_id = $2',
        [question.word, userId]
      );
      const correctUrl = wordResult.rows[0].image_url;

      // 4. Answer quiz
      const answerResponse = await request(app)
        .post('/api/quiz/answer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionId: question.questionId,
          selectedImageUrl: correctUrl,
          scheduleId: question.scheduleId,
          responseTimeMs: 1800,
        })
        .expect(200);

      expect(answerResponse.body.correct).toBe(true);

      // 5. Verify database state
      const attemptCount = await pool.query(
        'SELECT COUNT(*) FROM review_attempts WHERE user_id = $1',
        [userId]
      );
      expect(parseInt(attemptCount.rows[0].count)).toBeGreaterThan(0);
    });
  });
});
