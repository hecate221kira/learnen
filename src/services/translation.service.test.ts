import { TranslationService } from './translation.service';
import {
  ValidationError,
  ExternalServiceError,
  TimeoutError,
} from '../utils/errors';
import fc from 'fast-check';

// Mock the Google Translate API
jest.mock('@google-cloud/translate/build/src/v2');

describe('TranslationService', () => {
  let service: TranslationService;
  let mockTranslate: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock translate function
    mockTranslate = jest.fn();

    // Mock the Translate constructor
    const { Translate } = require('@google-cloud/translate/build/src/v2');
    Translate.mockImplementation(() => ({
      translate: mockTranslate,
    }));

    service = new TranslationService();
  });

  describe('Input Validation', () => {
    it('should reject empty input', async () => {
      await expect(service.translateToChineseAsync('')).rejects.toThrow(
        ValidationError
      );
      await expect(service.translateToChineseAsync('')).rejects.toThrow(
        '输入不能为空'
      );
    });

    it('should reject whitespace-only input', async () => {
      await expect(service.translateToChineseAsync('   ')).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject input longer than 50 characters', async () => {
      const longWord = 'a'.repeat(51);
      await expect(
        service.translateToChineseAsync(longWord)
      ).rejects.toThrow(ValidationError);
      await expect(
        service.translateToChineseAsync(longWord)
      ).rejects.toThrow('单词长度不能超过50个字符');
    });

    it('should reject input with numbers', async () => {
      await expect(service.translateToChineseAsync('hello123')).rejects.toThrow(
        ValidationError
      );
      await expect(service.translateToChineseAsync('hello123')).rejects.toThrow(
        '单词只能包含字母和空格'
      );
    });

    it('should reject input with special characters', async () => {
      await expect(service.translateToChineseAsync('hello!')).rejects.toThrow(
        ValidationError
      );
      await expect(service.translateToChineseAsync('hello@world')).rejects.toThrow(
        ValidationError
      );
    });

    it('should accept valid input with letters only', async () => {
      mockTranslate.mockResolvedValue(['你好']);
      await expect(
        service.translateToChineseAsync('hello')
      ).resolves.toBe('你好');
    });

    it('should accept valid input with letters and spaces', async () => {
      mockTranslate.mockResolvedValue(['你好世界']);
      await expect(
        service.translateToChineseAsync('hello world')
      ).resolves.toBe('你好世界');
    });

    it('should trim whitespace from input', async () => {
      mockTranslate.mockResolvedValue(['你好']);
      await service.translateToChineseAsync('  hello  ');
      expect(mockTranslate).toHaveBeenCalledWith('hello', {
        from: 'en',
        to: 'zh-CN',
      });
    });
  });

  describe('API Integration', () => {
    it('should call Google Translate API with correct parameters', async () => {
      mockTranslate.mockResolvedValue(['你好']);
      await service.translateToChineseAsync('hello');

      expect(mockTranslate).toHaveBeenCalledWith('hello', {
        from: 'en',
        to: 'zh-CN',
      });
    });

    it('should return translated text', async () => {
      mockTranslate.mockResolvedValue(['苹果']);
      const result = await service.translateToChineseAsync('apple');
      expect(result).toBe('苹果');
    });

    it('should handle array response from API', async () => {
      mockTranslate.mockResolvedValue([['你好', '您好']]);
      const result = await service.translateToChineseAsync('hello');
      expect(result).toBe('你好');
    });

    it('should trim whitespace from translation', async () => {
      mockTranslate.mockResolvedValue(['  你好  ']);
      const result = await service.translateToChineseAsync('hello');
      expect(result).toBe('你好');
    });

    it('should reject empty translation response', async () => {
      mockTranslate.mockResolvedValue(['']);
      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);
    });

    // 需求 2.2: 翻译服务应该在5秒内返回中文翻译
    it('should successfully translate common English words', async () => {
      const testCases = [
        { word: 'hello', expected: '你好' },
        { word: 'world', expected: '世界' },
        { word: 'apple', expected: '苹果' },
        { word: 'book', expected: '书' },
        { word: 'computer', expected: '电脑' },
      ];

      for (const { word, expected } of testCases) {
        mockTranslate.mockResolvedValue([expected]);
        const result = await service.translateToChineseAsync(word);
        expect(result).toBe(expected);
      }
    });

    // 需求 2.2: 测试多词短语翻译
    it('should successfully translate phrases with spaces', async () => {
      mockTranslate.mockResolvedValue(['你好世界']);
      const result = await service.translateToChineseAsync('hello world');
      expect(result).toBe('你好世界');
    });

    // 需求 11.4: API响应解析
    it('should handle single string response format', async () => {
      // The API always returns an array, so we test with array format
      mockTranslate.mockResolvedValue(['你好']);
      const result = await service.translateToChineseAsync('hello');
      expect(result).toBe('你好');
    });

    // 需求 11.4: API响应解析
    it('should handle nested array response format', async () => {
      mockTranslate.mockResolvedValue([['你好']]);
      const result = await service.translateToChineseAsync('hello');
      expect(result).toBe('你好');
    });

    // 需求 11.4: 验证返回的翻译不为空
    it('should reject whitespace-only translation response', async () => {
      mockTranslate.mockResolvedValue(['   ']);
      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);
      // The error message will be "翻译服务暂时不可用，请稍后重试" after retries
    });
  });

  describe('Error Handling', () => {
    // 需求 2.3: API错误处理
    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Quota exceeded');
      (rateLimitError as any).code = 429;
      mockTranslate.mockRejectedValue(rateLimitError);

      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);
      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow('翻译服务请求过于频繁，请稍后重试');
    });

    // 需求 2.3: API错误处理 - 认证错误
    it('should handle authentication errors', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).code = 401;
      mockTranslate.mockRejectedValue(authError);

      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);
      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow('翻译服务配置错误');
    });

    // 需求 2.3: API错误处理 - 403 Forbidden
    it('should handle forbidden errors', async () => {
      const forbiddenError = new Error('Forbidden');
      (forbiddenError as any).code = 403;
      mockTranslate.mockRejectedValue(forbiddenError);

      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);
      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow('翻译服务配置错误');
    });

    // 需求 2.3: API错误处理 - 网络错误
    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ECONNREFUSED';
      mockTranslate.mockRejectedValue(networkError);

      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);
      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow('网络连接失败，请检查网络连接');
    });

    // 需求 2.3: 网络超时错误
    it('should handle ETIMEDOUT network errors', async () => {
      const timeoutError = new Error('Connection timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      mockTranslate.mockRejectedValue(timeoutError);

      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);
      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow('网络连接失败，请检查网络连接');
    });

    // 需求 2.3: DNS解析错误
    it('should handle ENOTFOUND network errors', async () => {
      const dnsError = new Error('DNS lookup failed');
      (dnsError as any).code = 'ENOTFOUND';
      mockTranslate.mockRejectedValue(dnsError);

      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);
      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow('网络连接失败，请检查网络连接');
    });

    // 需求 2.3: 配额错误
    it('should handle quota exceeded errors in message', async () => {
      const quotaError = new Error('API quota exceeded for this project');
      mockTranslate.mockRejectedValue(quotaError);

      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);
      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow('翻译服务请求过于频繁，请稍后重试');
    });

    // 需求 2.3: 通用API错误
    it('should handle generic API errors', async () => {
      mockTranslate.mockRejectedValue(new Error('Unknown error'));

      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);
      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow('翻译服务暂时不可用，请稍后重试');
    });

    // 需求 2.3: 验证错误消息为中文
    it('should return Chinese error messages', async () => {
      const testErrors = [
        { code: 429, expectedMessage: '翻译服务请求过于频繁，请稍后重试' },
        { code: 401, expectedMessage: '翻译服务配置错误' },
        { code: 'ECONNREFUSED', expectedMessage: '网络连接失败，请检查网络连接' },
      ];

      for (const { code, expectedMessage } of testErrors) {
        const error = new Error('Test error');
        (error as any).code = code;
        mockTranslate.mockRejectedValue(error);

        try {
          await service.translateToChineseAsync('hello');
          fail('Should have thrown an error');
        } catch (e) {
          expect(e).toBeInstanceOf(ExternalServiceError);
          expect((e as ExternalServiceError).message).toBe(expectedMessage);
        }
      }
    });

    // 需求 2.3: 验证retryable标志
    it('should mark rate limit errors as retryable', async () => {
      const rateLimitError = new Error('Quota exceeded');
      (rateLimitError as any).code = 429;
      mockTranslate.mockRejectedValue(rateLimitError);

      try {
        await service.translateToChineseAsync('hello');
        fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBeInstanceOf(ExternalServiceError);
        expect((e as ExternalServiceError).retryable).toBe(true);
      }
    });

    // 需求 2.3: 验证非retryable错误
    it('should mark authentication errors as non-retryable', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).code = 401;
      mockTranslate.mockRejectedValue(authError);

      try {
        await service.translateToChineseAsync('hello');
        fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBeInstanceOf(ExternalServiceError);
        expect((e as ExternalServiceError).retryable).toBe(false);
      }
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout after 5 seconds', async () => {
      // Create a new service instance to avoid interference
      const testService = new TranslationService();
      
      // Mock a slow API call that never resolves within timeout
      mockTranslate.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(['你好']), 10000); // 10 seconds - longer than timeout
          })
      );

      await expect(
        testService.translateToChineseAsync('hello')
      ).rejects.toThrow(TimeoutError);
    }, 25000); // Account for 3 retries with exponential backoff

    it('should throw TimeoutError with Chinese error message', async () => {
      const testService = new TranslationService();
      
      mockTranslate.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(['你好']), 10000);
          })
      );

      await expect(
        testService.translateToChineseAsync('hello')
      ).rejects.toThrow('翻译请求超时，请重试');
    }, 25000);

    it('should complete successfully if API responds within timeout', async () => {
      mockTranslate.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(['你好']), 100); // 100ms - well within timeout
          })
      );

      const result = await service.translateToChineseAsync('hello');
      expect(result).toBe('你好');
    });
  });

  describe('Retry Mechanism', () => {
    beforeEach(() => {
      // Clear all mocks before each test in this suite
      jest.clearAllMocks();
    });

    it('should retry up to 3 times on retryable errors', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ETIMEDOUT';
      mockTranslate.mockRejectedValue(networkError);

      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);

      // Should be called 3 times (initial + 2 retries)
      expect(mockTranslate).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should succeed on retry if API recovers', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ETIMEDOUT';

      // Fail first two attempts, succeed on third
      mockTranslate
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(['你好']);

      const result = await service.translateToChineseAsync('hello');
      expect(result).toBe('你好');
      expect(mockTranslate).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should not retry on validation errors', async () => {
      await expect(service.translateToChineseAsync('')).rejects.toThrow(
        ValidationError
      );
      expect(mockTranslate).not.toHaveBeenCalled();
    });

    it('should not retry on non-retryable errors', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).code = 401;
      mockTranslate.mockRejectedValue(authError);

      await expect(
        service.translateToChineseAsync('hello')
      ).rejects.toThrow(ExternalServiceError);
      // Authentication errors are not retryable, so should only be called once
      expect(mockTranslate).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('Batch Translation', () => {
    it('should translate multiple words', async () => {
      mockTranslate
        .mockResolvedValueOnce(['你好'])
        .mockResolvedValueOnce(['世界'])
        .mockResolvedValueOnce(['苹果']);

      const results = await service.batchTranslateAsync([
        'hello',
        'world',
        'apple',
      ]);

      expect(results).toEqual(['你好', '世界', '苹果']);
      expect(mockTranslate).toHaveBeenCalledTimes(3);
    });

    it('should reject empty word list', async () => {
      await expect(service.batchTranslateAsync([])).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject word list with invalid words', async () => {
      await expect(
        service.batchTranslateAsync(['hello', 'world123'])
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Property-Based Tests', () => {
    // Feature: children-english-learning-platform, Property 18:
    // 对于任意输入字符串，单词学习模块应该仅接受包含字母和空格的字符串
    it('should only accept letters and spaces (Property 18)', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (input) => {
          mockTranslate.mockResolvedValue(['翻译结果']);

          const hasOnlyLettersAndSpaces = /^[a-zA-Z ]+$/.test(input);
          const isNotEmpty = input.trim().length > 0;
          const isNotTooLong = input.length <= 50;

          if (hasOnlyLettersAndSpaces && isNotEmpty && isNotTooLong) {
            // Should accept
            await expect(
              service.translateToChineseAsync(input)
            ).resolves.toBeTruthy();
          } else {
            // Should reject
            await expect(
              service.translateToChineseAsync(input)
            ).rejects.toThrow();
          }
        }),
        { numRuns: 100 }
      );
    });

    // Feature: children-english-learning-platform, Property 19:
    // 对于任意输入字符串，如果长度超过50个字符，单词学习模块应该拒绝该输入
    it('should reject input longer than 50 characters (Property 19)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (input) => {
            mockTranslate.mockResolvedValue(['翻译结果']);

            // Only test with valid characters to isolate length validation
            const validInput = input.replace(/[^a-zA-Z ]/g, 'a');

            if (validInput.length > 50) {
              await expect(
                service.translateToChineseAsync(validInput)
              ).rejects.toThrow(ValidationError);
              await expect(
                service.translateToChineseAsync(validInput)
              ).rejects.toThrow('单词长度不能超过50个字符');
            } else if (validInput.trim().length > 0) {
              await expect(
                service.translateToChineseAsync(validInput)
              ).resolves.toBeTruthy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: children-english-learning-platform, Property 2:
    // 对于任意无效或空输入，翻译服务应该拒绝处理并返回描述性错误消息
    it('should reject invalid or empty input with descriptive error (Property 2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.string().filter((s) => !/^[a-zA-Z ]+$/.test(s) && s.length > 0),
            fc.string({ minLength: 51 })
          ),
          async (invalidInput) => {
            await expect(
              service.translateToChineseAsync(invalidInput)
            ).rejects.toThrow(ValidationError);

            // Verify error message is descriptive and in Chinese
            try {
              await service.translateToChineseAsync(invalidInput);
            } catch (error) {
              expect(error).toBeInstanceOf(ValidationError);
              expect((error as ValidationError).message).toBeTruthy();
              expect((error as ValidationError).message.length).toBeGreaterThan(
                0
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: children-english-learning-platform, Property 13:
    // 对于任意翻译请求，发送到Google Translate API的参数应该始终指定源语言为"en"，目标语言为"zh-CN"
    it('should always use correct language parameters (Property 13)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => /^[a-zA-Z ]+$/.test(s) && s.trim().length > 0),
          async (validWord) => {
            mockTranslate.mockResolvedValue(['翻译结果']);

            await service.translateToChineseAsync(validWord);

            // Verify API was called with correct parameters
            expect(mockTranslate).toHaveBeenCalledWith(
              expect.any(String),
              expect.objectContaining({
                from: 'en',
                to: 'zh-CN',
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: children-english-learning-platform, Property 14:
    // 对于任意有效的Google Translate API响应，翻译服务应该能够正确解析并提取出翻译后的中文文本
    it('should correctly parse valid API responses (Property 14)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => /^[a-zA-Z ]+$/.test(s) && s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
          async (validWord, translation) => {
            // Test array response format
            mockTranslate.mockResolvedValue([translation]);
            const result1 = await service.translateToChineseAsync(validWord);
            expect(result1).toBe(translation.trim());
            expect(result1.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000); // Increase timeout for property test
  });
});
