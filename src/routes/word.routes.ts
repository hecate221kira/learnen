import { Router } from 'express';
import * as wordController from '../controllers/word.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   POST /api/words/translate
 * @desc    Translate English word to Chinese and get image
 * @access  Protected
 */
router.post('/translate', authenticateToken, wordController.translateWord);

/**
 * @route   POST /api/words/save
 * @desc    Save word with translation and image
 * @access  Protected
 */
router.post('/save', authenticateToken, wordController.saveWord);

export default router;
