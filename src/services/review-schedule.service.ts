import { pool } from '../config/database';
import { ReviewSchedule } from '../types';
import { DatabaseError, ValidationError } from '../utils/errors';

/**
 * ReviewScheduleService
 * 
 * Implements the Ebbinghaus forgetting curve algorithm for spaced repetition.
 * Manages review schedules with intervals: 1, 3, 7, 15, 30, 60, 90 days.
 * 
 * Requirements: 5.1, 5.2, 5.3, 4.3
 */
export class ReviewScheduleService {
  // Ebbinghaus forgetting curve intervals in days
  private readonly INTERVALS = [1, 3, 7, 15, 30, 60, 90];
  private readonly INITIAL_INTERVALS = [1, 3, 7, 15, 30];

  /**
   * Calculate initial review schedule based on Ebbinghaus forgetting curve
   * 
   * Requirements: 5.1, 5.2
   * 
   * @param learnedDate - The date when the word was learned
   * @returns Array of 5 review dates (1, 3, 7, 15, 30 days after learned date)
   */
  calculateInitialSchedule(learnedDate: Date): Date[] {
    if (!learnedDate || !(learnedDate instanceof Date) || isNaN(learnedDate.getTime())) {
      throw new ValidationError('学习日期无效');
    }

    return this.INITIAL_INTERVALS.map((days) => {
      const reviewDate = new Date(learnedDate);
      reviewDate.setDate(reviewDate.getDate() + days);
      return reviewDate;
    });
  }

  /**
   * Calculate next review date based on current interval and answer correctness
   * 
   * Requirements: 5.5, 9.3, 9.4
   * 
   * @param currentInterval - Current interval in days
   * @param correct - Whether the user answered correctly
   * @returns Next review date
   */
  calculateNextReview(currentInterval: number, correct: boolean): Date {
    if (typeof currentInterval !== 'number' || currentInterval <= 0) {
      throw new ValidationError('当前间隔必须是正数');
    }

    if (typeof correct !== 'boolean') {
      throw new ValidationError('正确性标志必须是布尔值');
    }

    const now = new Date();

    if (correct) {
      // Move to next interval in the sequence
      const nextInterval = this.getNextInterval(currentInterval);
      const nextReviewDate = new Date(now);
      nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);
      return nextReviewDate;
    } else {
      // Reset to 1 day for incorrect answer
      const nextReviewDate = new Date(now);
      nextReviewDate.setDate(nextReviewDate.getDate() + 1);
      return nextReviewDate;
    }
  }

  /**
   * Get the next interval in the sequence
   * 
   * @param currentInterval - Current interval in days
   * @returns Next interval in days
   */
  private getNextInterval(currentInterval: number): number {
    const index = this.INTERVALS.indexOf(currentInterval);

    if (index === -1) {
      // If current interval not in sequence, find the next larger one
      for (const interval of this.INTERVALS) {
        if (interval > currentInterval) {
          return interval;
        }
      }
      // If larger than all intervals, return max interval
      return this.INTERVALS[this.INTERVALS.length - 1];
    }

    // If at the end of sequence, stay at max interval
    if (index === this.INTERVALS.length - 1) {
      return this.INTERVALS[this.INTERVALS.length - 1];
    }

    // Return next interval in sequence
    return this.INTERVALS[index + 1];
  }

  /**
   * Create initial review schedules for a newly learned word
   * 
   * Requirements: 4.3, 5.3
   * 
   * @param wordId - Word ID
   * @param userId - User ID
   * @param learnedDate - Date when word was learned (defaults to now)
   * @returns Array of created review schedules
   */
  async createInitialSchedules(
    wordId: string,
    userId: string,
    learnedDate: Date = new Date()
  ): Promise<ReviewSchedule[]> {
    if (!wordId || wordId.trim().length === 0) {
      throw new ValidationError('单词ID不能为空');
    }

    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('用户ID不能为空');
    }

    try {
      // Calculate review dates
      const reviewDates = this.calculateInitialSchedule(learnedDate);

      // Prepare batch insert values
      const values: any[] = [];
      const placeholders: string[] = [];

      reviewDates.forEach((date, index) => {
        const offset = index * 5;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
        );
        values.push(
          wordId,
          userId,
          date.toISOString().split('T')[0], // Format as DATE
          this.INITIAL_INTERVALS[index],
          false // completed = false
        );
      });

      // Batch insert all schedules
      const query = `
        INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
        VALUES ${placeholders.join(', ')}
        RETURNING id, word_id, user_id, due_date, interval_days, completed, completed_at
      `;

      const result = await pool.query(query, values);

      return result.rows.map((row) => ({
        id: row.id,
        wordId: row.word_id,
        userId: row.user_id,
        dueDate: row.due_date,
        intervalDays: row.interval_days,
        completed: row.completed,
        completedAt: row.completed_at,
      }));
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }

      // Handle database errors
      if (error.code === '23503') {
        // Foreign key violation
        throw new DatabaseError('单词或用户不存在');
      }

      throw new DatabaseError('创建复习计划时发生数据库错误');
    }
  }

  /**
   * Create next review schedule after completing a review
   * 
   * Requirements: 5.5, 9.3, 9.4
   * 
   * @param wordId - Word ID
   * @param userId - User ID
   * @param currentInterval - Current interval in days
   * @param correct - Whether the answer was correct
   * @returns Created review schedule
   */
  async createNextSchedule(
    wordId: string,
    userId: string,
    currentInterval: number,
    correct: boolean
  ): Promise<ReviewSchedule> {
    if (!wordId || wordId.trim().length === 0) {
      throw new ValidationError('单词ID不能为空');
    }

    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('用户ID不能为空');
    }

    try {
      // Calculate next review date
      const nextReviewDate = this.calculateNextReview(currentInterval, correct);
      const nextInterval = correct ? this.getNextInterval(currentInterval) : 1;

      // Insert new schedule
      const query = `
        INSERT INTO review_schedules (word_id, user_id, due_date, interval_days, completed)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, word_id, user_id, due_date, interval_days, completed, completed_at
      `;

      const result = await pool.query(query, [
        wordId,
        userId,
        nextReviewDate.toISOString().split('T')[0],
        nextInterval,
        false,
      ]);

      if (result.rows.length === 0) {
        throw new DatabaseError('创建下一个复习计划失败');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        wordId: row.word_id,
        userId: row.user_id,
        dueDate: row.due_date,
        intervalDays: row.interval_days,
        completed: row.completed,
        completedAt: row.completed_at,
      };
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }

      if (error.code === '23503') {
        throw new DatabaseError('单词或用户不存在');
      }

      throw new DatabaseError('创建下一个复习计划时发生数据库错误');
    }
  }

  /**
   * Mark a review schedule as completed
   * 
   * Requirements: 5.4
   * 
   * @param scheduleId - Review schedule ID
   * @returns Updated review schedule
   */
  async markScheduleCompleted(scheduleId: string): Promise<ReviewSchedule> {
    if (!scheduleId || scheduleId.trim().length === 0) {
      throw new ValidationError('复习计划ID不能为空');
    }

    try {
      const query = `
        UPDATE review_schedules
        SET completed = TRUE, completed_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, word_id, user_id, due_date, interval_days, completed, completed_at
      `;

      const result = await pool.query(query, [scheduleId]);

      if (result.rows.length === 0) {
        throw new DatabaseError('复习计划不存在');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        wordId: row.word_id,
        userId: row.user_id,
        dueDate: row.due_date,
        intervalDays: row.interval_days,
        completed: row.completed,
        completedAt: row.completed_at,
      };
    } catch (error: any) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }

      throw new DatabaseError('标记复习计划完成时发生数据库错误');
    }
  }

  /**
   * Get due review schedules for a user
   * 
   * Requirements: 6.1, 6.2, 6.3
   * 
   * @param userId - User ID
   * @param limit - Maximum number of schedules to return (default 20)
   * @returns Array of due review schedules
   */
  async getDueSchedules(userId: string, limit: number = 20): Promise<ReviewSchedule[]> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('用户ID不能为空');
    }

    if (limit < 1 || limit > 20) {
      throw new ValidationError('限制必须在1到20之间');
    }

    try {
      const query = `
        SELECT id, word_id, user_id, due_date, interval_days, completed, completed_at
        FROM review_schedules
        WHERE user_id = $1
          AND completed = FALSE
          AND due_date <= CURRENT_DATE
        ORDER BY due_date ASC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);

      return result.rows.map((row) => ({
        id: row.id,
        wordId: row.word_id,
        userId: row.user_id,
        dueDate: row.due_date,
        intervalDays: row.interval_days,
        completed: row.completed,
        completedAt: row.completed_at,
      }));
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new DatabaseError('获取到期复习计划时发生数据库错误');
    }
  }
}
