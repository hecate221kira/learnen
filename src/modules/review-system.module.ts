import { pool } from '../config/database';
import { ReviewScheduleService } from '../services/review-schedule.service';
import { ValidationError, DatabaseError } from '../utils/errors';

/**
 * ReviewSystemModule
 * 
 * Manages the review system including due word queries and review completion.
 * Integrates with ReviewScheduleService for Ebbinghaus forgetting curve logic.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 9.1, 9.2, 9.3, 9.4, 9.5
 */
export class ReviewSystemModule {
  private reviewScheduleService: ReviewScheduleService;

  constructor() {
    this.reviewScheduleService = new ReviewScheduleService();
  }

  /**
   * Get due words for review
   * 
   * Requirements: 6.1, 6.2, 6.3
   * 
   * @param userId - User ID
   * @param limit - Maximum number of words to return (1-20, default 20)
   * @returns Array of due words with their details
   */
  async getDueWords(
    userId: string,
    limit: number = 20
  ): Promise<Array<{
    scheduleId: string;
    wordId: string;
    word: string;
    translation: string;
    imageUrl: string;
    dueDate: Date;
    intervalDays: number;
    learnedAt: Date;
  }>> {
    // Validate inputs
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('用户ID不能为空');
    }

    if (limit < 1 || limit > 20) {
      throw new ValidationError('限制必须在1到20之间');
    }

    try {
      // Query database for due words
      // Sort by due_date ASC, learned_at ASC as per requirements 6.3
      const query = `
        SELECT 
          rs.id as schedule_id,
          w.id as word_id,
          w.english_word,
          w.chinese_translation,
          w.image_url,
          rs.due_date,
          rs.interval_days,
          w.learned_at
        FROM review_schedules rs
        JOIN words w ON rs.word_id = w.id
        WHERE rs.user_id = $1
          AND rs.completed = FALSE
          AND rs.due_date <= CURRENT_DATE
        ORDER BY rs.due_date ASC, w.learned_at ASC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);

      return result.rows.map((row) => ({
        scheduleId: row.schedule_id,
        wordId: row.word_id,
        word: row.english_word,
        translation: row.chinese_translation,
        imageUrl: row.image_url,
        dueDate: row.due_date,
        intervalDays: row.interval_days,
        learnedAt: row.learned_at,
      }));
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new DatabaseError('获取到期单词时发生数据库错误');
    }
  }

  /**
   * Complete a review and update schedule
   * 
   * Requirements: 5.4, 5.5, 9.1, 9.2, 9.3, 9.4
   * 
   * @param scheduleId - Review schedule ID
   * @param userId - User ID
   * @param correct - Whether the answer was correct
   * @param responseTimeMs - Optional response time in milliseconds
   * @returns Next review date
   */
  async completeReview(
    scheduleId: string,
    userId: string,
    correct: boolean,
    responseTimeMs?: number
  ): Promise<{ nextReviewDate: Date; attemptId: string }> {
    // Validate inputs
    if (!scheduleId || scheduleId.trim().length === 0) {
      throw new ValidationError('复习计划ID不能为空');
    }

    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('用户ID不能为空');
    }

    if (typeof correct !== 'boolean') {
      throw new ValidationError('正确性标志必须是布尔值');
    }

    if (responseTimeMs !== undefined && responseTimeMs <= 0) {
      throw new ValidationError('响应时间必须是正数');
    }

    try {
      // Start transaction
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Get schedule details
        const scheduleQuery = `
          SELECT id, word_id, user_id, interval_days, completed
          FROM review_schedules
          WHERE id = $1 AND user_id = $2
        `;
        const scheduleResult = await client.query(scheduleQuery, [scheduleId, userId]);

        if (scheduleResult.rows.length === 0) {
          throw new ValidationError('复习计划不存在或不属于该用户');
        }

        const schedule = scheduleResult.rows[0];

        if (schedule.completed) {
          throw new ValidationError('该复习计划已完成');
        }

        // Record review attempt (Requirement 9.1, 9.2)
        const attemptQuery = `
          INSERT INTO review_attempts (schedule_id, word_id, user_id, correct, response_time_ms)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `;
        const attemptResult = await client.query(attemptQuery, [
          scheduleId,
          schedule.word_id,
          userId,
          correct,
          responseTimeMs || null,
        ]);

        const attemptId = attemptResult.rows[0].id;

        // Mark schedule as completed (Requirement 5.4)
        await this.reviewScheduleService.markScheduleCompleted(scheduleId);

        // Create next review schedule based on correctness (Requirements 5.5, 9.3, 9.4)
        const nextSchedule = await this.reviewScheduleService.createNextSchedule(
          schedule.word_id,
          userId,
          schedule.interval_days,
          correct
        );

        await client.query('COMMIT');

        return {
          nextReviewDate: nextSchedule.dueDate,
          attemptId,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }

      if (error.code === '23503') {
        throw new DatabaseError('复习计划或单词不存在');
      }

      throw new DatabaseError('完成复习时发生数据库错误');
    }
  }
}
