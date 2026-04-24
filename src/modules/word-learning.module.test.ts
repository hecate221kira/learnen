import fc from 'fast-check';
import { WordLearningModule } from './word-learning.module';
import { TranslationService } from '../services/translation.service';
import { ImageService } from '../services/image.service';
import { WordService } from '../services/word.service';
import { ValidationError } from '../utils/errors';

// Mock the services
jest.mock('../services/translation.service');
jest.mock('../services/image.service');
jest.mock('../services/word.service');

describe('WordLearningModule', () => {
  let module: WordLearningModule;
  let mockTranslationService: jest.Mocked<TranslationService>;
  let mockImageService: jest.Mocked<ImageService>;
  let mockWordService: jest.Mocked<WordService>;

  beforeEach(() => {
    jest.clearAllMocks();
    module = new WordLearningModule();
    mockTranslationService = (module as any).translationService;
    mockImageService = (module as any).imageService;
    mockWordService = (module as any).wordService;
  });

  describe('validateWordInput', () => {
    // Feature: children-english-learning-platform, Property 2:
    // 对于任意无效或空输入，翻译服务和单词学习模块都应该拒绝处理并返回描述性错误消息
    it('should reject invalid inputs with descriptive error messages (property test)', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.string({ minLength: 51 }),
            fc.string().filter((s) => /[^a-zA-Z ]/.test(s) && s.length > 0)
          ),
          (invalidInput) => {
            const result = module.validateWordInput(invalidInput);
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
            expect(typeof result.error).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid word inputs', () => {
      const result = module.validateWordInput('hello');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty input', () => {
      const result = module.validateWordInput('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('单词不能为空');
    });

    it('should reject input with only spaces', () => {
      const result = module.validateWordInput('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('单词不能为空');
    });

    it('should reject input longer than 50 characters', () => {
      const longWord = 'a'.repeat(51);
      const result = module.validateWordInput(longWord);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('单词长度不能超过50个字符');
    });

    it('should reject input with numbers', () => {
      const result = module.validateWordInput('hello123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('单词只能包含字母和空格');
    });

    it('should reject input with special characters', () => {
      const result = module.validateWordInput('hello!');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('单词只能包含字母和空格');
    });

    it('should accept input with spaces', () => {
      const result = module.validateWordInput('hello world');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('translateWord', () => {
    it('should translate word and get image successfully', async () => {
      const mockTranslation = '你好';
      const mockImageUrl = 'https://example.com/image.jpg';

      mockTranslationService.translateToChineseAsync = jest
        .fn()
        .mockResolvedValue(mockTranslation);
      mockImageService.getImageForWordAsync = jest
        .fn()
        .mockResolvedValue(mockImageUrl);

      const result = await module.translateWord('hello');

      expect(result).toEqual({
        word: 'hello',
        translation: mockTranslation,
        imageUrl: mockImageUrl,
      });

      expect(mockTranslationService.translateToChineseAsync).toHaveBeenCalledWith(
        'hello'
      );
      expect(mockImageService.getImageForWordAsync).toHaveBeenCalledWith('hello');
    });

    it('should trim whitespace from input', async () => {
      const mockTranslation = '你好';
      const mockImageUrl = 'https://example.com/image.jpg';

      mockTranslationService.translateToChineseAsync = jest
        .fn()
        .mockResolvedValue(mockTranslation);
      mockImageService.getImageForWordAsync = jest
        .fn()
        .mockResolvedValue(mockImageUrl);

      const result = await module.translateWord('  hello  ');

      expect(result.word).toBe('hello');
      expect(mockTranslationService.translateToChineseAsync).toHaveBeenCalledWith(
        'hello'
      );
    });

    it('should reject invalid input', async () => {
      await expect(module.translateWord('')).rejects.toThrow(ValidationError);
      await expect(module.translateWord('hello123')).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle translation service errors', async () => {
      mockTranslationService.translateToChineseAsync = jest
        .fn()
        .mockRejectedValue(new Error('Translation failed'));

      await expect(module.translateWord('hello')).rejects.toThrow(
        'Translation failed'
      );
    });

    it('should handle image service errors', async () => {
      mockTranslationService.translateToChineseAsync = jest
        .fn()
        .mockResolvedValue('你好');
      mockImageService.getImageForWordAsync = jest
        .fn()
        .mockRejectedValue(new Error('Image fetch failed'));

      await expect(module.translateWord('hello')).rejects.toThrow(
        'Image fetch failed'
      );
    });

    it('should call translation and image services in parallel', async () => {
      const mockTranslation = '你好';
      const mockImageUrl = 'https://example.com/image.jpg';

      let translationStartTime = 0;
      let imageStartTime = 0;

      mockTranslationService.translateToChineseAsync = jest.fn().mockImplementation(
        async () => {
          translationStartTime = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 50));
          return mockTranslation;
        }
      );

      mockImageService.getImageForWordAsync = jest.fn().mockImplementation(
        async () => {
          imageStartTime = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 50));
          return mockImageUrl;
        }
      );

      await module.translateWord('hello');

      // Both should start at roughly the same time (within 10ms)
      expect(Math.abs(translationStartTime - imageStartTime)).toBeLessThan(10);
    });
  });

  describe('Complete Learning Flow', () => {
    // Requirements: 2.4, 4.4, 4.5
    // Test the complete word learning flow from input to storage

    it('should complete full learning flow: translate -> display -> save', async () => {
      // Requirement 2.4: Display English word and Chinese translation for confirmation
      const mockTranslation = '苹果';
      const mockImageUrl = 'https://example.com/apple.jpg';
      const mockSavedWord = {
        word: {
          id: 'word-456',
          userId: 'user-789',
          englishWord: 'apple',
          chineseTranslation: '苹果',
          imageUrl: 'https://example.com/apple.jpg',
          learnedAt: new Date(),
        },
        reviewSchedule: [],
      };

      mockTranslationService.translateToChineseAsync = jest
        .fn()
        .mockResolvedValue(mockTranslation);
      mockImageService.getImageForWordAsync = jest
        .fn()
        .mockResolvedValue(mockImageUrl);
      mockWordService.saveWord = jest.fn().mockResolvedValue(mockSavedWord);

      // Step 1: User inputs word and gets translation + image (Requirement 2.4)
      const translationResult = await module.translateWord('apple');
      expect(translationResult).toEqual({
        word: 'apple',
        translation: mockTranslation,
        imageUrl: mockImageUrl,
      });

      // Step 2: User confirms and saves word (Requirement 4.4)
      const saveResult = await module.saveWord(
        'user-789',
        translationResult.word,
        translationResult.translation,
        translationResult.imageUrl
      );

      // Requirement 4.4: Display success confirmation
      expect(saveResult.wordId).toBe('word-456');
      expect(saveResult.wordId).toBeTruthy();
      expect(mockWordService.saveWord).toHaveBeenCalledWith(
        'user-789',
        'apple',
        '苹果',
        'https://example.com/apple.jpg'
      );
    });

    it('should handle translation failure in learning flow', async () => {
      // Requirement 2.4: Handle translation service errors
      mockTranslationService.translateToChineseAsync = jest
        .fn()
        .mockRejectedValue(new Error('翻译服务暂时不可用'));

      await expect(module.translateWord('test')).rejects.toThrow(
        '翻译服务暂时不可用'
      );
    });

    it('should handle image retrieval failure in learning flow', async () => {
      // Requirement 2.4: Handle image service errors
      mockTranslationService.translateToChineseAsync = jest
        .fn()
        .mockResolvedValue('测试');
      mockImageService.getImageForWordAsync = jest
        .fn()
        .mockRejectedValue(new Error('图像服务暂时不可用'));

      await expect(module.translateWord('test')).rejects.toThrow(
        '图像服务暂时不可用'
      );
    });

    it('should display error and allow retry when database fails (Requirement 4.5)', async () => {
      // Requirement 4.5: Display error message and allow retry when save fails
      mockWordService.saveWord = jest
        .fn()
        .mockRejectedValueOnce(new Error('数据库连接失败'))
        .mockResolvedValueOnce({
          word: {
            id: 'word-retry-123',
            userId: 'user-123',
            englishWord: 'retry',
            chineseTranslation: '重试',
            imageUrl: 'https://example.com/retry.jpg',
            learnedAt: new Date(),
          },
          reviewSchedule: [],
        });

      // First attempt fails
      await expect(
        module.saveWord(
          'user-123',
          'retry',
          '重试',
          'https://example.com/retry.jpg'
        )
      ).rejects.toThrow('数据库连接失败');

      // User can retry - second attempt succeeds
      const retryResult = await module.saveWord(
        'user-123',
        'retry',
        '重试',
        'https://example.com/retry.jpg'
      );

      expect(retryResult.wordId).toBe('word-retry-123');
      expect(mockWordService.saveWord).toHaveBeenCalledTimes(2);
    });

    it('should validate input before starting learning flow', async () => {
      // Ensure invalid input is rejected before calling any services
      await expect(module.translateWord('')).rejects.toThrow(ValidationError);
      await expect(module.translateWord('hello123')).rejects.toThrow(
        ValidationError
      );
      await expect(module.translateWord('a'.repeat(51))).rejects.toThrow(
        ValidationError
      );

      // Services should not be called for invalid input
      expect(mockTranslationService.translateToChineseAsync).not.toHaveBeenCalled();
      expect(mockImageService.getImageForWordAsync).not.toHaveBeenCalled();
    });

    it('should handle complete flow with multiple words sequentially', async () => {
      // Test learning multiple words in sequence
      const words = [
        { word: 'cat', translation: '猫', imageUrl: 'https://example.com/cat.jpg' },
        { word: 'dog', translation: '狗', imageUrl: 'https://example.com/dog.jpg' },
        { word: 'bird', translation: '鸟', imageUrl: 'https://example.com/bird.jpg' },
      ];

      for (let i = 0; i < words.length; i++) {
        const { word, translation, imageUrl } = words[i];

        mockTranslationService.translateToChineseAsync = jest
          .fn()
          .mockResolvedValue(translation);
        mockImageService.getImageForWordAsync = jest
          .fn()
          .mockResolvedValue(imageUrl);
        mockWordService.saveWord = jest.fn().mockResolvedValue({
          word: {
            id: `word-${i}`,
            userId: 'user-123',
            englishWord: word,
            chineseTranslation: translation,
            imageUrl: imageUrl,
            learnedAt: new Date(),
          },
          reviewSchedule: [],
        });

        // Translate and get image
        const translationResult = await module.translateWord(word);
        expect(translationResult.word).toBe(word);
        expect(translationResult.translation).toBe(translation);
        expect(translationResult.imageUrl).toBe(imageUrl);

        // Save word
        const saveResult = await module.saveWord(
          'user-123',
          translationResult.word,
          translationResult.translation,
          translationResult.imageUrl
        );
        expect(saveResult.wordId).toBe(`word-${i}`);
      }
    });

    it('should preserve data integrity through complete flow', async () => {
      // Ensure data is not corrupted during the flow
      const originalWord = 'beautiful';
      const expectedTranslation = '美丽的';
      const expectedImageUrl = 'https://example.com/beautiful.jpg';

      mockTranslationService.translateToChineseAsync = jest
        .fn()
        .mockResolvedValue(expectedTranslation);
      mockImageService.getImageForWordAsync = jest
        .fn()
        .mockResolvedValue(expectedImageUrl);
      mockWordService.saveWord = jest.fn().mockImplementation((userId, word, translation, imageUrl) => {
        // Verify data integrity
        expect(word).toBe(originalWord);
        expect(translation).toBe(expectedTranslation);
        expect(imageUrl).toBe(expectedImageUrl);
        
        return Promise.resolve({
          word: {
            id: 'word-integrity-test',
            userId,
            englishWord: word,
            chineseTranslation: translation,
            imageUrl: imageUrl,
            learnedAt: new Date(),
          },
          reviewSchedule: [],
        });
      });

      // Complete flow
      const translationResult = await module.translateWord(originalWord);
      const saveResult = await module.saveWord(
        'user-123',
        translationResult.word,
        translationResult.translation,
        translationResult.imageUrl
      );

      expect(saveResult.wordId).toBe('word-integrity-test');
      expect(mockWordService.saveWord).toHaveBeenCalledWith(
        'user-123',
        originalWord,
        expectedTranslation,
        expectedImageUrl
      );
    });
  });

  describe('saveWord', () => {
    it('should save word successfully', async () => {
      const mockSavedWord = {
        word: {
          id: 'word-123',
          userId: 'user-123',
          englishWord: 'hello',
          chineseTranslation: '你好',
          imageUrl: 'https://example.com/image.jpg',
          learnedAt: new Date(),
        },
        reviewSchedule: [],
      };

      mockWordService.saveWord = jest.fn().mockResolvedValue(mockSavedWord);

      const result = await module.saveWord(
        'user-123',
        'hello',
        '你好',
        'https://example.com/image.jpg'
      );

      expect(result.wordId).toBe('word-123');
      expect(result.reviewSchedule).toEqual([]);

      expect(mockWordService.saveWord).toHaveBeenCalledWith(
        'user-123',
        'hello',
        '你好',
        'https://example.com/image.jpg'
      );
    });

    it('should trim whitespace from inputs', async () => {
      const mockSavedWord = {
        word: {
          id: 'word-123',
          userId: 'user-123',
          englishWord: 'hello',
          chineseTranslation: '你好',
          imageUrl: 'https://example.com/image.jpg',
          learnedAt: new Date(),
        },
        reviewSchedule: [],
      };

      mockWordService.saveWord = jest.fn().mockResolvedValue(mockSavedWord);

      await module.saveWord(
        'user-123',
        '  hello  ',
        '  你好  ',
        '  https://example.com/image.jpg  '
      );

      expect(mockWordService.saveWord).toHaveBeenCalledWith(
        'user-123',
        'hello',
        '你好',
        'https://example.com/image.jpg'
      );
    });

    it('should reject invalid word input', async () => {
      await expect(
        module.saveWord('user-123', '', '你好', 'https://example.com/image.jpg')
      ).rejects.toThrow(ValidationError);

      await expect(
        module.saveWord('user-123', 'hello123', '你好', 'https://example.com/image.jpg')
      ).rejects.toThrow(ValidationError);
    });

    it('should reject empty translation', async () => {
      await expect(
        module.saveWord('user-123', 'hello', '', 'https://example.com/image.jpg')
      ).rejects.toThrow('翻译不能为空');

      await expect(
        module.saveWord('user-123', 'hello', '   ', 'https://example.com/image.jpg')
      ).rejects.toThrow('翻译不能为空');
    });

    it('should reject empty image URL', async () => {
      await expect(
        module.saveWord('user-123', 'hello', '你好', '')
      ).rejects.toThrow('图像URL不能为空');

      await expect(
        module.saveWord('user-123', 'hello', '你好', '   ')
      ).rejects.toThrow('图像URL不能为空');
    });

    it('should reject empty user ID', async () => {
      await expect(
        module.saveWord('', 'hello', '你好', 'https://example.com/image.jpg')
      ).rejects.toThrow('用户ID不能为空');

      await expect(
        module.saveWord('   ', 'hello', '你好', 'https://example.com/image.jpg')
      ).rejects.toThrow('用户ID不能为空');
    });

    it('should handle word service errors', async () => {
      mockWordService.saveWord = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(
        module.saveWord('user-123', 'hello', '你好', 'https://example.com/image.jpg')
      ).rejects.toThrow('Database error');
    });
  });
});
