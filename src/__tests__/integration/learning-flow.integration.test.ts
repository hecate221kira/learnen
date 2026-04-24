/**
 * Integration Test: Complete Learning Flow
 * Task 15.1 - 编写集成测试：完整学习流程
 * Requirements: 1.1, 2.1, 4.1, 4.3
 * 
 * Tests the complete user journey:
 * - User registration
 * - User login
 * - Learning a new word (translate + get image)
 * - Saving the word
 * - Verifying database state
 * - Verifying review schedule creation
 */

import request from 'supertest';
import app from '../../index';
import { pool } from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

describe('Integration Test: Complete Learning Flow', () => {
  let authToken: string;
  let userId: string;
  const testUsername = `testuser_${uuidv4().substring(0, 8)}`;
  const testPassword = 'TestPassword123';

  beforeAll(async () => {
    // Ensure database connection is ready
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // Clean up test data
    if (userId) {
      try {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    
    // Close database connections
    await pool.end();
  });

  describe('Step 1: User Registration', () => {
    /**
     * Test: User can register successfully
     * Requirement: 1.1
     */
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: testUsername,
          password: testPassword,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('token');

      userId = response.body.userId;
      authToken = response.body.token;

      // Verify user exists in database
      const result = await pool.query(
        'SELECT id, username FROM users WHERE id = $1',
        [userId]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].username).toBe(testUsername);
    });

    /**
     * Test: Cannot register with duplicate username
     * Requirement: 1.1
     */
    it('should reject duplicate username registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: testUsername,
          password: testPassword,
        })
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('已存在');
    });
  });

  describe('Step 2: User Login', () => {
    /**
     * Test: User can login with valid credentials
     * Requirement: 1.1
     */
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe(testUsername);

      // Update token for subsequent requests
      authToken = response.body.token;
    });

    /**
     * Test: Login fails with invalid credentials
     * Requirement: 1.1
     */
    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Step 3: Learn New Word - Translation and Image', () => {
    /**
     * Test: Translate word and get image
     * Requirements: 2.1, 3.1
     */
    it('should translate word and retrieve image', async () => {
      const response = await request(app)
        .post('/api/words/translate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          word: 'apple',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('word', 'apple');
      expect(response.body).toHaveProperty('translation');
      expect(response.body).toHaveProperty('imageUrl');

      // Verify translation is in Chinese
      expect(response.body.translation).toBeTruthy();
      expect(response.body.translation.length).toBeGreaterThan(0);

      // Verify image URL format
      expect(response.body.imageUrl).toMatch(/^https?:\/\//);
    }, 10000); // Allow extra time for API calls

    /**
     * Test: Reject invalid word input
     * Requirement: 2.5
     */
    it('should reject word with invalid characters', async () => {
      const response = await request(app)
        .post('/api/words/translate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          word: 'test123!@#',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('字母');
    });

    /**
     * Test: Reject empty word input
     * Requirement: 2.5
     */
    it('should reject empty word input', async () => {
      const response = await request(app)
        .post('/api/words/translate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          word: '',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Step 4: Save Word', () => {
    let wordId: string;
    let translationResult: any;

    beforeAll(async () => {
      // Get translation first
      const response = await request(app)
        .post('/api/words/translate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ word: 'book' });

      translationResult = response.body;
    }, 10000);

    /**
     * Test: Save word with translation and image
     * Requirements: 4.1, 4.2
     */
    it('should save word successfully', async () => {
      const response = await request(app)
        .post('/api/words/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          word: translationResult.word,
          translation: translationResult.translation,
          imageUrl: translationResult.imageUrl,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('wordId');
      expect(response.body).toHaveProperty('reviewSchedule');

      wordId = response.body.wordId;

      // Verify word exists in database
      const wordResult = await pool.query(
        'SELECT * FROM words WHERE id = $1',
        [wordId]
      );

      expect(wordResult.rows).toHaveLength(1);
      expect(wordResult.rows[0].english_word).toBe('book');
      expect(wordResult.rows[0].chinese_translation).toBe(translationResult.translation);
      expect(wordResult.rows[0].image_url).toBe(translationResult.imageUrl);
      expect(wordResult.rows[0].user_id).toBe(userId);
    });

    /**
     * Test: Verify review schedule creation
     * Requirements: 4.3, 5.1, 5.2
     */
    it('should create initial review schedule', async () => {
      // Query review schedules for the saved word
      const scheduleResult = await pool.query(
        `SELECT * FROM review_schedules 
         WHERE word_id = $1 AND user_id = $2
         ORDER BY due_date ASC`,
        [wordId, userId]
      );

      // Should have exactly 5 review schedules
      expect(scheduleResult.rows).toHaveLength(5);

      // Verify intervals: 1, 3, 7, 15, 30 days
      const expectedIntervals = [1, 3, 7, 15, 30];
      scheduleResult.rows.forEach((schedule, index) => {
        expect(schedule.interval_days).toBe(expectedIntervals[index]);
        expect(schedule.completed).toBe(false);
        expect(schedule.user_id).toBe(userId);
      });

      // Verify due dates are in the future
      const now = new Date();
      scheduleResult.rows.forEach((schedule) => {
        const dueDate = new Date(schedule.due_date);
        expect(dueDate.getTime()).toBeGreaterThan(now.getTime());
      });
    });

    /**
     * Test: Verify data integrity after save
     * Requirement: 4.2
     */
    it('should maintain data integrity across tables', async () => {
      // Verify foreign key relationships
      const result = await pool.query(
        `SELECT w.*, rs.id as schedule_id
         FROM words w
         LEFT JOIN review_schedules rs ON w.id = rs.word_id
         WHERE w.id = $1`,
        [wordId]
      );

      expect(result.rows.length).toBeGreaterThan(0);
      result.rows.forEach((row) => {
        expect(row.schedule_id).toBeTruthy();
      });
    });
  });

  describe('Step 5: Complete Learning Flow', () => {
    /**
     * Test: Full flow from registration to word saved
     * Requirements: 1.1, 2.1, 4.1, 4.3
     */
    it('should complete entire learning flow for new user', async () => {
      const newUsername = `flowtest_${uuidv4().substring(0, 8)}`;
      let newUserId: string | undefined;
      let newToken: string;

      try {
        // 1. Register
        const registerResponse = await request(app)
          .post('/api/auth/register')
          .send({
            username: newUsername,
            password: 'FlowTest123',
          })
          .expect(201);

        newUserId = registerResponse.body.userId;
        newToken = registerResponse.body.token;

        // 2. Translate word
        const translateResponse = await request(app)
          .post('/api/words/translate')
          .set('Authorization', `Bearer ${newToken}`)
          .send({ word: 'cat' })
          .expect(200);

        expect(translateResponse.body.translation).toBeTruthy();

        // 3. Save word
        const saveResponse = await request(app)
          .post('/api/words/save')
          .set('Authorization', `Bearer ${newToken}`)
          .send({
            word: translateResponse.body.word,
            translation: translateResponse.body.translation,
            imageUrl: translateResponse.body.imageUrl,
          })
          .expect(201);

        expect(saveResponse.body.wordId).toBeTruthy();

        // 4. Verify complete state
        const wordCount = await pool.query(
          'SELECT COUNT(*) FROM words WHERE user_id = $1',
          [newUserId]
        );
        expect(parseInt(wordCount.rows[0].count)).toBe(1);

        const scheduleCount = await pool.query(
          'SELECT COUNT(*) FROM review_schedules WHERE user_id = $1',
          [newUserId]
        );
        expect(parseInt(scheduleCount.rows[0].count)).toBe(5);

        // Cleanup
        await pool.query('DELETE FROM users WHERE id = $1', [newUserId]);
      } catch (error) {
        // Cleanup on error
        if (newUserId) {
          await pool.query('DELETE FROM users WHERE id = $1', [newUserId]);
        }
        throw error;
      }
    }, 15000);
  });

  describe('Authentication and Authorization', () => {
    /**
     * Test: Protected routes require authentication
     * Requirement: 1.3
     */
    it('should reject requests without authentication token', async () => {
      await request(app)
        .post('/api/words/translate')
        .send({ word: 'test' })
        .expect(401);

      await request(app)
        .post('/api/words/save')
        .send({ word: 'test', translation: '测试', imageUrl: 'http://example.com' })
        .expect(401);
    });

    /**
     * Test: Invalid token is rejected
     * Requirement: 1.3
     */
    it('should reject requests with invalid token', async () => {
      await request(app)
        .post('/api/words/translate')
        .set('Authorization', 'Bearer invalid_token_here')
        .send({ word: 'test' })
        .expect(401);
    });
  });
});
