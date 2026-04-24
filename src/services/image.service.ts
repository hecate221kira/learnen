import { config } from '../config/env';
import { pool } from '../config/database';
import {
  ValidationError,
  ExternalServiceError,
  TimeoutError,
} from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Image Service
 * Integrates with image APIs (Unsplash/Pexels) to retrieve child-appropriate images
 * Implements caching and URL validation
 */
export class ImageService {
  private readonly apiKey: string;
  private readonly provider: string;
  private readonly timeout: number;
  private readonly maxRetries: number = 3;
  private readonly retryDelays: number[] = [1000, 2000, 4000]; // Exponential backoff
  private readonly cacheValidityDays: number = 30;

  constructor() {
    this.apiKey = config.imageService.apiKey;
    this.provider = config.imageService.provider;
    this.timeout = config.timeouts.image;
  }

  /**
   * Get image for a word with caching
   * Requirements: 3.1, 3.2, 12.1, 12.2
   * @param word - English word to get image for
   * @returns Image URL
   */
  async getImageForWordAsync(word: string): Promise<string> {
    // Validate input
    if (!word || word.trim().length === 0) {
      throw new ValidationError('单词不能为空');
    }

    if (word.length > 50) {
      throw new ValidationError('单词长度不能超过50个字符');
    }

    const searchTerm = word.trim().toLowerCase();

    try {
      // Check cache first
      const cachedImage = await this.getCachedImage(searchTerm);
      if (cachedImage) {
        logger.info('Image cache hit', { searchTerm, imageUrl: cachedImage });
        return cachedImage;
      }

      // Cache miss - fetch from API
      logger.info('Image cache miss, fetching from API', { searchTerm });
      const imageUrl = await this.fetchImageFromAPI(searchTerm);

      // Cache the result
      await this.cacheImage(searchTerm, imageUrl);

      return imageUrl;
    } catch (error) {
      logger.error('Failed to get image for word', {
        word: searchTerm,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get distractor images for quiz
   * Requirements: 7.4, 7.5
   * @param excludeWords - Words to exclude from selection
   * @param count - Number of distractor images needed
   * @returns Array of image URLs
   */
  async getDistractorImagesAsync(
    excludeWords: string[],
    count: number
  ): Promise<string[]> {
    if (count <= 0) {
      throw new ValidationError('干扰图像数量必须大于0');
    }

    try {
      // Get random images from cache, excluding specified words
      const query = `
        SELECT DISTINCT image_url
        FROM image_cache
        WHERE is_valid = TRUE
          AND search_term NOT IN (${excludeWords.map((_, i) => `$${i + 1}`).join(', ')})
        ORDER BY RANDOM()
        LIMIT $${excludeWords.length + 1}
      `;

      const result = await pool.query(query, [...excludeWords, count]);
      const images = result.rows.map((row) => row.image_url);

      // If we don't have enough images, fetch default images
      if (images.length < count) {
        const needed = count - images.length;
        logger.info('Not enough cached images for distractors, fetching defaults', {
          needed,
          available: images.length,
        });

        const defaultImages = await this.getDefaultImagesAsync(needed);
        images.push(...defaultImages);
      }

      return images.slice(0, count);
    } catch (error) {
      logger.error('Failed to get distractor images', {
        excludeWords,
        count,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ExternalServiceError('获取干扰图像失败');
    }
  }

  /**
   * Get cached image if available and valid
   * @param searchTerm - Search term
   * @returns Cached image URL or null
   */
  private async getCachedImage(searchTerm: string): Promise<string | null> {
    try {
      const query = `
        SELECT image_url, validated_at, is_valid
        FROM image_cache
        WHERE search_term = $1
          AND is_valid = TRUE
        ORDER BY validated_at DESC
        LIMIT 1
      `;

      const result = await pool.query(query, [searchTerm]);

      if (result.rows.length === 0) {
        return null;
      }

      const cached = result.rows[0] as {
        image_url: string;
        validated_at: Date;
        is_valid: boolean;
      };

      // Check if cache needs validation (older than 30 days)
      const daysSinceValidation = this.getDaysSince(cached.validated_at);
      if (daysSinceValidation >= this.cacheValidityDays) {
        logger.info('Cache entry needs validation', {
          searchTerm,
          daysSinceValidation,
        });

        // Validate URL in background
        this.validateAndUpdateCache(searchTerm, cached.image_url).catch(
          (error) => {
            logger.error('Background cache validation failed', {
              searchTerm,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        );
      }

      return cached.image_url;
    } catch (error) {
      logger.error('Error checking cache', {
        searchTerm,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cache image URL
   * @param searchTerm - Search term
   * @param imageUrl - Image URL to cache
   */
  private async cacheImage(
    searchTerm: string,
    imageUrl: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO image_cache (search_term, image_url, source, cached_at, validated_at, is_valid)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, TRUE)
        ON CONFLICT (search_term, image_url) 
        DO UPDATE SET 
          validated_at = CURRENT_TIMESTAMP,
          is_valid = TRUE
      `;

      await pool.query(query, [searchTerm, imageUrl, this.provider]);

      logger.info('Image cached successfully', { searchTerm, imageUrl });
    } catch (error) {
      logger.error('Failed to cache image', {
        searchTerm,
        imageUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  /**
   * Validate image URL and update cache
   * Requirements: 12.5
   * @param searchTerm - Search term
   * @param imageUrl - Image URL to validate
   */
  async validateAndUpdateCache(
    searchTerm: string,
    imageUrl: string
  ): Promise<void> {
    try {
      const isValid = await this.validateImageUrlAsync(imageUrl);

      if (isValid) {
        // Update validated_at timestamp
        const query = `
          UPDATE image_cache
          SET validated_at = CURRENT_TIMESTAMP, is_valid = TRUE
          WHERE search_term = $1 AND image_url = $2
        `;
        await pool.query(query, [searchTerm, imageUrl]);

        logger.info('Cache entry validated successfully', {
          searchTerm,
          imageUrl,
        });
      } else {
        // Mark as invalid and fetch new image
        const updateQuery = `
          UPDATE image_cache
          SET is_valid = FALSE
          WHERE search_term = $1 AND image_url = $2
        `;
        await pool.query(updateQuery, [searchTerm, imageUrl]);

        logger.warn('Cache entry marked invalid, fetching new image', {
          searchTerm,
          imageUrl,
        });

        // Fetch and cache new image
        const newImageUrl = await this.fetchImageFromAPI(searchTerm);
        await this.cacheImage(searchTerm, newImageUrl);
      }
    } catch (error) {
      logger.error('Failed to validate and update cache', {
        searchTerm,
        imageUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate if image URL is accessible
   * @param url - Image URL to validate
   * @returns True if valid, false otherwise
   */
  async validateImageUrlAsync(url: string): Promise<boolean> {
    try {
      // Use fetch with HEAD request to check if URL is accessible
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      logger.warn('Image URL validation failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Fetch image from external API (Unsplash or Pexels)
   * @param searchTerm - Search term
   * @returns Image URL
   */
  private async fetchImageFromAPI(searchTerm: string): Promise<string> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const imageUrl = await this.performImageFetch(searchTerm);
        return imageUrl;
      } catch (error) {
        const isLastAttempt = attempt === this.maxRetries - 1;

        logger.warn('Image fetch attempt failed', {
          searchTerm,
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          error: error instanceof Error ? error.message : String(error),
        });

        if (isLastAttempt) {
          throw error;
        }

        await this.sleep(this.retryDelays[attempt]);
      }
    }

    throw new ExternalServiceError('图像服务暂时不可用，请稍后重试');
  }

  /**
   * Perform actual image fetch with timeout
   * @param searchTerm - Search term
   * @returns Image URL
   */
  private async performImageFetch(searchTerm: string): Promise<string> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError('图像检索超时，请重试'));
      }, this.timeout);
    });

    const fetchPromise =
      this.provider === 'unsplash'
        ? this.fetchFromUnsplash(searchTerm)
        : this.fetchFromPexels(searchTerm);

    try {
      const imageUrl = await Promise.race([fetchPromise, timeoutPromise]);
      return imageUrl;
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      throw this.handleImageFetchError(error);
    }
  }

  /**
   * Fetch image from Unsplash API
   * @param searchTerm - Search term
   * @returns Image URL
   */
  private async fetchFromUnsplash(searchTerm: string): Promise<string> {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&per_page=1&content_filter=high&client_id=${this.apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new ExternalServiceError('图像服务认证失败', false);
        }
        if (response.status === 429) {
          throw new ExternalServiceError(
            '图像服务请求过于频繁，请稍后重试',
            true
          );
        }
        throw new ExternalServiceError('图像服务请求失败', true);
      }

      const data: any = await response.json();

      if (!data.results || data.results.length === 0) {
        // No results found, return a default placeholder
        logger.warn('No images found for search term', { searchTerm });
        throw new ExternalServiceError('未找到相关图像', false);
      }

      // Get regular size image URL (child-appropriate content filter is already applied)
      const imageUrl = data.results[0].urls.regular;

      // Validate image URL (Requirements: 15.5)
      const { validateImageResponse } = await import('../utils/validation');
      validateImageResponse(imageUrl);

      return imageUrl;
    } catch (error: any) {
      if (error instanceof ExternalServiceError || error instanceof ValidationError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new TimeoutError('图像检索超时，请重试');
      }

      throw new ExternalServiceError('图像服务暂时不可用，请稍后重试', true);
    }
  }

  /**
   * Fetch image from Pexels API
   * @param searchTerm - Search term
   * @returns Image URL
   */
  private async fetchFromPexels(searchTerm: string): Promise<string> {
    try {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1`;

      const response = await fetch(url, {
        headers: {
          Authorization: this.apiKey,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new ExternalServiceError('图像服务认证失败', false);
        }
        if (response.status === 429) {
          throw new ExternalServiceError(
            '图像服务请求过于频繁，请稍后重试',
            true
          );
        }
        throw new ExternalServiceError('图像服务请求失败', true);
      }

      const data: any = await response.json();

      if (!data.photos || data.photos.length === 0) {
        logger.warn('No images found for search term', { searchTerm });
        throw new ExternalServiceError('未找到相关图像', false);
      }

      // Get medium size image URL
      const imageUrl = data.photos[0].src.medium;

      // Validate image URL (Requirements: 15.5)
      const { validateImageResponse } = await import('../utils/validation');
      validateImageResponse(imageUrl);

      return imageUrl;
    } catch (error: any) {
      if (error instanceof ExternalServiceError || error instanceof ValidationError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new TimeoutError('图像检索超时，请重试');
      }

      throw new ExternalServiceError('图像服务暂时不可用，请稍后重试', true);
    }
  }

  /**
   * Get default images for fallback
   * @param count - Number of images needed
   * @returns Array of image URLs
   */
  private async getDefaultImagesAsync(count: number): Promise<string[]> {
    try {
      // Get random valid images from cache as defaults
      const query = `
        SELECT DISTINCT image_url
        FROM image_cache
        WHERE is_valid = TRUE
        ORDER BY RANDOM()
        LIMIT $1
      `;

      const result = await pool.query(query, [count]);
      return result.rows.map((row) => row.image_url);
    } catch (error) {
      logger.error('Failed to get default images', {
        count,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Handle image fetch errors
   * @param error - Original error
   * @returns Appropriate error instance
   */
  private handleImageFetchError(error: unknown): Error {
    if (
      error instanceof ValidationError ||
      error instanceof TimeoutError ||
      error instanceof ExternalServiceError
    ) {
      return error;
    }

    logger.error('Unexpected image fetch error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new ExternalServiceError('图像服务暂时不可用，请稍后重试');
  }

  /**
   * Calculate days since a date
   * @param date - Date to calculate from
   * @returns Number of days
   */
  private getDaysSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Preload images for multiple words to improve response time
   * Requirements: 13.4 - Task 14.1
   * @param words - Array of words to preload images for
   * @returns Promise that resolves when preloading is complete
   */
  async preloadImagesAsync(words: string[]): Promise<void> {
    if (!words || words.length === 0) {
      return;
    }

    logger.info('Preloading images for words', { count: words.length });

    // Process words in parallel with a concurrency limit
    const concurrencyLimit = 5;
    const chunks: string[][] = [];
    
    for (let i = 0; i < words.length; i += concurrencyLimit) {
      chunks.push(words.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(async (word) => {
          try {
            await this.getImageForWordAsync(word);
          } catch (error) {
            // Log but don't throw - preloading failures shouldn't break the flow
            logger.warn('Failed to preload image', {
              word,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })
      );
    }

    logger.info('Image preloading completed', { count: words.length });
  }

  /**
   * Batch fetch images for multiple words
   * Requirements: 13.4 - Task 14.1
   * @param words - Array of words to fetch images for
   * @returns Map of word to image URL
   */
  async batchGetImagesAsync(words: string[]): Promise<Map<string, string>> {
    if (!words || words.length === 0) {
      return new Map();
    }

    const results = new Map<string, string>();

    // Fetch images in parallel
    const promises = words.map(async (word) => {
      try {
        const imageUrl = await this.getImageForWordAsync(word);
        return { word, imageUrl };
      } catch (error) {
        logger.error('Failed to fetch image in batch', {
          word,
          error: error instanceof Error ? error.message : String(error),
        });
        return { word, imageUrl: null };
      }
    });

    const settled = await Promise.allSettled(promises);

    settled.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.imageUrl) {
        results.set(result.value.word, result.value.imageUrl);
      }
    });

    return results;
  }
}
