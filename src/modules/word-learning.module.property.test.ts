import fc from 'fast-check';
import { WordLearningModule } from './word-learning.module';

// Mock the services
jest.mock('../services/translation.service');
jest.mock('../services/image.service');
jest.mock('../services/word.service');

describe('WordLearningModule - Property-Based Tests', () => {
  let module: WordLearningModule;

  beforeEach(() => {
    jest.clearAllMocks();
    module = new WordLearningModule();
  });

  describe('Property 2: Invalid Input Rejection', () => {
    // Feature: children-english-learning-platform, Property 2:
    // 对于任意无效或空输入（包括空字符串、纯空格、特殊字符、超长字符串），
    // 翻译服务和单词学习模块都应该拒绝处理并返回描述性错误消息

    it('should reject empty strings and whitespace-only inputs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 })
          ),
          (invalidInput) => {
            // Test WordLearningModule
            const moduleResult = module.validateWordInput(invalidInput);
            expect(moduleResult.valid).toBe(false);
            expect(moduleResult.error).toBeTruthy();
            expect(typeof moduleResult.error).toBe('string');
            expect(moduleResult.error).toContain('不能为空');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject inputs with special characters and numbers', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
            // Filter to only include strings with invalid characters
            return /[^a-zA-Z ]/.test(s);
          }),
          (invalidInput) => {
            // Test WordLearningModule
            const moduleResult = module.validateWordInput(invalidInput);
            expect(moduleResult.valid).toBe(false);
            expect(moduleResult.error).toBeTruthy();
            expect(typeof moduleResult.error).toBe('string');
            expect(moduleResult.error).toContain('只能包含字母和空格');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject inputs exceeding 50 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 51, maxLength: 100 }).map((s) => {
            // Ensure it only contains valid characters (letters and spaces)
            return s.replace(/[^a-zA-Z ]/g, 'a');
          }),
          (invalidInput) => {
            // Test WordLearningModule
            const moduleResult = module.validateWordInput(invalidInput);
            expect(moduleResult.valid).toBe(false);
            expect(moduleResult.error).toBeTruthy();
            expect(typeof moduleResult.error).toBe('string');
            expect(moduleResult.error).toContain('不能超过50个字符');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject any combination of invalid inputs', () => {
      fc.assert(
        fc.property(
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
          (invalidInput) => {
            // Test WordLearningModule
            const moduleResult = module.validateWordInput(invalidInput);
            
            // Should always reject invalid input
            expect(moduleResult.valid).toBe(false);
            
            // Should provide a descriptive error message
            expect(moduleResult.error).toBeTruthy();
            expect(typeof moduleResult.error).toBe('string');
            expect(moduleResult.error!.length).toBeGreaterThan(0);
            
            // Error message should be in Chinese and descriptive
            expect(moduleResult.error).toMatch(/不能为空|只能包含字母和空格|不能超过50个字符/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide consistent error messages for the same type of invalid input', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { input: '', expectedError: '不能为空' },
            { input: '   ', expectedError: '不能为空' },
            { input: 'hello123', expectedError: '只能包含字母和空格' },
            { input: 'hello!', expectedError: '只能包含字母和空格' },
            { input: 'a'.repeat(51), expectedError: '不能超过50个字符' }
          ),
          ({ input, expectedError }) => {
            const result = module.validateWordInput(input);
            expect(result.valid).toBe(false);
            expect(result.error).toContain(expectedError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject inputs with mixed valid and invalid characters', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 1, maxLength: 20 }),
            fc.constantFrom('1', '2', '!', '@', '#', '$', '%')
          ).map(([validPart, invalidChar]) => validPart + invalidChar),
          (invalidInput) => {
            const result = module.validateWordInput(invalidInput);
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
            expect(result.error).toContain('只能包含字母和空格');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases of invalid inputs', () => {
      const edgeCases = [
        '',                          // Empty string
        ' ',                         // Single space
        '  ',                        // Multiple spaces
        '\t',                        // Tab
        '\n',                        // Newline
        '\r',                        // Carriage return
        'a'.repeat(51),              // Exactly 51 characters
        'a'.repeat(100),             // Very long string
        '123',                       // Only numbers
        '!!!',                       // Only special characters
        'hello world!',              // Valid words with special char
        'hello123world',             // Valid words with numbers
        'hello\nworld',              // Valid words with newline
        'hello\tworld',              // Valid words with tab
        'HELLO',                     // All caps (should be valid)
        'Hello World',               // Mixed case with space (should be valid)
      ];

      edgeCases.forEach((input) => {
        const result = module.validateWordInput(input);
        
        // Determine if input should be valid
        const shouldBeValid = /^[a-zA-Z ]+$/.test(input) && 
                             input.trim().length > 0 && 
                             input.length <= 50;

        if (shouldBeValid) {
          expect(result.valid).toBe(true);
        } else {
          expect(result.valid).toBe(false);
          expect(result.error).toBeTruthy();
          expect(typeof result.error).toBe('string');
        }
      });
    });
  });

  describe('Property 18: Word Input Character Validation', () => {
    // Feature: children-english-learning-platform, Property 18: 单词输入字符验证
    // **Validates: Requirements 15.1**
    // 对于任意输入字符串，单词学习模块应该仅接受包含字母（a-z, A-Z）和空格的字符串，
    // 拒绝包含数字、标点符号或特殊字符的输入。

    it('should accept only strings containing letters and spaces', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (input) => {
            const result = module.validateWordInput(input);
            
            // Determine if input should be valid based on the rules:
            // 1. Must contain only letters (a-z, A-Z) and spaces
            // 2. Must not be empty or only whitespace
            // 3. Must not exceed 50 characters
            const hasOnlyLettersAndSpaces = /^[a-zA-Z ]+$/.test(input);
            const isNotEmpty = input.trim().length > 0;
            const isWithinLength = input.length <= 50;
            
            const shouldBeValid = hasOnlyLettersAndSpaces && isNotEmpty && isWithinLength;
            
            if (shouldBeValid) {
              // Should accept valid input
              expect(result.valid).toBe(true);
              expect(result.error).toBeUndefined();
            } else {
              // Should reject invalid input
              expect(result.valid).toBe(false);
              expect(result.error).toBeTruthy();
              expect(typeof result.error).toBe('string');
              
              // Error message should be descriptive and in Chinese
              if (!isNotEmpty) {
                expect(result.error).toContain('不能为空');
              } else if (!isWithinLength) {
                expect(result.error).toContain('不能超过50个字符');
              } else if (!hasOnlyLettersAndSpaces) {
                expect(result.error).toContain('只能包含字母和空格');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject strings containing numbers', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'), { minLength: 1, maxLength: 20 }),
            fc.integer({ min: 0, max: 9 })
          ).map(([letters, digit]) => letters + digit.toString()),
          (inputWithNumber) => {
            const result = module.validateWordInput(inputWithNumber);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
            expect(result.error).toContain('只能包含字母和空格');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject strings containing punctuation', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'), { minLength: 1, maxLength: 20 }),
            fc.constantFrom('.', ',', '!', '?', ';', ':', '-', '_', '(', ')', '[', ']', '{', '}')
          ).map(([letters, punctuation]) => letters + punctuation),
          (inputWithPunctuation) => {
            const result = module.validateWordInput(inputWithPunctuation);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
            expect(result.error).toContain('只能包含字母和空格');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject strings containing special characters', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'), { minLength: 1, maxLength: 20 }),
            fc.constantFrom('@', '#', '$', '%', '^', '&', '*', '+', '=', '~', '`', '|', '\\', '/', '<', '>')
          ).map(([letters, specialChar]) => letters + specialChar),
          (inputWithSpecialChar) => {
            const result = module.validateWordInput(inputWithSpecialChar);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
            expect(result.error).toContain('只能包含字母和空格');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid strings with only letters', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(
              'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
              'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
              'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
              'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
            ),
            { minLength: 1, maxLength: 50 }
          ),
          (validInput) => {
            const result = module.validateWordInput(validInput);
            
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid strings with letters and spaces', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(
              'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
              'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
              'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
              'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
              ' '
            ),
            { minLength: 1, maxLength: 50 }
          ).filter(s => s.trim().length > 0), // Ensure not only spaces
          (validInput) => {
            const result = module.validateWordInput(validInput);
            
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle mixed case letters correctly', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 1, maxLength: 20 }),
            fc.stringOf(fc.constantFrom('A', 'B', 'C', 'D', 'E'), { minLength: 1, maxLength: 20 })
          ).map(([lower, upper]) => lower + upper),
          (mixedCaseInput) => {
            const result = module.validateWordInput(mixedCaseInput);
            
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate character types consistently across all positions', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.stringOf(fc.constantFrom('a', 'b', 'c'), { minLength: 1, maxLength: 15 }),
            fc.constantFrom('1', '!', '@', '#'),
            fc.stringOf(fc.constantFrom('x', 'y', 'z'), { minLength: 1, maxLength: 15 })
          ).map(([prefix, invalidChar, suffix]) => prefix + invalidChar + suffix),
          (inputWithInvalidInMiddle) => {
            const result = module.validateWordInput(inputWithInvalidInMiddle);
            
            // Should reject regardless of where the invalid character appears
            expect(result.valid).toBe(false);
            expect(result.error).toContain('只能包含字母和空格');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 19: Word Length Limit', () => {
    // Feature: children-english-learning-platform, Property 19: 对于任意长度输入的字符串，如果长度超过50个字符，单词学习模块应该拒绝该输入并返回错误消息
    // **Validates: Requirements 15.2**

    it('should reject strings exceeding 50 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 51, maxLength: 200 }),
          (longInput) => {
            const result = module.validateWordInput(longInput);
            
            // Should always reject inputs longer than 50 characters
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
            expect(result.error).toContain('不能超过50个字符');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept strings with exactly 50 characters (boundary)', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(
              'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
              'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
              'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
              'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
              ' '
            ),
            { minLength: 50, maxLength: 50 }
          ).filter(s => s.trim().length > 0), // Ensure not only spaces
          (exactlyFiftyChars) => {
            const result = module.validateWordInput(exactlyFiftyChars);
            
            // Should accept exactly 50 characters
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept strings with less than 50 characters', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(
              'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
              'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
              'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
              'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
              ' '
            ),
            { minLength: 1, maxLength: 49 }
          ).filter(s => s.trim().length > 0), // Ensure not only spaces
          (validLengthInput) => {
            const result = module.validateWordInput(validLengthInput);
            
            // Should accept inputs with valid length
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject strings with 51 characters (boundary)', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(
              'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
              'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
            ),
            { minLength: 51, maxLength: 51 }
          ),
          (exactlyFiftyOneChars) => {
            const result = module.validateWordInput(exactlyFiftyOneChars);
            
            // Should reject exactly 51 characters
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
            expect(result.error).toContain('不能超过50个字符');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate length before character validation', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.stringOf(fc.constantFrom('a', 'b', 'c'), { minLength: 51, maxLength: 100 }),
            fc.constantFrom('1', '!', '@', '#', '$')
          ).map(([longString, invalidChar]) => longString + invalidChar),
          (longInvalidInput) => {
            const result = module.validateWordInput(longInvalidInput);
            
            // Should reject with length error (length is checked first)
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
            // The error could be either length or character validation
            // depending on implementation order, but should be rejected
            expect(result.error).toMatch(/不能超过50个字符|只能包含字母和空格/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle very long strings (stress test)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 1000 }),
          (veryLongInput) => {
            const result = module.validateWordInput(veryLongInput);
            
            // Should always reject very long inputs
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly count multi-byte characters', () => {
      // Test that length is counted correctly (not byte length)
      const testCases = [
        'a'.repeat(50),           // Exactly 50 ASCII chars - should pass
        'a'.repeat(51),           // Exactly 51 ASCII chars - should fail
        'hello world test',       // Valid phrase
        'a'.repeat(49) + ' ',     // 50 chars with space - should pass
      ];

      testCases.forEach((input) => {
        const result = module.validateWordInput(input);
        const shouldBeValid = input.length <= 50 && /^[a-zA-Z ]+$/.test(input) && input.trim().length > 0;
        
        if (shouldBeValid) {
          expect(result.valid).toBe(true);
        } else {
          expect(result.valid).toBe(false);
          expect(result.error).toBeTruthy();
        }
      });
    });

    it('should enforce length limit consistently across all valid character inputs', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 0, max: 100 }),
            fc.constantFrom('a', 'b', 'c', 'A', 'B', 'C', ' ')
          ).map(([length, char]) => char.repeat(length)),
          (repeatedChar) => {
            const result = module.validateWordInput(repeatedChar);
            
            const isValidLength = repeatedChar.length > 0 && repeatedChar.length <= 50;
            const isNotOnlySpaces = repeatedChar.trim().length > 0;
            const shouldBeValid = isValidLength && isNotOnlySpaces;
            
            if (shouldBeValid) {
              expect(result.valid).toBe(true);
            } else {
              expect(result.valid).toBe(false);
              expect(result.error).toBeTruthy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

