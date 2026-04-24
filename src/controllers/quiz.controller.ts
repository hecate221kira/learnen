import { Request, Response, NextFunction } from 'express';
import { QuizModule } from '../modules/quiz.module';
import { ReviewSystemModule } from '../modules/review-system.module';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const quizModule = new QuizModule();
const reviewSystemModule = new ReviewSystemModule();

/**
 * Generate quiz questions for due words
 * 
 * Requirements: 6.5, 7.1
 * 
 * GET /api/quiz/generate?limit=20
 */
export async function generateQuiz(
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

    // Get due words from review system (Requirement 6.5)
    const dueWords = await reviewSystemModule.getDueWords(userId, limit);

    if (dueWords.length === 0) {
      res.json({
        success: true,
        questions: [],
        message: '当前没有需要复习的单词',
      });
      return;
    }

    // Generate quiz questions for each due word (Requirement 7.1)
    const questions = await Promise.all(
      dueWords.map((word) =>
        quizModule.generateQuestionAsync(
          {
            id: word.wordId,
            word: word.word,
            translation: word.translation,
            imageUrl: word.imageUrl,
          },
          userId
        )
      )
    );

    logger.info('Quiz generated', {
      userId,
      questionsCount: questions.length,
    });

    res.json({
      success: true,
      questions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Validate quiz answer and record result
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 * 
 * POST /api/quiz/answer
 * Body: { questionId: string, selectedImageUrl: string, scheduleId: string, responseTimeMs?: number }
 */
export async function answerQuiz(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError('用户未认证');
    }

    const { questionId, selectedImageUrl, scheduleId, responseTimeMs } = req.body;

    // Validate request body
    if (!questionId || typeof questionId !== 'string') {
      throw new ValidationError('问题ID是必需的');
    }

    if (!selectedImageUrl || typeof selectedImageUrl !== 'string') {
      throw new ValidationError('选择的图像URL是必需的');
    }

    if (!scheduleId || typeof scheduleId !== 'string') {
      throw new ValidationError('复习计划ID是必需的');
    }

    if (
      responseTimeMs !== undefined &&
      (typeof responseTimeMs !== 'number' || responseTimeMs <= 0)
    ) {
      throw new ValidationError('响应时间必须是正数');
    }

    // Validate answer (Requirements 8.1, 8.2, 8.3)
    const validationResult = quizModule.validateAnswer(questionId, selectedImageUrl);

    // Record result in review system (Requirement 8.4)
    const reviewResult = await reviewSystemModule.completeReview(
      scheduleId,
      userId,
      validationResult.correct,
      responseTimeMs
    );

    logger.info('Quiz answer processed', {
      userId,
      questionId,
      correct: validationResult.correct,
      scheduleId,
    });

    // Return response with feedback
    res.json({
      success: true,
      correct: validationResult.correct,
      correctImageUrl: validationResult.correctImageUrl,
      nextReviewDate: reviewResult.nextReviewDate,
      explanation: validationResult.correct
        ? '回答正确！继续保持！'
        : '回答错误。正确答案已显示。',
    });
  } catch (error) {
    next(error);
  }
}
