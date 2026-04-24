import { Router } from 'express';
import { generateQuiz, answerQuiz } from '../controllers/quiz.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All quiz routes require authentication
router.use(authenticateToken);

/**
 * GET /api/quiz/generate
 * Generate quiz questions for due words
 * Query params: limit (optional, 1-20, default 20)
 * 
 * Requirements: 6.5, 7.1
 */
router.get('/generate', generateQuiz);

/**
 * POST /api/quiz/answer
 * Validate quiz answer and record result
 * Body: { questionId: string, selectedImageUrl: string, scheduleId: string, responseTimeMs?: number }
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
router.post('/answer', answerQuiz);

export default router;
