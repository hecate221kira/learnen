import { Request, Response, NextFunction } from 'express';
import { WordLearningModule } from '../modules/word-learning.module';
import { TranslateRequest, TranslateResponse } from '../types';
import { logger } from '../utils/logger';

const wordLearningModule = new WordLearningModule();

/**
 * Translate word endpoint
 * Requirements: 2.1, 2.2, 2.4, 3.1, 3.4
 * @route POST /api/words/translate
 * @access Protected
 */
export async function translateWord(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { word } = req.body as TranslateRequest;

    if (!word) {
      res.status(400).json({
        success: false,
        error: '单词不能为空',
      } as TranslateResponse);
      return;
    }

    // Translate word and get image
    const result = await wordLearningModule.translateWord(word);

    const response: TranslateResponse = {
      success: true,
      word: result.word,
      translation: result.translation,
      imageUrl: result.imageUrl,
    };

    logger.info('Word translation request successful', {
      userId: (req as any).user?.id,
      word: result.word,
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error('Word translation request failed', {
      userId: (req as any).user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * Save word endpoint
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * @route POST /api/words/save
 * @access Protected
 */
export async function saveWord(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: '未授权',
      });
      return;
    }

    const { word, translation, imageUrl } = req.body;

    if (!word || !translation || !imageUrl) {
      res.status(400).json({
        success: false,
        error: '单词、翻译和图像URL都是必需的',
      });
      return;
    }

    // Save word
    const result = await wordLearningModule.saveWord(
      userId,
      word,
      translation,
      imageUrl
    );

    logger.info('Word save request successful', {
      userId,
      wordId: result.wordId,
    });

    res.status(201).json({
      success: true,
      wordId: result.wordId,
      reviewSchedule: result.reviewSchedule,
    });
  } catch (error) {
    logger.error('Word save request failed', {
      userId: (req as any).user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}
