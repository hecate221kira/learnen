/**
 * End-to-End Test: Key User Flows
 * Task 15.4 - 编写端到端测试：关键用户流程
 * Requirements: 1.1, 2.1, 6.1
 * 
 * Tests complete user journeys from start to finish:
 * - User registration and login flow
 * - Learning new word flow
 * - Reviewing word flow
 * - Complete learning cycle
 */

import request from 'supertest';
import app from '../../index';
import { pool } from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

describe('E2E Test: Key User Flows', () => {
  beforeAll(async () => {
    // Ensure database is ready
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // Close database connections
    await pool.end();
  });

  describe('E2E Flow 1: User Registration and Login', () => {
    let userId: string;
    const username = `e2e_user_${uuidv4().substring(0, 8)}`;
    const password = 'E2ETest123!';

    afterAll(async () => {
      // Cleanup
      if (userId) {
        try {
          await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      }
    });

    /**
     * Test: Complete registration and login flow
     * Requirement: 1.1
     */
    it('should complete user registration and login flow', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username,
          password,
        })
        .expect(201);

      expect(registerResponse.body).toHaveProperty('success', true);
      expect(registerResponse.body).toHaveProperty('userId');
      expect(registerResponse.body).toHaveProperty('token');

      userId = registerResponse.body.userId;
      const registrationToken = registerResponse.body.token;

      // Step 2: Verify token works
      const verifyResponse = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${registrationToken}`)
        .expect(200);

      expect(verifyResponse.body).toHaveProperty('valid', true);
      expect(verifyResponse.body).toHaveProperty('userId', userId);

      // Step 3: Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${registrationToken}`)
        .expect(200);

      expect(logoutResponse.body).toHaveProperty('success', true);

      // Step 4: Login again
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username,
          password,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('success', true);
      expect(loginResponse.body).toHaveProperty('token');
      expect(loginResponse.body.user.username).toBe(username);

      // Step 5: Verify new token works
      const newToken = loginResponse.body.token;
      const verifyResponse2 = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(verifyResponse2.body).toHaveProperty('valid', true);
    });

    /**
     * Test: Registration validation
     * Requirement: 1.1
     */
    it('should validate registration inputs', async () => {
      // Too short username
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab',
          password: 'ValidPass123',
        })
        .expect(400);

      // Too short password
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'validuser',
          password: '123',
        })
        .expect(400);

      // Missing fields
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'validuser',
        })
        .expect(400);
    });

    /**
     * Test: Login validation
     * Requirement: 1.1
     */
    it('should validate login credentials', async () => {
      // Wrong password
      await request(app)
        .post('/api/auth/login')
        .send({
          username,
          password: 'WrongPassword',
        })
        .expect(401);

      // Non-existent user
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistentuser123456',
          password: 'SomePassword',
        })
        .expect(401);
    });

    /**
     * Test: Session persistence
     * Requirement: 1.3
     */
    it('should maintain session across requests', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username,
          password,
        })
        .expect(200);

      const token = loginResponse.body.token;

      // Make multiple authenticated requests
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .get('/api/auth/verify')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.valid).toBe(true);
      }
    });
  });

  describe('E2E Flow 2: Learning New Word', () => {
    let userId: string;
    let authToken: string;
    const username = `e2e_learn_${uuidv4().substring(0, 8)}`;

    beforeAll(async () => {
      // Setup user
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username,
          password: 'LearnTest123',
        });

      userId = response.body.userId;
      authToken = response.body.token;
    }, 10000);

    afterAll(async () => {
      // Cleanup
      if (userId) {
        try {
          await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      }
    });

    /**
     * Test: Complete word learning flow
     * Requirements: 2.1, 4.1
     */
    it('should complete word learning flow from input to save', async () => {
      const word = 'elephant';

      // Step 1: Translate word
      const translateResponse = await request(app)
        .post('/api/words/translate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ word })
        .expect(200);

      expect(translateResponse.body).toHaveProperty('success', true);
      expect(translateResponse.body).toHaveProperty('word', word);
      expect(translateResponse.body).toHaveProperty('translation');
      expect(translateResponse.body).toHaveProperty('imageUrl');

      const { translation, imageUrl } = translateResponse.body;

      // Step 2: Save word
      const saveResponse = await request(app)
        .post('/api/words/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          word,
          translation,
          imageUrl,
        })
        .expect(201);

      expect(saveResponse.body).toHaveProperty('success', true);
      expect(saveResponse.body).toHaveProperty('wordId');
      expect(saveResponse.body).toHaveProperty('reviewSchedule');

      const wordId = saveResponse.body.wordId;

      // Step 3: Verify word is saved in database
      const dbResult = await pool.query(
        'SELECT * FROM words WHERE id = $1 AND user_id = $2',
        [wordId, userId]
      );

      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].english_word).toBe(word);
      expect(dbResult.rows[0].chinese_translation).toBe(translation);

      // Step 4: Verify review schedule is created
      const scheduleResult = await pool.query(
        'SELECT * FROM review_schedules WHERE word_id = $1 AND user_id = $2',
        [wordId, userId]
      );

      expect(scheduleResult.rows).toHaveLength(5);
    }, 15000);

    /**
     * Test: Learning multiple words
     * Requirements: 2.1, 4.1
     */
    it('should handle learning multiple words in sequence', async () => {
      const words = ['dog', 'cat', 'bird'];

      for (const word of words) {
        // Translate
        const translateResponse = await request(app)
          .post('/api/words/translate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ word })
          .expect(200);

        // Save
        await request(app)
          .post('/api/words/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            word,
            translation: translateResponse.body.translation,
            imageUrl: translateResponse.body.imageUrl,
          })
          .expect(201);
      }

      // Verify all words are saved
      const dbResult = await pool.query(
        'SELECT COUNT(*) FROM words WHERE user_id = $1',
        [userId]
      );

      expect(parseInt(dbResult.rows[0].count)).toBeGreaterThanOrEqual(words.length);
    }, 30000);

    /**
     * Test: Input validation during learning
     * Requirement: 2.5
     */
    it('should validate word inputs', async () => {
      // Empty word
      await request(app)
        .post('/api/words/translate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ word: '' })
        .expect(400);

      // Invalid characters
      await request(app)
        .post('/api/words/translate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ word: 'test123!@#' })
        .expect(400);

      // Too long
      await request(app)
        .post('/api/words/translate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ word: 'a'.repeat(51) })
        .expect(400);
    });

    /**
     * Test: Error recovery during learning
     * Requirement: 14.4
     */
    it('should handle errors gracefully during learning', async () => {
      // Try to save without translating first (missing data)
      const response = await request(app)
        .post('/api/words/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          word: 'incomplete',
          translation: '',
          imageUrl: '',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('E2E Flow 3: Reviewing Words', () => {
    let userId: string;
    let authToken: string;
    let wordId: string;
    let scheduleId: string;
    const username = `e2e_review_${uuidv4().substring(0, 8)}`;

    beforeAll(async () => {
      // Setup user with due review
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username,
          password: 'ReviewTest123',
        });

      userId = response.body.userId;
      authToken = response.body.token;

      // Create word with due review
      const wordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, 'review_word', '复习词', 'https://example.com/review.jpg')
         RETURNING id`,
        [userId]
      );
      wordId = wordResult.rows[0].id;

      const scheduleResult = await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE, 1, FALSE)
         RETURNING id`,
        [wordId, userId]
      );
      scheduleId = scheduleResult.rows[0].id;

      // Create distractor words
      for (let i = 0; i < 3; i++) {
        await pool.query(
          `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
           VALUES ($1, $2, $3, $4)`,
          [userId, `distractor${i}`, `干扰${i}`, `https://example.com/dist${i}.jpg`]
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
    });

    /**
     * Test: Complete review flow
     * Requirements: 6.1, 7.1, 8.1
     */
    it('should complete review flow from due words to answer', async () => {
      // Step 1: Check for due reviews
      const dueResponse = await request(app)
        .get('/api/reviews/due')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(dueResponse.body.reviews.length).toBeGreaterThan(0);
      expect(dueResponse.body.totalDue).toBeGreaterThan(0);

      // Step 2: Generate quiz
      const quizResponse = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(quizResponse.body.questions.length).toBeGreaterThan(0);

      const question = quizResponse.body.questions[0];
      expect(question).toHaveProperty('questionId');
      expect(question).toHaveProperty('word');
      expect(question).toHaveProperty('options');
      expect(question.options).toHaveLength(4);

      // Step 3: Get correct answer
      const wordResult = await pool.query(
        'SELECT image_url FROM words WHERE id = $1',
        [wordId]
      );
      const correctUrl = wordResult.rows[0].image_url;

      // Step 4: Answer quiz
      const answerResponse = await request(app)
        .post('/api/quiz/answer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionId: question.questionId,
          selectedImageUrl: correctUrl,
          scheduleId: question.scheduleId,
          responseTimeMs: 2000,
        })
        .expect(200);

      expect(answerResponse.body).toHaveProperty('correct', true);

      // Step 5: Verify review was recorded
      const attemptResult = await pool.query(
        'SELECT * FROM review_attempts WHERE user_id = $1',
        [userId]
      );

      expect(attemptResult.rows.length).toBeGreaterThan(0);
    });

    /**
     * Test: Review with correct answer
     * Requirements: 8.2, 9.3
     */
    it('should handle correct answer and update schedule', async () => {
      // Create new word for this test
      const newWordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, 'correct_test', '正确测试', 'https://example.com/correct.jpg')
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

      // Generate quiz
      const quizResponse = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const question = quizResponse.body.questions.find(
        (q: any) => q.word === 'correct_test'
      );

      if (question) {
        const wordResult = await pool.query(
          'SELECT image_url FROM words WHERE id = $1',
          [newWordId]
        );

        // Answer correctly
        await request(app)
          .post('/api/quiz/answer')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            questionId: question.questionId,
            selectedImageUrl: wordResult.rows[0].image_url,
            scheduleId: question.scheduleId,
            responseTimeMs: 1500,
          })
          .expect(200);

        // Verify schedule was updated
        const scheduleResult = await pool.query(
          'SELECT completed FROM review_schedules WHERE id = $1',
          [newScheduleId]
        );

        expect(scheduleResult.rows[0].completed).toBe(true);

        // Verify new schedule was created
        const newSchedules = await pool.query(
          'SELECT * FROM review_schedules WHERE word_id = $1 AND completed = FALSE',
          [newWordId]
        );

        expect(newSchedules.rows.length).toBeGreaterThan(0);
      }
    });

    /**
     * Test: Review with incorrect answer
     * Requirements: 8.3, 9.4
     */
    it('should handle incorrect answer and reschedule', async () => {
      // Create new word for this test
      const newWordResult = await pool.query(
        `INSERT INTO words (user_id, english_word, chinese_translation, image_url)
         VALUES ($1, 'incorrect_test', '错误测试', 'https://example.com/incorrect.jpg')
         RETURNING id`,
        [userId]
      );
      const newWordId = newWordResult.rows[0].id;

      await pool.query(
        `INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
         VALUES ($1, $2, CURRENT_DATE, 3, FALSE)`,
        [newWordId, userId]
      );

      // Generate quiz
      const quizResponse = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const question = quizResponse.body.questions.find(
        (q: any) => q.word === 'incorrect_test'
      );

      if (question) {
        // Answer incorrectly
        const answerResponse = await request(app)
          .post('/api/quiz/answer')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            questionId: question.questionId,
            selectedImageUrl: 'https://example.com/wrong.jpg',
            scheduleId: question.scheduleId,
            responseTimeMs: 2500,
          })
          .expect(200);

        expect(answerResponse.body.correct).toBe(false);

        // Verify 1-day schedule was created
        const newSchedules = await pool.query(
          `SELECT * FROM review_schedules 
           WHERE word_id = $1 AND completed = FALSE
           ORDER BY due_date ASC`,
          [newWordId]
        );

        expect(newSchedules.rows.length).toBeGreaterThan(0);
        expect(newSchedules.rows[0].interval_days).toBe(1);
      }
    });

    /**
     * Test: No reviews available
     * Requirement: 6.4
     */
    it('should handle no reviews available gracefully', async () => {
      // Create user with no due reviews
      const newUsername = `e2e_noreviews_${uuidv4().substring(0, 8)}`;
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

        // Quiz generation should also return empty
        const quizResponse = await request(app)
          .get('/api/quiz/generate')
          .set('Authorization', `Bearer ${newToken}`)
          .expect(200);

        expect(quizResponse.body.questions).toEqual([]);
      } finally {
        await pool.query('DELETE FROM users WHERE id = $1', [newUserId]);
      }
    });
  });

  describe('E2E Flow 4: Complete Learning Cycle', () => {
    let userId: string;
    let authToken: string;
    const username = `e2e_cycle_${uuidv4().substring(0, 8)}`;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username,
          password: 'CycleTest123',
        });

      userId = response.body.userId;
      authToken = response.body.token;
    }, 10000);

    afterAll(async () => {
      if (userId) {
        try {
          await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      }
    });

    /**
     * Test: Complete learning cycle from registration to review
     * Requirements: 1.1, 2.1, 6.1
     */
    it('should complete full learning cycle', async () => {
      const word = 'cycle';

      // Step 1: Learn word
      const translateResponse = await request(app)
        .post('/api/words/translate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ word })
        .expect(200);

      const saveResponse = await request(app)
        .post('/api/words/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          word,
          translation: translateResponse.body.translation,
          imageUrl: translateResponse.body.imageUrl,
        })
        .expect(201);

      const wordId = saveResponse.body.wordId;

      // Step 2: Verify initial state
      const wordCount = await pool.query(
        'SELECT COUNT(*) FROM words WHERE user_id = $1',
        [userId]
      );
      expect(parseInt(wordCount.rows[0].count)).toBeGreaterThan(0);

      const scheduleCount = await pool.query(
        'SELECT COUNT(*) FROM review_schedules WHERE user_id = $1',
        [userId]
      );
      expect(parseInt(scheduleCount.rows[0].count)).toBe(5);

      // Step 3: Make review due (simulate time passing)
      await pool.query(
        `UPDATE review_schedules 
         SET due_date = CURRENT_DATE - INTERVAL '1 day'
         WHERE word_id = $1 AND interval_days = 1`,
        [wordId]
      );

      // Step 4: Check due reviews
      const dueResponse = await request(app)
        .get('/api/reviews/due')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(dueResponse.body.reviews.length).toBeGreaterThan(0);

      // Step 5: Complete review
      const quizResponse = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const question = quizResponse.body.questions[0];

      const wordResult = await pool.query(
        'SELECT image_url FROM words WHERE id = $1',
        [wordId]
      );

      await request(app)
        .post('/api/quiz/answer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionId: question.questionId,
          selectedImageUrl: wordResult.rows[0].image_url,
          scheduleId: question.scheduleId,
          responseTimeMs: 1800,
        })
        .expect(200);

      // Step 6: Verify final state
      const attemptCount = await pool.query(
        'SELECT COUNT(*) FROM review_attempts WHERE user_id = $1',
        [userId]
      );
      expect(parseInt(attemptCount.rows[0].count)).toBeGreaterThan(0);

      const completedCount = await pool.query(
        'SELECT COUNT(*) FROM review_schedules WHERE user_id = $1 AND completed = TRUE',
        [userId]
      );
      expect(parseInt(completedCount.rows[0].count)).toBeGreaterThan(0);
    }, 20000);

    /**
     * Test: Multiple learning cycles
     * Requirements: 1.1, 2.1, 6.1
     */
    it('should handle multiple learning cycles', async () => {
      const words = ['first', 'second', 'third'];

      // Learn multiple words
      for (const word of words) {
        const translateResponse = await request(app)
          .post('/api/words/translate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ word })
          .expect(200);

        await request(app)
          .post('/api/words/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            word,
            translation: translateResponse.body.translation,
            imageUrl: translateResponse.body.imageUrl,
          })
          .expect(201);
      }

      // Make all reviews due
      await pool.query(
        `UPDATE review_schedules 
         SET due_date = CURRENT_DATE - INTERVAL '1 day'
         WHERE user_id = $1 AND completed = FALSE`,
        [userId]
      );

      // Review all words
      const quizResponse = await request(app)
        .get('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(quizResponse.body.questions.length).toBeGreaterThanOrEqual(words.length);

      // Answer all questions
      for (const question of quizResponse.body.questions) {
        const wordResult = await pool.query(
          'SELECT image_url FROM words WHERE english_word = $1 AND user_id = $2',
          [question.word, userId]
        );

        if (wordResult.rows.length > 0) {
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
        }
      }

      // Verify all reviews were recorded
      const attemptCount = await pool.query(
        'SELECT COUNT(*) FROM review_attempts WHERE user_id = $1',
        [userId]
      );
      expect(parseInt(attemptCount.rows[0].count)).toBeGreaterThanOrEqual(words.length);
    }, 40000);
  });
});
