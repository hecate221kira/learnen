import fc from 'fast-check';
import { validateWordInput, validateUsername, validatePassword } from './validation';
import { ValidationError } from './errors';

describe('Validation Utils', () => {
  describe('validateWordInput', () => {
    // Feature: children-english-learning-platform, Property 18:
    // 对于任意输入字符串，单词学习模块应该仅接受包含字母和空格的字符串
    it('should only accept letters and spaces (property test)', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const hasOnlyLettersAndSpaces = /^[a-zA-Z ]+$/.test(input);
          const isNotEmpty = input.trim().length > 0;
          const isNotTooLong = input.length <= 50;

          if (hasOnlyLettersAndSpaces && isNotEmpty && isNotTooLong) {
            // Should accept
            expect(() => validateWordInput(input)).not.toThrow();
          } else {
            // Should reject
            expect(() => validateWordInput(input)).toThrow(ValidationError);
          }
        }),
        { numRuns: 100 }
      );
    });

    // Feature: children-english-learning-platform, Property 19:
    // 对于任意输入字符串，如果长度超过50个字符，单词学习模块应该拒绝该输入
    it('should reject words longer than 50 characters (property test)', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 51, maxLength: 100 }), (longWord) => {
          expect(() => validateWordInput(longWord)).toThrow(ValidationError);
          expect(() => validateWordInput(longWord)).toThrow('单词长度不能超过50个字符');
        }),
        { numRuns: 100 }
      );
    });

    it('should accept valid English words', () => {
      expect(validateWordInput('hello')).toBe(true);
      expect(validateWordInput('Hello World')).toBe(true);
      expect(validateWordInput('apple')).toBe(true);
    });

    it('should reject empty or whitespace-only input', () => {
      expect(() => validateWordInput('')).toThrow('单词不能为空');
      expect(() => validateWordInput('   ')).toThrow('单词不能为空');
    });

    it('should reject words with numbers', () => {
      expect(() => validateWordInput('hello123')).toThrow('单词只能包含字母和空格');
    });

    it('should reject words with special characters', () => {
      expect(() => validateWordInput('hello!')).toThrow('单词只能包含字母和空格');
      expect(() => validateWordInput('hello@world')).toThrow('单词只能包含字母和空格');
    });
  });

  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      expect(validateUsername('user123')).toBe(true);
      expect(validateUsername('test_user')).toBe(true);
      expect(validateUsername('abc')).toBe(true);
    });

    it('should reject usernames that are too short', () => {
      expect(() => validateUsername('ab')).toThrow('用户名长度必须在3-20个字符之间');
    });

    it('should reject usernames that are too long', () => {
      expect(() => validateUsername('a'.repeat(21))).toThrow('用户名长度必须在3-20个字符之间');
    });

    it('should reject usernames with invalid characters', () => {
      expect(() => validateUsername('user@123')).toThrow('用户名只能包含字母、数字和下划线');
      expect(() => validateUsername('user-name')).toThrow('用户名只能包含字母、数字和下划线');
    });
  });

  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      expect(validatePassword('password123')).toBe(true);
      expect(validatePassword('123456')).toBe(true);
    });

    it('should reject passwords that are too short', () => {
      expect(() => validatePassword('12345')).toThrow('密码长度至少为6个字符');
      expect(() => validatePassword('')).toThrow('密码长度至少为6个字符');
    });
  });
});
