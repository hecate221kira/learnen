import { Request, Response, NextFunction } from 'express';
import { ReviewSystemModule } from '../modules/review-system.module';
import { ValidationError } from '../utils/errors';

const reviewSystemModule = new ReviewSystemModule();

/**
 * Get due reviews for the authenticated user
 * 
 * Requirements: 6.1, 6.4
 * 
 * GET /api/reviews/due?limit=20
 */
export async function getDueReviews(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError('用户未认证');
    }

    // Parse limit parameter (default 20, range 1-20)
    const limitParam = req.query.limit as string | undefined;
    let limit = 20;

    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) {
        throw new ValidationError('限制必须在1到20之间');
      }
      limit = parsedLimit;
    }

    // Get due words
    const dueWords = await reviewSystemModule.getDueWords(userId, limit);

    // Return response (Requirement 6.4)
    res.json({
      success: true,
      reviews: dueWords.map((word) => ({
        scheduleId: word.scheduleId,
        wordId: word.wordId,
        word: word.word,
        translation: word.translation,
        imageUrl: word.imageUrl,
        dueDate: word.dueDate,
        intervalDays: word.intervalDays,
      })),
      totalDue: dueWords.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Complete a review
 * 
 * Requirements: 5.4, 5.5, 9.1, 9.2, 9.3, 9.4
 * 
 * POST /api/reviews/complete
 * Body: { scheduleId: string, correct: boolean, responseTimeMs?: number }
 */
export async function completeReview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError('用户未认证');
    }

    const { scheduleId, correct, responseTimeMs } = req.body;

    // Validate request body
    if (!scheduleId || typeof scheduleId !== 'string') {
      throw new ValidationError('复习计划ID是必需的');
    }

    if (typeof correct !== 'boolean') {
      throw new ValidationError('正确性标志是必需的');
    }

    if (responseTimeMs !== undefined && (typeof responseTimeMs !== 'number' || responseTimeMs <= 0)) {
      throw new ValidationError('响应时间必须是正数');
    }

    // Complete the review
    const result = await reviewSystemModule.completeReview(
      scheduleId,
      userId,
      correct,
      responseTimeMs
    );

    res.json({
      success: true,
      nextReviewDate: result.nextReviewDate,
      attemptId: result.attemptId,
    });
  } catch (error) {
    next(error);
  }
}
