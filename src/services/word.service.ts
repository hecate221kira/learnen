import { pool } from '../config/database';
import { Word } from '../types';
import { DatabaseError, ValidationError } from '../utils/errors';
import { validateWordInput } from '../utils/validation';
import { ReviewScheduleService } from './review-schedule.service';

export class WordService {
  private reviewScheduleService: ReviewScheduleService;

  constructor() {
    this.reviewScheduleService = new ReviewScheduleService();
  }
  /**
   * Save a word to the database and create initial review schedules
   * @param userId - User ID
   * @param englishWord - English word
   * @param chineseTranslation - Chinese translation
   * @param imageUrl - Image URL
   * @returns Saved word record with review schedule dates
   */
  async saveWord(
    userId: string,
    englishWord: string,
    chineseTranslation: string,
    imageUrl: string
  ): Promise<{ word: Word; reviewSchedule: Date[] }> {
    // Validate input
    validateWordInput(englishWord);

    if (!chineseTranslation || chineseTranslation.trim().length === 0) {
      throw new ValidationError('中文翻译不能为空');
    }

    if (!imageUrl || imageUrl.trim().length === 0) {
      throw new ValidationError('图像URL不能为空');
    }

    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('用户ID不能为空');
    }

    try {
      const query = `
        INSERT INTO words (user_id, english_word, chinese_translation, image_url)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, english_word, chinese_translation, image_url, image_validated_at, learned_at
      `;

      const result = await pool.query(query, [
        userId,
        englishWord.trim(),
        chineseTranslation.trim(),
        imageUrl.trim(),
      ]);

      if (result.rows.length === 0) {
        throw new DatabaseError('保存单词失败');
      }

      const row = result.rows[0];
      const word: Word = {
        id: row.id,
        userId: row.user_id,
        englishWord: row.english_word,
        chineseTranslation: row.chinese_translation,
        imageUrl: row.image_url,
        imageValidatedAt: row.image_validated_at,
        learnedAt: row.learned_at,
      };

      // Create initial review schedules (Requirements: 4.3, 5.1, 5.2, 5.3)
      const schedules = await this.reviewScheduleService.createInitialSchedules(
        word.id,
        userId,
        word.learnedAt
      );

      // Extract review dates
      const reviewSchedule = schedules.map((schedule) => schedule.dueDate);

      return { word, reviewSchedule };
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }

      // Handle database errors
      if (error.code === '23503') {
        // Foreign key violation
        throw new DatabaseError('用户不存在');
      }

      throw new DatabaseError('保存单词时发生数据库错误');
    }
  }

  /**
   * Get a word by ID
   * @param wordId - Word ID
   * @returns Word record or null if not found
   */
  async getWordById(wordId: string): Promise<Word | null> {
    if (!wordId || wordId.trim().length === 0) {
      throw new ValidationError('单词ID不能为空');
    }

    try {
      const query = `
        SELECT id, user_id, english_word, chinese_translation, image_url, image_validated_at, learned_at
        FROM words
        WHERE id = $1
      `;

      const result = await pool.query(query, [wordId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        englishWord: row.english_word,
        chineseTranslation: row.chinese_translation,
        imageUrl: row.image_url,
        imageValidatedAt: row.image_validated_at,
        learnedAt: row.learned_at,
      };
    } catch (error) {
      throw new DatabaseError('获取单词时发生数据库错误');
    }
  }

  /**
   * Get all words for a user
   * @param userId - User ID
   * @returns Array of word records
   */
  async getUserWords(userId: string): Promise<Word[]> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('用户ID不能为空');
    }

    try {
      const query = `
        SELECT id, user_id, english_word, chinese_translation, image_url, image_validated_at, learned_at
        FROM words
        WHERE user_id = $1
        ORDER BY learned_at DESC
      `;

      const result = await pool.query(query, [userId]);

      return result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        englishWord: row.english_word,
        chineseTranslation: row.chinese_translation,
        imageUrl: row.image_url,
        imageValidatedAt: row.image_validated_at,
        learnedAt: row.learned_at,
      }));
    } catch (error) {
      throw new DatabaseError('获取用户单词时发生数据库错误');
    }
  }

  /**
   * Delete a word by ID
   * @param wordId - Word ID
   * @returns True if deleted, false if not found
   */
  async deleteWord(wordId: string): Promise<boolean> {
    if (!wordId || wordId.trim().length === 0) {
      throw new ValidationError('单词ID不能为空');
    }

    try {
      const query = 'DELETE FROM words WHERE id = $1';
      const result = await pool.query(query, [wordId]);

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      throw new DatabaseError('删除单词时发生数据库错误');
    }
  }
}
