import { ImageService } from './image.service';
import { pool } from '../config/database';
import {
  ValidationError,
  ExternalServiceError,
} from '../utils/errors';

// Mock dependencies
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../config/env', () => ({
  config: {
    imageService: {
      apiKey: 'test-api-key',
      provider: 'unsplash',
    },
    timeouts: {
      image: 5000,
    },
  },
}));

// Mock global fetch
global.fetch = jest.fn() as jest.Mock;

const mockQuery = pool.query as jest.MockedFunction<any>;

describe('ImageService', () => {
  let imageService: ImageService;

  beforeEach(() => {
    imageService = new ImageService();
    jest.clearAllMocks();
  });

  describe('getImageForWordAsync', () => {
    it('should return cached image if available', async () => {
      // Mock cache hit
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            image_url: 'https://example.com/cached-image.jpg',
            validated_at: new Date(),
            is_valid: true,
          },
        ],
        rowCount: 1,
      });

      const result = await imageService.getImageForWordAsync('apple');

      expect(result).toBe('https://example.com/cached-image.jpg');
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if cache miss', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock successful cache insert
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      // Mock Unsplash API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              urls: {
                regular: 'https://images.unsplash.com/photo-123',
              },
            },
          ],
        }),
      });

      const result = await imageService.getImageForWordAsync('banana');

      expect(result).toBe('https://images.unsplash.com/photo-123');
      expect(mockQuery).toHaveBeenCalledTimes(2); // Cache check + cache insert
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationError for empty word', async () => {
      await expect(imageService.getImageForWordAsync('')).rejects.toThrow(
        ValidationError
      );
      await expect(imageService.getImageForWordAsync('   ')).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for word longer than 50 characters', async () => {
      const longWord = 'a'.repeat(51);
      await expect(
        imageService.getImageForWordAsync(longWord)
      ).rejects.toThrow(ValidationError);
    });

    it('should handle API timeout', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock API that never resolves (simulating timeout)
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      await expect(
        imageService.getImageForWordAsync('timeout')
      ).rejects.toThrow();
    }, 10000); // Increase timeout for this test

    it('should handle API rate limiting', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock rate limit response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
      });

      await expect(
        imageService.getImageForWordAsync('ratelimit')
      ).rejects.toThrow(ExternalServiceError);
    });

    it('should handle API authentication errors', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock auth error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(imageService.getImageForWordAsync('auth')).rejects.toThrow(
        ExternalServiceError
      );
    });

    it('should handle no results from API', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock empty results
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await expect(
        imageService.getImageForWordAsync('noresults')
      ).rejects.toThrow(ExternalServiceError);
    });

    it('should validate old cache entries in background', async () => {
      // Mock cache hit with old validation date (31 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            image_url: 'https://example.com/old-image.jpg',
            validated_at: oldDate,
            is_valid: true,
          },
        ],
        rowCount: 1,
      });

      // Mock HEAD request for validation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      // Mock cache update
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      const result = await imageService.getImageForWordAsync('oldcache');

      expect(result).toBe('https://example.com/old-image.jpg');
      // Background validation happens asynchronously, so we just check the result
    });
  });

  describe('getDistractorImagesAsync', () => {
    it('should return distractor images from cache', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { image_url: 'https://example.com/image1.jpg' },
          { image_url: 'https://example.com/image2.jpg' },
          { image_url: 'https://example.com/image3.jpg' },
        ],
        rowCount: 3,
      });

      const result = await imageService.getDistractorImagesAsync(['apple'], 3);

      expect(result).toHaveLength(3);
      expect(result).toContain('https://example.com/image1.jpg');
      expect(result).toContain('https://example.com/image2.jpg');
      expect(result).toContain('https://example.com/image3.jpg');
    });

    it('should fetch default images if not enough cached', async () => {
      // Mock insufficient cached images
      mockQuery.mockResolvedValueOnce({
        rows: [{ image_url: 'https://example.com/image1.jpg' }],
        rowCount: 1,
      });

      // Mock default images query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { image_url: 'https://example.com/default1.jpg' },
          { image_url: 'https://example.com/default2.jpg' },
        ],
        rowCount: 2,
      });

      const result = await imageService.getDistractorImagesAsync(['apple'], 3);

      expect(result).toHaveLength(3);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should throw ValidationError for invalid count', async () => {
      await expect(
        imageService.getDistractorImagesAsync(['apple'], 0)
      ).rejects.toThrow(ValidationError);

      await expect(
        imageService.getDistractorImagesAsync(['apple'], -1)
      ).rejects.toThrow(ValidationError);
    });

    it('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        imageService.getDistractorImagesAsync(['apple'], 3)
      ).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('validateImageUrlAsync', () => {
    it('should return true for valid URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      const result = await imageService.validateImageUrlAsync(
        'https://example.com/image.jpg'
      );

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/image.jpg',
        expect.objectContaining({
          method: 'HEAD',
        })
      );
    });

    it('should return false for invalid URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await imageService.validateImageUrlAsync(
        'https://example.com/notfound.jpg'
      );

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await imageService.validateImageUrlAsync(
        'https://example.com/error.jpg'
      );

      expect(result).toBe(false);
    });
  });

  describe('validateAndUpdateCache', () => {
    it('should update validated_at for valid URL', async () => {
      // Mock successful validation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      // Mock cache update
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      await imageService.validateAndUpdateCache(
        'apple',
        'https://example.com/image.jpg'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE image_cache'),
        ['apple', 'https://example.com/image.jpg']
      );
    });

    it('should mark invalid URL and fetch new image', async () => {
      // Mock failed validation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Mock mark as invalid
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      // Mock new image fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              urls: {
                regular: 'https://images.unsplash.com/new-photo',
              },
            },
          ],
        }),
      });

      // Mock cache insert
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      await imageService.validateAndUpdateCache(
        'apple',
        'https://example.com/invalid.jpg'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_valid = FALSE'),
        ['apple', 'https://example.com/invalid.jpg']
      );
    });
  });

  describe('Unsplash API integration', () => {
    it('should fetch image from Unsplash successfully', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock cache insert
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      // Mock Unsplash API
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              urls: {
                regular: 'https://images.unsplash.com/photo-123',
              },
            },
          ],
        }),
      });

      const result = await imageService.getImageForWordAsync('cat');

      expect(result).toBe('https://images.unsplash.com/photo-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.unsplash.com')
      );
    });

    it('should apply content filter for child-appropriate images', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock cache insert
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      // Mock Unsplash API
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              urls: {
                regular: 'https://images.unsplash.com/photo-456',
              },
            },
          ],
        }),
      });

      await imageService.getImageForWordAsync('dog');

      // Verify content_filter=high is included in the request
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('content_filter=high')
      );
    });
  });

  describe('Retry mechanism', () => {
    it('should retry on transient errors', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      // Mock first two attempts fail, third succeeds
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              {
                urls: {
                  regular: 'https://images.unsplash.com/photo-789',
                },
              },
            ],
          }),
        });

      const result = await imageService.getImageForWordAsync('retry');

      expect(result).toBe('https://images.unsplash.com/photo-789');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      // Mock all attempts fail
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        imageService.getImageForWordAsync('maxretry')
      ).rejects.toThrow(ExternalServiceError);

      expect(global.fetch).toHaveBeenCalledTimes(3); // Max retries
    });
  });

  describe('Performance and timeout requirements', () => {
    // 需求 3.2: Image_Service 应该在请求后 5 秒内返回图像
    it('should return image within 5 seconds (requirement 3.2)', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock cache insert
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      // Mock API response that takes 2 seconds (within limit)
      (global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    results: [
                      {
                        urls: {
                          regular: 'https://images.unsplash.com/photo-fast',
                        },
                      },
                    ],
                  }),
                }),
              2000
            )
          )
      );

      const startTime = Date.now();
      const result = await imageService.getImageForWordAsync('fast');
      const duration = Date.now() - startTime;

      expect(result).toBe('https://images.unsplash.com/photo-fast');
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    // 需求 3.2: 超过 5 秒应该超时
    it('should timeout if API takes longer than 5 seconds', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock API that takes too long (never resolves within timeout)
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      await expect(
        imageService.getImageForWordAsync('slow')
      ).rejects.toThrow();
    }, 10000);
  });

  describe('Default image fallback', () => {
    // 需求 3.3: 如果 Image_Service 未能检索到图像，那么 Word_Learning_Module 应该显示默认占位符图像
    // Note: This test verifies the service throws an error when it can't retrieve an image.
    // The Word_Learning_Module is responsible for catching this error and showing a default placeholder.
    it('should throw error when unable to retrieve image (requirement 3.3)', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock API returning no results after all retries
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await expect(
        imageService.getImageForWordAsync('nonexistent')
      ).rejects.toThrow(ExternalServiceError);
    });

    // Test that getDistractorImagesAsync falls back to default images when needed
    it('should use default images when not enough distractor images available', async () => {
      // Mock insufficient cached images (only 1 available)
      mockQuery.mockResolvedValueOnce({
        rows: [{ image_url: 'https://example.com/image1.jpg' }],
        rowCount: 1,
      });

      // Mock default images query (returns 2 more)
      mockQuery.mockResolvedValueOnce({
        rows: [
          { image_url: 'https://example.com/default1.jpg' },
          { image_url: 'https://example.com/default2.jpg' },
        ],
        rowCount: 2,
      });

      const result = await imageService.getDistractorImagesAsync(['apple'], 3);

      expect(result).toHaveLength(3);
      expect(result).toContain('https://example.com/image1.jpg');
      expect(result).toContain('https://example.com/default1.jpg');
      expect(result).toContain('https://example.com/default2.jpg');
      expect(mockQuery).toHaveBeenCalledTimes(2); // First query + default images query
    });

    it('should return empty array when no default images available', async () => {
      // Mock no cached images
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock no default images
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await imageService.getDistractorImagesAsync(['apple'], 3);

      expect(result).toHaveLength(0);
    });
  });

  describe('Image URL validity', () => {
    // 需求 12.3: Image_Service 应该返回至少一个可访问且有效的图像 URL
    it('should return valid and accessible image URL (requirement 12.3)', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock cache insert
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      // Mock Unsplash API with valid URL
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              urls: {
                regular: 'https://images.unsplash.com/photo-valid',
              },
            },
          ],
        }),
      });

      const result = await imageService.getImageForWordAsync('valid');

      // Verify URL format is valid
      expect(result).toMatch(/^https:\/\//);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should validate returned URL has proper format', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock cache insert
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      // Mock API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              urls: {
                regular: 'https://images.unsplash.com/photo-123?w=400',
              },
            },
          ],
        }),
      });

      const result = await imageService.getImageForWordAsync('test');

      // Verify URL is a valid HTTPS URL
      const urlPattern = /^https:\/\/[^\s]+$/;
      expect(result).toMatch(urlPattern);
    });
  });

  describe('Cache behavior', () => {
    it('should not call API when cache hit occurs', async () => {
      // Mock cache hit
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            image_url: 'https://example.com/cached.jpg',
            validated_at: new Date(),
            is_valid: true,
          },
        ],
        rowCount: 1,
      });

      await imageService.getImageForWordAsync('cached');

      // Verify API was not called
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledTimes(1); // Only cache check
    });

    it('should call API when cache miss occurs', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock cache insert
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      // Mock API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              urls: {
                regular: 'https://images.unsplash.com/new-photo',
              },
            },
          ],
        }),
      });

      await imageService.getImageForWordAsync('uncached');

      // Verify API was called
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledTimes(2); // Cache check + cache insert
    });

    it('should cache newly fetched images', async () => {
      // Mock cache miss
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock cache insert
      const cacheInsertMock = mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      // Mock API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              urls: {
                regular: 'https://images.unsplash.com/to-cache',
              },
            },
          ],
        }),
      });

      await imageService.getImageForWordAsync('newword');

      // Verify cache insert was called
      expect(cacheInsertMock).toHaveBeenCalled();
      const cacheInsertCall = mockQuery.mock.calls[1];
      expect(cacheInsertCall[0]).toContain('INSERT INTO image_cache');
    });
  });
});
