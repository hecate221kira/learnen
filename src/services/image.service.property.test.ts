import fc from 'fast-check';
import { ImageService } from './image.service';
import { pool } from '../config/database';

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

// Mock the logger to suppress console output
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock global fetch
global.fetch = jest.fn() as jest.Mock;

const mockQuery = pool.query as jest.MockedFunction<any>;

describe('ImageService - Property-Based Tests', () => {
  let imageService: ImageService;

  beforeEach(() => {
    imageService = new ImageService();
    jest.clearAllMocks();
  });

  // Feature: children-english-learning-platform, Property 15: 图像 URL 有效性
  // 对于任意成功的图像检索请求，返回的图像URL应该符合有效的URL格式（包含协议、域名、路径），
  // 且应该通过儿童适宜性过滤。
  // **Validates: Requirements 12.2, 12.3**
  describe('Property 15: Image URL Validity', () => {
    it('should return valid URL format with protocol, domain, and path for any successful image retrieval', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary valid English words (letters and spaces, 1-50 chars)
          fc
            .string({
              minLength: 1,
              maxLength: 50,
            })
            .filter((s) => /^[a-zA-Z ]+$/.test(s) && s.trim().length > 0),
          async (word) => {
            // Reset mocks for this iteration
            mockQuery.mockClear();
            (global.fetch as jest.Mock).mockClear();

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

            // Generate a valid image URL for this iteration
            const validImageUrl = `https://images.unsplash.com/photo-${Math.random().toString(36).substring(7)}`;

            // Mock Unsplash API response with child-appropriate content filter
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                results: [
                  {
                    urls: {
                      regular: validImageUrl,
                    },
                  },
                ],
              }),
            });

            // Call the image service
            const result = await imageService.getImageForWordAsync(word);

            // Verify the result is a valid URL
            // 1. Should not be null or undefined
            expect(result).toBeDefined();
            expect(result).not.toBeNull();

            // 2. Should be a non-empty string
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);

            // 3. Should have a valid URL format with protocol
            expect(result).toMatch(/^https?:\/\//);

            // 4. Should contain a domain name
            // URL format: protocol://domain/path
            const urlPattern = /^(https?):\/\/([^\/]+)(\/.*)?$/;
            expect(result).toMatch(urlPattern);

            const match = result.match(urlPattern);
            expect(match).not.toBeNull();

            if (match) {
              const protocol = match[1];
              const domain = match[2];
              const path = match[3];

              // Verify protocol is http or https
              expect(['http', 'https']).toContain(protocol);

              // Verify domain is not empty and contains valid characters
              expect(domain).toBeTruthy();
              expect(domain.length).toBeGreaterThan(0);
              expect(domain).toMatch(/^[a-zA-Z0-9.-]+$/);

              // Verify path exists (can be empty or contain valid path characters)
              // Path is optional but if present should start with /
              if (path) {
                expect(path).toMatch(/^\//);
              }
            }

            // 5. Verify child-appropriateness filter was applied
            // Check that the API call included content_filter=high parameter
            expect(global.fetch).toHaveBeenCalledWith(
              expect.stringContaining('content_filter=high')
            );

            // 6. Should be a well-formed URL (can be parsed by URL constructor)
            expect(() => new URL(result)).not.toThrow();

            // 7. Verify the URL object has all required components
            const urlObj = new URL(result);
            expect(urlObj.protocol).toMatch(/^https?:$/);
            expect(urlObj.hostname).toBeTruthy();
            expect(urlObj.hostname.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 } // Run 100 iterations as required
      );
    });

    it('should return URLs with valid format across multiple image retrievals', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of valid words
          fc.array(
            fc
              .string({
                minLength: 1,
                maxLength: 50,
              })
              .filter((s) => /^[a-zA-Z ]+$/.test(s) && s.trim().length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          async (words) => {
            // Reset mocks
            mockQuery.mockClear();
            (global.fetch as jest.Mock).mockClear();

            const results: string[] = [];

            for (const word of words) {
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

              // Generate unique valid image URL
              const validImageUrl = `https://images.unsplash.com/photo-${Math.random().toString(36).substring(7)}`;

              // Mock API response
              (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                  results: [
                    {
                      urls: {
                        regular: validImageUrl,
                      },
                    },
                  ],
                }),
              });

              const result = await imageService.getImageForWordAsync(word);
              results.push(result);
            }

            // Verify all results are valid URLs
            results.forEach((url) => {
              // Valid URL format
              expect(url).toMatch(/^https?:\/\/[^\/]+/);

              // Can be parsed as URL
              expect(() => new URL(url)).not.toThrow();

              // Has protocol, domain, and optionally path
              const urlObj = new URL(url);
              expect(urlObj.protocol).toMatch(/^https?:$/);
              expect(urlObj.hostname).toBeTruthy();
            });

            // Verify all API calls included child-appropriate filter
            const allFetchCalls = (global.fetch as jest.Mock).mock.calls;
            allFetchCalls.forEach((call) => {
              const url = call[0];
              if (typeof url === 'string' && url.includes('api.unsplash.com')) {
                expect(url).toContain('content_filter=high');
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return URLs from cache that maintain valid format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({
              minLength: 1,
              maxLength: 50,
            })
            .filter((s) => /^[a-zA-Z ]+$/.test(s) && s.trim().length > 0),
          // Generate valid cached image URLs
          fc.webUrl({ validSchemes: ['https'] }),
          async (word, cachedUrl) => {
            // Reset mocks
            mockQuery.mockClear();
            (global.fetch as jest.Mock).mockClear();

            // Mock cache hit with valid URL
            mockQuery.mockResolvedValueOnce({
              rows: [
                {
                  image_url: cachedUrl,
                  validated_at: new Date(),
                  is_valid: true,
                },
              ],
              rowCount: 1,
            });

            const result = await imageService.getImageForWordAsync(word);

            // Verify cached URL is returned and is valid
            expect(result).toBe(cachedUrl);

            // Verify URL format
            expect(result).toMatch(/^https?:\/\//);
            expect(() => new URL(result)).not.toThrow();

            const urlObj = new URL(result);
            expect(urlObj.protocol).toMatch(/^https?:$/);
            expect(urlObj.hostname).toBeTruthy();
            expect(urlObj.hostname.length).toBeGreaterThan(0);

            // API should not be called when cache hit
            expect(global.fetch).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure all returned URLs have required components: protocol, domain, and path', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({
              minLength: 1,
              maxLength: 50,
            })
            .filter((s) => /^[a-zA-Z ]+$/.test(s) && s.trim().length > 0),
          async (word) => {
            // Reset mocks
            mockQuery.mockClear();
            (global.fetch as jest.Mock).mockClear();

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

            // Generate valid image URL with all components
            const imageId = Math.random().toString(36).substring(7);
            const validImageUrl = `https://images.unsplash.com/photo-${imageId}?w=800&q=80`;

            // Mock API response
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                results: [
                  {
                    urls: {
                      regular: validImageUrl,
                    },
                  },
                ],
              }),
            });

            const result = await imageService.getImageForWordAsync(word);

            // Parse URL and verify all components
            const urlObj = new URL(result);

            // 1. Protocol must be http or https
            expect(['http:', 'https:']).toContain(urlObj.protocol);

            // 2. Hostname (domain) must exist and be non-empty
            expect(urlObj.hostname).toBeTruthy();
            expect(urlObj.hostname.length).toBeGreaterThan(0);
            // Domain should contain at least one dot (e.g., example.com)
            expect(urlObj.hostname).toMatch(/\./);

            // 3. Pathname (path) must exist (at minimum '/')
            expect(urlObj.pathname).toBeDefined();
            expect(urlObj.pathname.length).toBeGreaterThan(0);
            expect(urlObj.pathname).toMatch(/^\//);

            // 4. Full URL should be reconstructable from components
            const reconstructed = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
            expect(reconstructed).toBe(result);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never return malformed URLs or URLs without required components', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({
              minLength: 1,
              maxLength: 50,
            })
            .filter((s) => /^[a-zA-Z ]+$/.test(s) && s.trim().length > 0),
          async (word) => {
            // Reset mocks
            mockQuery.mockClear();
            (global.fetch as jest.Mock).mockClear();

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

            // Generate valid image URL
            const validImageUrl = `https://images.unsplash.com/photo-${Math.random().toString(36).substring(7)}`;

            // Mock API response
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                results: [
                  {
                    urls: {
                      regular: validImageUrl,
                    },
                  },
                ],
              }),
            });

            const result = await imageService.getImageForWordAsync(word);

            // Verify it's NOT any of these invalid formats
            expect(result).not.toBe('');
            expect(result).not.toBe('/');
            expect(result).not.toMatch(/^\/\//); // Protocol-relative URL
            expect(result).not.toMatch(/^[^:]+$/); // No protocol
            expect(result).not.toMatch(/^https?:\/\/$/); // Protocol only
            expect(result).not.toMatch(/^https?:\/\/\/+/); // Protocol with no domain

            // Verify it DOES have the correct format
            expect(result).toMatch(/^https?:\/\/[a-zA-Z0-9.-]+/);

            // Verify URL constructor doesn't throw
            let urlObj: URL;
            expect(() => {
              urlObj = new URL(result);
            }).not.toThrow();

            // Verify all components are present and valid
            urlObj = new URL(result);
            expect(urlObj.protocol).toBeTruthy();
            expect(urlObj.hostname).toBeTruthy();
            expect(urlObj.pathname).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply child-appropriate content filter for all image retrievals', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({
              minLength: 1,
              maxLength: 50,
            })
            .filter((s) => /^[a-zA-Z ]+$/.test(s) && s.trim().length > 0),
          async (word) => {
            // Reset mocks
            mockQuery.mockClear();
            (global.fetch as jest.Mock).mockClear();

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

            // Generate valid image URL
            const validImageUrl = `https://images.unsplash.com/photo-${Math.random().toString(36).substring(7)}`;

            // Mock API response
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                results: [
                  {
                    urls: {
                      regular: validImageUrl,
                    },
                  },
                ],
              }),
            });

            await imageService.getImageForWordAsync(word);

            // Verify the API call included child-appropriate content filter
            expect(global.fetch).toHaveBeenCalledTimes(1);

            const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
            const apiUrl = fetchCall[0];

            // Verify it's calling Unsplash API
            expect(apiUrl).toContain('api.unsplash.com');

            // Verify content_filter=high parameter is present
            expect(apiUrl).toContain('content_filter=high');

            // Verify the search term is properly encoded
            const encodedWord = encodeURIComponent(word.trim().toLowerCase());
            expect(apiUrl).toContain(`query=${encodedWord}`);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
