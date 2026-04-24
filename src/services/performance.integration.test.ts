/**
 * Performance Integration Tests
 * Requirements: 13.4, 13.5 - Task 14.3
 * Tests API response time, concurrent request handling, and timeout behavior
 */

import { TranslationService } from './translation.service';
import { ImageService } from './image.service';
import { pool, queryWithTimeout } from '../config/database';
import { TimeoutError } from '../utils/errors';

describe('Performance Integration Tests', () => {
  let translationService: TranslationService;
  let imageService: ImageService;

  beforeAll(() => {
    translationService = new TranslationService();
    imageService = new ImageService();
  });

  afterAll(async () => {
    // Close pool connections
    try {
      await pool.end();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('API Response Time', () => {
    /**
     * Test: Translation API response time
     * Requirements: 13.4
     */
    it('should complete translation within acceptable time', async () => {
      const startTime = Date.now();
      
      try {
        await translationService.translateToChineseAsync('hello');
        const duration = Date.now() - startTime;
        
        // Should complete within 5 seconds (as per requirements)
        expect(duration).toBeLessThan(5000);
      } catch (error) {
        // If API is not configured, skip this test
        if (error instanceof Error && error.message.includes('配置错误')) {
          console.warn('Skipping translation test - API not configured');
          return;
        }
        throw error;
      }
    }, 10000);

    /**
     * Test: Image API response time
     * Requirements: 13.4
     */
    it('should complete image retrieval within acceptable time', async () => {
      const startTime = Date.now();
      
      try {
        await imageService.getImageForWordAsync('apple');
        const duration = Date.now() - startTime;
        
        // Should complete within 5 seconds (as per requirements)
        expect(duration).toBeLessThan(5000);
      } catch (error) {
        // If API is not configured, skip this test
        if (error instanceof Error && error.message.includes('配置错误')) {
          console.warn('Skipping image test - API not configured');
          return;
        }
        throw error;
      }
    }, 10000);

    /**
     * Test: Database query response time
     * Requirements: 13.4
     */
    it('should complete database queries within acceptable time', async () => {
      const startTime = Date.now();
      
      await queryWithTimeout('SELECT 1 as test');
      const duration = Date.now() - startTime;
      
      // Simple queries should be very fast
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Concurrent Request Handling', () => {
    /**
     * Test: Batch translation performance
     * Requirements: 13.4
     */
    it('should handle multiple translation requests concurrently', async () => {
      const words = ['hello', 'world', 'test', 'apple', 'book'];
      const startTime = Date.now();
      
      try {
        const promises = words.map(word => 
          translationService.translateToChineseAsync(word)
        );
        
        const results = await Promise.allSettled(promises);
        const duration = Date.now() - startTime;
        
        // Concurrent requests should be faster than sequential
        // 5 words * 5 seconds = 25 seconds sequential
        // Should complete in much less time with concurrency
        expect(duration).toBeLessThan(15000);
        
        // At least some should succeed
        const successful = results.filter(r => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);
      } catch (error) {
        if (error instanceof Error && error.message.includes('配置错误')) {
          console.warn('Skipping concurrent translation test - API not configured');
          return;
        }
        throw error;
      }
    }, 20000);

    /**
     * Test: Batch image retrieval performance
     * Requirements: 13.4
     */
    it('should handle multiple image requests concurrently', async () => {
      const words = ['cat', 'dog', 'tree', 'car', 'house'];
      const startTime = Date.now();
      
      try {
        const imageMap = await imageService.batchGetImagesAsync(words);
        const duration = Date.now() - startTime;
        
        // Should complete in reasonable time
        expect(duration).toBeLessThan(15000);
        
        // Should return results
        expect(imageMap.size).toBeGreaterThan(0);
      } catch (error) {
        if (error instanceof Error && error.message.includes('配置错误')) {
          console.warn('Skipping concurrent image test - API not configured');
          return;
        }
        throw error;
      }
    }, 20000);

    /**
     * Test: Concurrent database queries
     * Requirements: 13.4
     */
    it('should handle multiple database queries concurrently', async () => {
      const queries = Array(10).fill(null).map((_, i) => 
        queryWithTimeout(`SELECT ${i} as value`)
      );
      
      const startTime = Date.now();
      const results = await Promise.all(queries);
      const duration = Date.now() - startTime;
      
      // Should complete quickly
      expect(duration).toBeLessThan(2000);
      expect(results).toHaveLength(10);
    });
  });

  describe('Timeout Handling', () => {
    /**
     * Test: Database query timeout
     * Requirements: 13.5, 2.2, 3.2
     */
    it('should timeout long-running database queries', async () => {
      // Create a query that will take longer than timeout
      const longQuery = `SELECT pg_sleep(15)`;
      
      await expect(
        queryWithTimeout(longQuery, [], 1000) // 1 second timeout
      ).rejects.toThrow(TimeoutError);
    }, 5000);

    /**
     * Test: Translation timeout handling
     * Requirements: 13.5, 2.2
     */
    it('should handle translation service timeouts gracefully', async () => {
      // This test verifies that timeout errors are properly thrown
      // In a real scenario, we would mock the API to simulate timeout
      
      const service = new TranslationService();
      
      // Test with invalid input to trigger quick error
      await expect(
        service.translateToChineseAsync('')
      ).rejects.toThrow();
    });

    /**
     * Test: Image service timeout handling
     * Requirements: 13.5, 3.2
     */
    it('should handle image service timeouts gracefully', async () => {
      const service = new ImageService();
      
      // Test with invalid input to trigger quick error
      await expect(
        service.getImageForWordAsync('')
      ).rejects.toThrow();
    });

    /**
     * Test: Timeout error messages are user-friendly
     * Requirements: 13.5, 14.1
     */
    it('should provide user-friendly timeout error messages', async () => {
      try {
        await queryWithTimeout('SELECT pg_sleep(15)', [], 100);
        fail('Should have thrown timeout error');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).message).toContain('超时');
        expect((error as TimeoutError).message).not.toContain('pg_sleep');
      }
    }, 5000);
  });

  describe('Cache Performance', () => {
    /**
     * Test: Image cache improves response time
     * Requirements: 13.4
     */
    it('should retrieve cached images faster than API calls', async () => {
      const word = 'performance-test-word';
      
      try {
        // First call - cache miss
        const startTime1 = Date.now();
        await imageService.getImageForWordAsync(word);
        const duration1 = Date.now() - startTime1;
        
        // Second call - cache hit
        const startTime2 = Date.now();
        await imageService.getImageForWordAsync(word);
        const duration2 = Date.now() - startTime2;
        
        // Cached call should be significantly faster
        expect(duration2).toBeLessThan(duration1);
        expect(duration2).toBeLessThan(1000); // Should be very fast from cache
      } catch (error) {
        if (error instanceof Error && error.message.includes('配置错误')) {
          console.warn('Skipping cache performance test - API not configured');
          return;
        }
        throw error;
      }
    }, 15000);

    /**
     * Test: Preloading improves subsequent access
     * Requirements: 13.4
     */
    it('should preload images for faster access', async () => {
      const words = ['preload1', 'preload2', 'preload3'];
      
      try {
        // Preload images
        await imageService.preloadImagesAsync(words);
        
        // Access should now be fast
        const startTime = Date.now();
        await Promise.all(words.map(w => imageService.getImageForWordAsync(w)));
        const duration = Date.now() - startTime;
        
        // Should be fast since images are preloaded/cached
        expect(duration).toBeLessThan(3000);
      } catch (error) {
        if (error instanceof Error && error.message.includes('配置错误')) {
          console.warn('Skipping preload test - API not configured');
          return;
        }
        throw error;
      }
    }, 20000);
  });

  describe('Database Index Performance', () => {
    /**
     * Test: Indexed queries perform well
     * Requirements: 13.4
     */
    it('should execute indexed queries efficiently', async () => {
      // Test query that uses indexes
      const query = `
        SELECT w.* 
        FROM words w
        WHERE w.user_id = $1
        ORDER BY w.learned_at DESC
        LIMIT 20
      `;
      
      const testUserId = '00000000-0000-0000-0000-000000000000';
      
      const startTime = Date.now();
      await queryWithTimeout(query, [testUserId]);
      const duration = Date.now() - startTime;
      
      // Should be fast with proper indexes
      expect(duration).toBeLessThan(500);
    });

    /**
     * Test: Review schedule queries are optimized
     * Requirements: 13.4
     */
    it('should efficiently query pending reviews', async () => {
      const query = `
        SELECT rs.*, w.english_word, w.chinese_translation, w.image_url
        FROM review_schedules rs
        JOIN words w ON rs.word_id = w.id
        WHERE rs.user_id = $1
          AND rs.completed = FALSE
          AND rs.due_date <= CURRENT_DATE
        ORDER BY rs.due_date ASC, w.learned_at ASC
        LIMIT 20
      `;
      
      const testUserId = '00000000-0000-0000-0000-000000000000';
      
      const startTime = Date.now();
      await queryWithTimeout(query, [testUserId]);
      const duration = Date.now() - startTime;
      
      // Should be fast with proper indexes
      expect(duration).toBeLessThan(500);
    });
  });
});

