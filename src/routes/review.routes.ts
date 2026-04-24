import { Router } from 'express';
import { getDueReviews, completeReview } from '../controllers/review.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All review routes require authentication
router.use(authenticateToken);

/**
 * GET /api/reviews/due
 * Get due reviews for the authenticated user
 * Query params: limit (optional, 1-20, default 20)
 */
router.get('/due', getDueReviews);

/**
 * POST /api/reviews/complete
 * Complete a review and create next schedule
 * Body: { scheduleId: string, correct: boolean, responseTimeMs?: number }
 */
router.post('/complete', completeReview);

export default router;
