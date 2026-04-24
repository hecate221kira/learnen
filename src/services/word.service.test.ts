import fc from 'fast-check';
import { WordService } from './word.service';
import { ReviewScheduleService } from './review-schedule.service';
import { pool } from '../config/database';
import { ValidationError, DatabaseError } from '../utils/errors';
import { QueryResult } from 'pg';

// Mock dependencies
jest.mock('../config/database');
jest.mock('./review-schedule.service');

const mockPool = pool as jest.Mocked<typeof pool>;
const MockReviewScheduleService = ReviewScheduleService as jest.MockedClass<
  typeof ReviewScheduleService
>;

describe('WordService', () => {
  let wordService: WordService;
  let mockCreateInitialSchedules: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Setup mock for ReviewScheduleService
    mockCreateInitialSchedules = jest.fn().mockResolvedValue([
      {
        id: 'schedule-1',
        wordId: 'word-id',
        userId: 'user-id',
        dueDate: new Date('2024-01-02'),
        intervalDays: 1,
        completed: false,
      },
      {
        id: 'schedule-2',
        wordId: 'word-id',
        userId: 'user-id',
        dueDate: new Date('2024-01-04'),
        intervalDays: 3,
        completed: false,
      },
      {
        id: 'schedule-3',
        wordId: 'word-id',
        userId: 'user-id',
        dueDate: new Date('2024-01-08'),
        intervalDays: 7,
        completed: false,
      },
      {
        id: 'schedule-4',
        wordId: 'word-id',
        userId: 'user-id',
        dueDate: new Date('2024-01-16'),
        intervalDays: 15,
        completed: false,
      },
      {
        id: 'schedule-5',
        wordId: 'word-id',
        userId: 'user-id',
        dueDate: new Date('2024-01-31'),
        intervalDays: 30,
        completed: false,
      },
    ]);

    MockReviewScheduleService.mockImplementation(() => ({
      createInitialSchedules: mockCreateInitialSchedules,
      calculateInitialSchedule: jest.fn(),
      calculateNextReview: jest.fn(),
      createNextSchedule: jest.fn(),
      markScheduleCompleted: jest.fn(),
      getDueSchedules: jest.fn(),
    }) as any);

    wordService = new WordService();
  });

  describe('Property 3: 单词数据完整性', () => {
    // Feature: children-english-learning-platform, Property 3: 单词数据完整性
    // **Validates: Requirements 4.2**
    // 对于任意有效的单词数据（英语单词、中文翻译、图像URL），
    // 保存到数据库后再检索，所有字段都应该完整保留且值正确。
    it('should preserve all fields correctly after save and retrieve (property test)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid word data
          fc.record({
            userId: fc.uuid(),
            englishWord: fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => /^[a-zA-Z ]+$/.test(s) && s.trim().length > 0),
            chineseTranslation: fc
              .string({ minLength: 1, maxLength: 100 })
              .filter((s) => s.trim().length > 0),
            imageUrl: fc.webUrl(),
          }),
          async ({ userId, englishWord, chineseTranslation, imageUrl }) => {
            const wordId = fc.sample(fc.uuid(), 1)[0];
            const learnedAt = new Date();

            // Mock the INSERT query for word
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
              rows: [
                {
                  id: wordId,
                  user_id: userId,
                  english_word: englishWord.trim(),
                  chinese_translation: chineseTranslation.trim(),
                  image_url: imageUrl.trim(),
                  image_validated_at: null,
                  learned_at: learnedAt,
                },
              ],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            } as QueryResult);

            // Mock the SELECT query
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
              rows: [
                {
                  id: wordId,
                  user_id: userId,
                  english_word: englishWord.trim(),
                  chinese_translation: chineseTranslation.trim(),
                  image_url: imageUrl.trim(),
                  image_validated_at: null,
                  learned_at: learnedAt,
                },
              ],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            } as QueryResult);

            // Save the word
            const result = await wordService.saveWord(
              userId,
              englishWord,
              chineseTranslation,
              imageUrl
            );

            // Retrieve the word
            const retrievedWord = await wordService.getWordById(result.word.id);

            // Verify all fields are preserved correctly
            expect(retrievedWord).not.toBeNull();
            expect(retrievedWord!.id).toBe(result.word.id);
            expect(retrievedWord!.userId).toBe(userId);
            expect(retrievedWord!.englishWord).toBe(englishWord.trim());
            expect(retrievedWord!.chineseTranslation).toBe(chineseTranslation.trim());
            expect(retrievedWord!.imageUrl).toBe(imageUrl.trim());
            expect(retrievedWord!.learnedAt).toEqual(result.word.learnedAt);

            // Verify the saved word has correct values
            expect(result.word.userId).toBe(userId);
            expect(result.word.englishWord).toBe(englishWord.trim());
            expect(result.word.chineseTranslation).toBe(chineseTranslation.trim());
            expect(result.word.imageUrl).toBe(imageUrl.trim());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('saveWord', () => {
    it('should successfully save a valid word and create review schedules', async () => {
      const wordData = {
        userId: 'user-123',
        englishWord: 'apple',
        chineseTranslation: '苹果',
        imageUrl: 'https://example.com/apple.jpg',
      };

      const wordId = 'word-456';
      const learnedAt = new Date();

      // Mock word insert
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: wordId,
            user_id: wordData.userId,
            english_word: wordData.englishWord,
            chinese_translation: wordData.chineseTranslation,
            image_url: wordData.imageUrl,
            image_validated_at: null,
            learned_at: learnedAt,
          },
        ],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);

      const result = await wordService.saveWord(
        wordData.userId,
        wordData.englishWord,
        wordData.chineseTranslation,
        wordData.imageUrl
      );

      expect(result.word.id).toBe(wordId);
      expect(result.word.userId).toBe(wordData.userId);
      expect(result.word.englishWord).toBe(wordData.englishWord);
      expect(result.word.chineseTranslation).toBe(wordData.chineseTranslation);
      expect(result.word.imageUrl).toBe(wordData.imageUrl);
      expect(result.word.learnedAt).toEqual(learnedAt);
      expect(result.reviewSchedule).toHaveLength(5);
      expect(mockCreateInitialSchedules).toHaveBeenCalledWith(wordId, wordData.userId, learnedAt);
    });

    it('should throw ValidationError for invalid english word', async () => {
      await expect(
        wordService.saveWord('user-123', 'hello123', '你好', 'https://example.com/image.jpg')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty chinese translation', async () => {
      await expect(
        wordService.saveWord('user-123', 'hello', '', 'https://example.com/image.jpg')
      ).rejects.toThrow(ValidationError);
      await expect(
        wordService.saveWord('user-123', 'hello', '', 'https://example.com/image.jpg')
      ).rejects.toThrow('中文翻译不能为空');
    });

    it('should throw ValidationError for empty image URL', async () => {
      await expect(wordService.saveWord('user-123', 'hello', '你好', '')).rejects.toThrow(
        ValidationError
      );
      await expect(wordService.saveWord('user-123', 'hello', '你好', '')).rejects.toThrow(
        '图像URL不能为空'
      );
    });

    it('should throw ValidationError for empty user ID', async () => {
      await expect(
        wordService.saveWord('', 'hello', '你好', 'https://example.com/image.jpg')
      ).rejects.toThrow(ValidationError);
      await expect(
        wordService.saveWord('', 'hello', '你好', 'https://example.com/image.jpg')
      ).rejects.toThrow('用户ID不能为空');
    });

    it('should throw DatabaseError for non-existent user', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue({ code: '23503' }); // Foreign key violation

      await expect(
        wordService.saveWord('non-existent-user', 'hello', '你好', 'https://example.com/image.jpg')
      ).rejects.toThrow(DatabaseError);
      await expect(
        wordService.saveWord('non-existent-user', 'hello', '你好', 'https://example.com/image.jpg')
      ).rejects.toThrow('用户不存在');
    });

    it('should throw DatabaseError for database errors', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await expect(
        wordService.saveWord('user-123', 'hello', '你好', 'https://example.com/image.jpg')
      ).rejects.toThrow(DatabaseError);
    });

    it('should trim whitespace from inputs', async () => {
      const wordData = {
        userId: 'user-123',
        englishWord: '  apple  ',
        chineseTranslation: '  苹果  ',
        imageUrl: '  https://example.com/apple.jpg  ',
      };

      const wordId = 'word-456';
      const learnedAt = new Date();

      // Mock word insert
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: wordId,
            user_id: wordData.userId,
            english_word: 'apple',
            chinese_translation: '苹果',
            image_url: 'https://example.com/apple.jpg',
            image_validated_at: null,
            learned_at: learnedAt,
          },
        ],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);

      const result = await wordService.saveWord(
        wordData.userId,
        wordData.englishWord,
        wordData.chineseTranslation,
        wordData.imageUrl
      );

      expect(result.word.englishWord).toBe('apple');
      expect(result.word.chineseTranslation).toBe('苹果');
      expect(result.word.imageUrl).toBe('https://example.com/apple.jpg');
    });
  });

  describe('getWordById', () => {
    it('should retrieve a word by ID', async () => {
      const wordId = 'word-123';
      const wordData = {
        id: wordId,
        user_id: 'user-456',
        english_word: 'hello',
        chinese_translation: '你好',
        image_url: 'https://example.com/hello.jpg',
        image_validated_at: null,
        learned_at: new Date(),
      };

      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [wordData],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);

      const result = await wordService.getWordById(wordId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(wordId);
      expect(result!.userId).toBe(wordData.user_id);
      expect(result!.englishWord).toBe(wordData.english_word);
      expect(result!.chineseTranslation).toBe(wordData.chinese_translation);
      expect(result!.imageUrl).toBe(wordData.image_url);
    });

    it('should return null for non-existent word', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      const result = await wordService.getWordById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should throw ValidationError for empty word ID', async () => {
      await expect(wordService.getWordById('')).rejects.toThrow(ValidationError);
      await expect(wordService.getWordById('')).rejects.toThrow('单词ID不能为空');
    });

    it('should throw DatabaseError for database errors', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(wordService.getWordById('word-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('getUserWords', () => {
    it('should retrieve all words for a user', async () => {
      const userId = 'user-123';
      const words = [
        {
          id: 'word-1',
          user_id: userId,
          english_word: 'hello',
          chinese_translation: '你好',
          image_url: 'https://example.com/hello.jpg',
          image_validated_at: null,
          learned_at: new Date('2024-01-01'),
        },
        {
          id: 'word-2',
          user_id: userId,
          english_word: 'world',
          chinese_translation: '世界',
          image_url: 'https://example.com/world.jpg',
          image_validated_at: null,
          learned_at: new Date('2024-01-02'),
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: words,
        command: 'SELECT',
        rowCount: 2,
        oid: 0,
        fields: [],
      } as QueryResult);

      const result = await wordService.getUserWords(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('word-1');
      expect(result[1].id).toBe('word-2');
    });

    it('should return empty array for user with no words', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      const result = await wordService.getUserWords('user-123');

      expect(result).toEqual([]);
    });

    it('should throw ValidationError for empty user ID', async () => {
      await expect(wordService.getUserWords('')).rejects.toThrow(ValidationError);
      await expect(wordService.getUserWords('')).rejects.toThrow('用户ID不能为空');
    });

    it('should throw DatabaseError for database errors', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(wordService.getUserWords('user-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('deleteWord', () => {
    it('should delete a word successfully', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        command: 'DELETE',
        rowCount: 1,
        oid: 0,
        fields: [],
        rows: [],
      } as QueryResult);

      const result = await wordService.deleteWord('word-123');

      expect(result).toBe(true);
    });

    it('should return false for non-existent word', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        command: 'DELETE',
        rowCount: 0,
        oid: 0,
        fields: [],
        rows: [],
      } as QueryResult);

      const result = await wordService.deleteWord('non-existent-id');

      expect(result).toBe(false);
    });

    it('should throw ValidationError for empty word ID', async () => {
      await expect(wordService.deleteWord('')).rejects.toThrow(ValidationError);
      await expect(wordService.deleteWord('')).rejects.toThrow('单词ID不能为空');
    });

    it('should throw DatabaseError for database errors', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(wordService.deleteWord('word-123')).rejects.toThrow(DatabaseError);
    });
  });
});
