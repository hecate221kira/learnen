import fc from 'fast-check';
import { TranslationService } from './translation.service';
import { ValidationError } from '../utils/errors';

// Mock Google Translate
jest.mock('@google-cloud/translate/build/src/v2');

describe('TranslationService - Property-Based Tests', () => {
  let service: TranslationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TranslationService();
  });

  describe('Property 2: Invalid Input Rejection (TranslationService)', () => {
    // Feature: children-english-learning-platform, Property 2:
    // 对于任意无效或空输入（包括空字符串、纯空格、特殊字符、超长字符串），
    // 翻译服务和单词学习模块都应该拒绝处理并返回描述性错误消息

    it('should reject empty strings and whitespace-only inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(''),
            fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 })
          ),
          async (invalidInput) => {
            await expect(
              service.translateToChineseAsync(invalidInput)
            ).rejects.toThrow(ValidationError);

            await expect(
              service.translateToChineseAsync(invalidInput)
            ).rejects.toThrow('输入不能为空');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject inputs with special characters and numbers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
            // Filter to only include strings with invalid characters
            return /[^a-zA-Z ]/.test(s);
          }),
          async (invalidInput) => {
            await expect(
              service.translateToChineseAsync(invalidInput)
            ).rejects.toThrow(ValidationError);

            await expect(
              service.translateToChineseAsync(invalidInput)
            ).rejects.toThrow('单词只能包含字母和空格');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject inputs exceeding 50 characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 51, maxLength: 100 }).map((s) => {
            // Ensure it only contains valid characters (letters and spaces)
            return s.replace(/[^a-zA-Z ]/g, 'a');
          }),
          async (invalidInput) => {
            await expect(
              service.translateToChineseAsync(invalidInput)
            ).rejects.toThrow(ValidationError);

            await expect(
              service.translateToChineseAsync(invalidInput)
            ).rejects.toThrow('单词长度不能超过50个字符');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject any combination of invalid inputs with descriptive errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Empty or whitespace
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t\n'),
            // Too long
            fc.string({ minLength: 51, maxLength: 200 }),
            // Contains numbers
            fc.string({ minLength: 1, maxLength: 50 }).map((s) => s + '123'),
            // Contains special characters
            fc.string({ minLength: 1, maxLength: 50 }).map((s) => s + '!@#'),
            // Only numbers
            fc.stringOf(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 1, maxLength: 10 }),
            // Only special characters
            fc.stringOf(fc.constantFrom('!', '@', '#', '$', '%', '^', '&', '*'), { minLength: 1, maxLength: 10 }),
            // Mixed invalid characters
            fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /[^a-zA-Z ]/.test(s))
          ),
          async (invalidInput) => {
            // Should always throw ValidationError
            await expect(
              service.translateToChineseAsync(invalidInput)
            ).rejects.toThrow(ValidationError);

            // Should provide a descriptive error message in Chinese
            try {
              await service.translateToChineseAsync(invalidInput);
              // Should not reach here
              expect(true).toBe(false);
            } catch (error) {
              expect(error).toBeInstanceOf(ValidationError);
              const errorMessage = (error as ValidationError).message;
              expect(errorMessage).toBeTruthy();
              expect(typeof errorMessage).toBe('string');
              expect(errorMessage.length).toBeGreaterThan(0);
              // Error message should be in Chinese and descriptive
              expect(errorMessage).toMatch(/不能为空|只能包含字母和空格|不能超过50个字符/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide consistent error messages for the same type of invalid input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { input: '', expectedError: '输入不能为空' },
            { input: '   ', expectedError: '输入不能为空' },
            { input: 'hello123', expectedError: '单词只能包含字母和空格' },
            { input: 'hello!', expectedError: '单词只能包含字母和空格' },
            { input: 'a'.repeat(51), expectedError: '单词长度不能超过50个字符' }
          ),
          async ({ input, expectedError }) => {
            await expect(
              service.translateToChineseAsync(input)
            ).rejects.toThrow(expectedError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject inputs with mixed valid and invalid characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 1, maxLength: 20 }),
            fc.constantFrom('1', '2', '!', '@', '#', '$', '%')
          ).map(([validPart, invalidChar]) => validPart + invalidChar),
          async (invalidInput) => {
            await expect(
              service.translateToChineseAsync(invalidInput)
            ).rejects.toThrow(ValidationError);

            await expect(
              service.translateToChineseAsync(invalidInput)
            ).rejects.toThrow('单词只能包含字母和空格');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases of invalid inputs', async () => {
      const edgeCases = [
        { input: '', shouldReject: true, expectedError: '输入不能为空' },
        { input: ' ', shouldReject: true, expectedError: '输入不能为空' },
        { input: '  ', shouldReject: true, expectedError: '输入不能为空' },
        { input: '\t', shouldReject: true, expectedError: '输入不能为空' },
        { input: '\n', shouldReject: true, expectedError: '输入不能为空' },
        { input: '\r', shouldReject: true, expectedError: '输入不能为空' },
        { input: 'a'.repeat(51), shouldReject: true, expectedError: '单词长度不能超过50个字符' },
        { input: 'a'.repeat(100), shouldReject: true, expectedError: '单词长度不能超过50个字符' },
        { input: '123', shouldReject: true, expectedError: '单词只能包含字母和空格' },
        { input: '!!!', shouldReject: true, expectedError: '单词只能包含字母和空格' },
        { input: 'hello world!', shouldReject: true, expectedError: '单词只能包含字母和空格' },
        { input: 'hello123world', shouldReject: true, expectedError: '单词只能包含字母和空格' },
        { input: 'hello\nworld', shouldReject: true, expectedError: '单词只能包含字母和空格' },
        { input: 'hello\tworld', shouldReject: true, expectedError: '单词只能包含字母和空格' },
      ];

      for (const { input, shouldReject, expectedError } of edgeCases) {
        if (shouldReject) {
          await expect(
            service.translateToChineseAsync(input)
          ).rejects.toThrow(expectedError);
        }
      }
    });
  });
});
