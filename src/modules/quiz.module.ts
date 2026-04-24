import { pool } from '../config/database';
import { ImageService } from '../services/image.service';
import { ValidationError, DatabaseError } from '../utils/errors';
import { QuizQuestion, QuizOption } from '../types';
import { logger } from '../utils/logger';

/**
 * QuizModule
 * 
 * Generates quiz questions with image options and validates answers.
 * Integrates with ImageService for distractor images.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4
 */
export class QuizModule {
  private imageService: ImageService;
  // Store active quiz questions for answer validation
  private activeQuestions: Map<string, { correctImageUrl: string; wordId: string }>;

  constructor() {
    this.imageService = new ImageService();
    this.activeQuestions = new Map();
  }

  /**
   * Generate a quiz question for a word
   * 
   * Requirements: 7.1, 7.2, 7.3, 7.4
   * 
   * @param word - Word object with id, word, translation, imageUrl
   * @param userId - User ID for getting distractor images from their learning history
   * @returns Quiz question with 4 image options
   */
  async generateQuestionAsync(
    word: { id: string; word: string; translation: string; imageUrl: string },
    userId: string
  ): Promise<QuizQuestion> {
    // Validate inputs
    if (!word || !word.id || !word.word || !word.translation || !word.imageUrl) {
      throw new ValidationError('单词数据不完整');
    }

    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('用户ID不能为空');
    }

    try {
      // 1. Get correct image (Requirement 7.2)
      const correctImage = word.imageUrl;

      // 2. Get 3 distractor images from user's learning history (Requirements 7.4, 7.5)
      const distractors = await this.getDistractorImagesAsync(userId, word.id, 3);

      // 3. Combine and randomize options (Requirement 7.3)
      const options: QuizOption[] = [
        { imageUrl: correctImage, isCorrect: true },
        ...distractors.map((url) => ({ imageUrl: url, isCorrect: false })),
      ];

      const shuffledOptions = this.shuffleArray(options);

      // 4. Generate question ID and store for validation
      const questionId = this.generateQuestionId();
      this.activeQuestions.set(questionId, {
        correctImageUrl: correctImage,
        wordId: word.id,
      });

      logger.info('Quiz question generated', {
        questionId,
        wordId: word.id,
        word: word.word,
        optionsCount: shuffledOptions.length,
      });

      return {
        questionId,
        word: word.word,
        translation: word.translation,
        options: shuffledOptions,
      };
    } catch (error) {
      logger.error('Failed to generate quiz question', {
        wordId: word.id,
        word: word.word,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validate user's answer to a quiz question
   * 
   * Requirements: 8.1, 8.2, 8.3
   * 
   * @param questionId - Question ID
   * @param selectedImageUrl - User's selected image URL
   * @returns Validation result with correct answer
   */
  validateAnswer(
    questionId: string,
    selectedImageUrl: string
  ): { correct: boolean; correctImageUrl: string } {
    // Validate inputs
    if (!questionId || questionId.trim().length === 0) {
      throw new ValidationError('问题ID不能为空');
    }

    if (!selectedImageUrl || selectedImageUrl.trim().length === 0) {
      throw new ValidationError('选择的图像URL不能为空');
    }

    // Get stored question data
    const questionData = this.activeQuestions.get(questionId);

    if (!questionData) {
      throw new ValidationError('问题不存在或已过期');
    }

    // Compare selected image with correct answer (Requirement 8.1)
    const correct = selectedImageUrl === questionData.correctImageUrl;

    logger.info('Quiz answer validated', {
      questionId,
      correct,
      selectedImageUrl,
      correctImageUrl: questionData.correctImageUrl,
    });

    // Clean up stored question
    this.activeQuestions.delete(questionId);

    return {
      correct,
      correctImageUrl: questionData.correctImageUrl,
    };
  }

  /**
   * Get distractor images for quiz
   * 
   * Requirements: 7.4, 7.5
   * 
   * @param userId - User ID
   * @param excludeWordId - Word ID to exclude (the correct answer)
   * @param count - Number of distractor images needed
   * @returns Array of image URLs
   */
  private async getDistractorImagesAsync(
    userId: string,
    excludeWordId: string,
    count: number
  ): Promise<string[]> {
    try {
      // Get images from user's other learned words (Requirement 7.4)
      const query = `
        SELECT image_url, english_word
        FROM words
        WHERE user_id = $1
          AND id != $2
        ORDER BY RANDOM()
        LIMIT $3
      `;

      const result = await pool.query(query, [userId, excludeWordId, count]);
      const userImages = result.rows.map((row) => row.image_url);

      // If we have enough images from user's history, return them
      if (userImages.length >= count) {
        return userImages.slice(0, count);
      }

      // If not enough, supplement with default images (Requirement 7.5)
      const needed = count - userImages.length;
      logger.info('Not enough user images for distractors, fetching defaults', {
        userId,
        needed,
        available: userImages.length,
      });

      // Get words to exclude (user's words)
      const excludeWordsQuery = `
        SELECT english_word
        FROM words
        WHERE user_id = $1
      `;
      const excludeResult = await pool.query(excludeWordsQuery, [userId]);
      const excludeWords = excludeResult.rows.map((row) => row.english_word.toLowerCase());

      // Get default images from image service
      const defaultImages = await this.imageService.getDistractorImagesAsync(
        excludeWords,
        needed
      );

      return [...userImages, ...defaultImages];
    } catch (error) {
      logger.error('Failed to get distractor images', {
        userId,
        excludeWordId,
        count,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('获取干扰图像失败');
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   * 
   * @param array - Array to shuffle
   * @returns Shuffled array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Generate unique question ID
   * 
   * @returns Question ID
   */
  private generateQuestionId(): string {
    return `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Clean up expired questions (optional maintenance method)
   * Can be called periodically to prevent memory leaks
   */
  cleanupExpiredQuestions(): void {
    // In a production system, you might want to add timestamps
    // and clean up questions older than a certain threshold
    // For now, this is a placeholder for future enhancement
    logger.info('Quiz questions cleanup', {
      activeQuestionsCount: this.activeQuestions.size,
    });
  }
}
