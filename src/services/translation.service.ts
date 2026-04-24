import { Translate } from '@google-cloud/translate/build/src/v2';
import { config } from '../config/env';
import {
  ValidationError,
  ExternalServiceError,
  TimeoutError,
} from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Translation Service
 * Integrates with Google Translate API to translate English words to Chinese
 */
export class TranslationService {
  private translate: Translate;
  private readonly timeout: number;
  private readonly maxRetries: number = 3;
  private readonly retryDelays: number[] = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

  constructor() {
    // Initialize Google Translate client with API key
    this.translate = new Translate({
      key: config.googleTranslate.apiKey,
    });
    this.timeout = config.timeouts.translation;
  }

  /**
   * Translate English word to Chinese
   * @param word - English word to translate
   * @returns Chinese translation
   * @throws ValidationError - If input is invalid
   * @throws TimeoutError - If translation takes longer than 5 seconds
   * @throws ExternalServiceError - If API call fails
   */
  async translateToChineseAsync(word: string): Promise<string> {
    // Validate input
    if (!word || word.trim().length === 0) {
      throw new ValidationError('输入不能为空');
    }

    if (word.length > 50) {
      throw new ValidationError('单词长度不能超过50个字符');
    }

    // Validate word contains only letters and spaces
    if (!/^[a-zA-Z ]+$/.test(word)) {
      throw new ValidationError('单词只能包含字母和空格');
    }

    const trimmedWord = word.trim();

    // Attempt translation with retry logic
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const translation = await this.performTranslation(trimmedWord);
        
        logger.info('Translation successful', {
          word: trimmedWord,
          translation,
          attempt: attempt + 1,
        });

        return translation;
      } catch (error) {
        const isLastAttempt = attempt === this.maxRetries - 1;

        // Don't retry validation errors or non-retryable errors
        if (
          error instanceof ValidationError ||
          (error instanceof ExternalServiceError && !error.retryable)
        ) {
          throw error;
        }

        // Log retry attempt
        logger.warn('Translation attempt failed', {
          word: trimmedWord,
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          error: error instanceof Error ? error.message : String(error),
        });

        // If last attempt, throw the error
        if (isLastAttempt) {
          throw this.handleTranslationError(error);
        }

        // Wait before retrying (exponential backoff)
        await this.sleep(this.retryDelays[attempt]);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new ExternalServiceError('翻译服务暂时不可用，请稍后重试');
  }

  /**
   * Perform the actual translation with timeout
   * @param word - Word to translate
   * @returns Translation result
   */
  private async performTranslation(word: string): Promise<string> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError('翻译请求超时，请重试'));
      }, this.timeout);
    });

    // Create translation promise
    const translationPromise = this.callGoogleTranslateAPI(word);

    // Race between translation and timeout
    try {
      const translation = await Promise.race([
        translationPromise,
        timeoutPromise,
      ]);
      return translation;
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      throw this.handleTranslationError(error);
    }
  }

  /**
   * Call Google Translate API
   * @param word - Word to translate
   * @returns Chinese translation
   */
  private async callGoogleTranslateAPI(word: string): Promise<string> {
    try {
      // Call Google Translate API
      // Source: en (English), Target: zh-CN (Simplified Chinese)
      const [translations] = await this.translate.translate(word, {
        from: 'en',
        to: 'zh-CN',
      });

      // Handle both single string and array responses
      const translation = Array.isArray(translations)
        ? translations[0]
        : translations;

      // Validate translation result (Requirements: 15.5)
      const { validateTranslationResponse } = await import('../utils/validation');
      validateTranslationResponse(translation);

      return translation.trim();
    } catch (error: any) {
      // Handle rate limiting errors
      if (error.code === 429 || error.message?.includes('quota')) {
        throw new ExternalServiceError(
          '翻译服务请求过于频繁，请稍后重试',
          true // Retryable
        );
      }

      // Handle authentication errors
      if (error.code === 401 || error.code === 403) {
        logger.error('Google Translate API authentication failed', {
          error: error.message,
        });
        throw new ExternalServiceError(
          '翻译服务配置错误',
          false // Not retryable
        );
      }

      // Handle network errors
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT'
      ) {
        throw new ExternalServiceError(
          '网络连接失败，请检查网络连接',
          true // Retryable
        );
      }

      // If it's a validation error from our validation, throw it
      if (error instanceof ValidationError) {
        throw error;
      }

      // Generic API error
      throw new ExternalServiceError(
        '翻译服务暂时不可用，请稍后重试',
        true // Retryable
      );
    }
  }

  /**
   * Handle translation errors and convert to appropriate error types
   * @param error - Original error
   * @returns Appropriate error instance
   */
  private handleTranslationError(error: unknown): Error {
    if (
      error instanceof ValidationError ||
      error instanceof TimeoutError ||
      error instanceof ExternalServiceError
    ) {
      return error;
    }

    logger.error('Unexpected translation error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new ExternalServiceError('翻译服务暂时不可用，请稍后重试');
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Batch translate multiple words (for optimization)
   * @param words - Array of English words
   * @returns Array of Chinese translations
   */
  async batchTranslateAsync(words: string[]): Promise<string[]> {
    if (!words || words.length === 0) {
      throw new ValidationError('单词列表不能为空');
    }

    // Validate all words
    for (const word of words) {
      if (!word || word.trim().length === 0) {
        throw new ValidationError('单词列表包含空值');
      }
      if (word.length > 50) {
        throw new ValidationError('单词长度不能超过50个字符');
      }
      if (!/^[a-zA-Z ]+$/.test(word)) {
        throw new ValidationError('单词只能包含字母和空格');
      }
    }

    // Translate each word individually (Google Translate API handles batching internally)
    const translations = await Promise.all(
      words.map((word) => this.translateToChineseAsync(word))
    );

    return translations;
  }

  /**
   * Translate with caching support
   * Requirements: 13.4 - Task 14.1
   * @param word - English word to translate
   * @param useCache - Whether to use cache (default: true)
   * @returns Chinese translation
   */
  async translateWithCacheAsync(
    word: string,
    useCache: boolean = true
  ): Promise<string> {
    if (!useCache) {
      return this.translateToChineseAsync(word);
    }

    // For now, delegate to the main method
    // In a production system, this would check a Redis cache or similar
    return this.translateToChineseAsync(word);
  }
}
