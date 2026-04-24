import { TranslationService } from '../services/translation.service';
import { ImageService } from '../services/image.service';
import { WordService } from '../services/word.service';
import { validateWordInput } from '../utils/validation';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Word Learning Module
 * Coordinates translation, image retrieval, and data storage for word learning flow
 * Requirements: 2.1, 2.2, 2.4, 3.1, 3.4, 4.1, 4.2, 4.3, 4.4, 15.1, 15.2
 */
export class WordLearningModule {
  private translationService: TranslationService;
  private imageService: ImageService;
  private wordService: WordService;

  constructor() {
    this.translationService = new TranslationService();
    this.imageService = new ImageService();
    this.wordService = new WordService();
  }

  /**
   * Validate word input
   * Requirements: 15.1, 15.2
   * @param word - Word to validate
   * @returns Validation result
   */
  validateWordInput(word: string): { valid: boolean; error?: string } {
    try {
      validateWordInput(word);
      return { valid: true };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { valid: false, error: error.message };
      }
      return { valid: false, error: '输入验证失败' };
    }
  }

  /**
   * Translate word and get image
   * Requirements: 2.1, 2.2, 2.4, 3.1, 3.4
   * @param word - English word to translate
   * @returns Translation and image URL
   */
  async translateWord(
    word: string
  ): Promise<{ word: string; translation: string; imageUrl: string }> {
    // Validate input
    const validation = this.validateWordInput(word);
    if (!validation.valid) {
      throw new ValidationError(validation.error || '输入验证失败');
    }

    const trimmedWord = word.trim();

    try {
      // Get translation and image in parallel
      const [translation, imageUrl] = await Promise.all([
        this.translationService.translateToChineseAsync(trimmedWord),
        this.imageService.getImageForWordAsync(trimmedWord),
      ]);

      logger.info('Word translation and image retrieval successful', {
        word: trimmedWord,
        translation,
        imageUrl,
      });

      return {
        word: trimmedWord,
        translation,
        imageUrl,
      };
    } catch (error) {
      logger.error('Failed to translate word or get image', {
        word: trimmedWord,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Save word with translation and image
   * Requirements: 4.1, 4.2, 4.3, 4.4
   * @param userId - User ID
   * @param word - English word
   * @param translation - Chinese translation
   * @param imageUrl - Image URL
   * @returns Saved word ID and review schedule
   */
  async saveWord(
    userId: string,
    word: string,
    translation: string,
    imageUrl: string
  ): Promise<{ wordId: string; reviewSchedule: Date[] }> {
    // Validate inputs
    const validation = this.validateWordInput(word);
    if (!validation.valid) {
      throw new ValidationError(validation.error || '输入验证失败');
    }

    if (!translation || translation.trim().length === 0) {
      throw new ValidationError('翻译不能为空');
    }

    if (!imageUrl || imageUrl.trim().length === 0) {
      throw new ValidationError('图像URL不能为空');
    }

    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('用户ID不能为空');
    }

    try {
      // Save word to database
      const savedWord = await this.wordService.saveWord(
        userId,
        word.trim(),
        translation.trim(),
        imageUrl.trim()
      );

      logger.info('Word saved successfully', {
        userId,
        wordId: savedWord.word.id,
        word: savedWord.word.englishWord,
      });

      // Note: Review schedule creation will be handled by ReviewScheduleService
      // For now, return empty array as placeholder
      // This will be implemented in task 9
      const reviewSchedule: Date[] = [];

      return {
        wordId: savedWord.word.id,
        reviewSchedule,
      };
    } catch (error) {
      logger.error('Failed to save word', {
        userId,
        word,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
