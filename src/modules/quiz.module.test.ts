import { QuizModule } from './quiz.module';
import { pool } from '../config/database';
import { ImageService } from '../services/image.service';
import { ValidationError, DatabaseError } from '../utils/errors';

// Mock dependencies
jest.mock('../config/database');
jest.mock('../services/image.service');
jest.mock('../utils/logger');

describe('QuizModule - Unit Tests', () => {
  let quizModule: QuizModule;
  let mockPool: jest.Mocked<typeof pool>;
  let mockImageService: jest.Mocked<ImageService>;

  beforeEach(() => {
    jest.clearAllMocks();
    quizModule = new QuizModule();
    mockPool = pool as jest.Mocked<typeof pool>;
    mockImageService = (quizModule as any).imageService as jest.Mocked<ImageService>;
  });

  describe('generateQuestionAsync', () => {
    /**
     * Test: Question generation with sufficient user images
     * Requirements: 7.2, 7.3
     */
    it('should generate question with 4 options when user has enough learned words', async () => {
      // Setup
      const word = {
        id: 'word-123',
        word: 'apple',
        translation: '苹果',
        imageUrl: 'https://example.com/apple.jpg',
      };
      const userId = 'user-456';

      // Mock database to return 3 distractor images from user's history
      const distractorImages = [
        { image_url: 'https://example.com/banana.jpg', english_word: 'banana' },
        { image_url: 'https://example.com/orange.jpg', english_word: 'orange' },
        { image_url: 'https://example.com/grape.jpg', english_word: 'grape' },
      ];

      mockPool.query = jest.fn().mockResolvedValueOnce({ rows: distractorImages });

      // Execute
      const question = await quizModule.generateQuestionAsync(word, userId);

      // Verify
      expect(question).toBeDefined();
      expect(question.word).toBe('apple');
      expect(question.translation).toBe('苹果');
      expect(question.options).toHaveLength(4);
      expect(question.questionId).toBeTruthy();

      // Verify correct answer is included
      const correctOption = question.options.find((opt) => opt.isCorrect);
      expect(correctOption).toBeDefined();
      expect(correctOption?.imageUrl).toBe('https://example.com/apple.jpg');

      // Verify 3 distractor options
      const distractorOptions = question.options.filter((opt) => !opt.isCorrect);
      expect(distractorOptions).toHaveLength(3);
    });

    /**
     * Test: Question generation with insufficient user images
     * Requirements: 7.4, 7.5
     */
    it('should supplement with default images when user has fewer than 3 learned words', async () => {
      // Setup
      const word = {
        id: 'word-123',
        word: 'apple',
        translation: '苹果',
        imageUrl: 'https://example.com/apple.jpg',
      };
      const userId = 'user-456';

      // Mock database to return only 1 distractor image
      const userImages = [
        { image_url: 'https://example.com/banana.jpg', english_word: 'banana' },
      ];

      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: userImages }) // User images
        .mockResolvedValueOnce({ rows: [{ english_word: 'apple' }, { english_word: 'banana' }] }); // Exclude words

      // Mock image service to provide 2 default images
      const defaultImages = [
        'https://example.com/default1.jpg',
        'https://example.com/default2.jpg',
      ];
      mockImageService.getDistractorImagesAsync = jest.fn().mockResolvedValue(defaultImages);

      // Execute
      const question = await quizModule.generateQuestionAsync(word, userId);

      // Verify
      expect(question.options).toHaveLength(4);
      expect(mockImageService.getDistractorImagesAsync).toHaveBeenCalledWith(
        ['apple', 'banana'],
        2
      );

      // Verify all options are unique
      const imageUrls = question.options.map((opt) => opt.imageUrl);
      const uniqueUrls = new Set(imageUrls);
      expect(uniqueUrls.size).toBe(4);
    });

    /**
     * Test: Validation error for incomplete word data
     * Requirements: 7.2
     */
    it('should throw ValidationError when word data is incomplete', async () => {
      // Setup
      const incompleteWord = {
        id: 'word-123',
        word: 'apple',
        translation: '', // Missing translation
        imageUrl: 'https://example.com/apple.jpg',
      };
      const userId = 'user-456';

      // Execute & Verify
      await expect(
        quizModule.generateQuestionAsync(incompleteWord, userId)
      ).rejects.toThrow(ValidationError);
    });

    /**
     * Test: Validation error for empty user ID
     * Requirements: 7.4
     */
    it('should throw ValidationError when userId is empty', async () => {
      // Setup
      const word = {
        id: 'word-123',
        word: 'apple',
        translation: '苹果',
        imageUrl: 'https://example.com/apple.jpg',
      };

      // Execute & Verify
      await expect(quizModule.generateQuestionAsync(word, '')).rejects.toThrow(
        ValidationError
      );
    });

    /**
     * Test: Options are randomized
     * Requirements: 7.3
     */
    it('should randomize option positions', async () => {
      // Setup
      const word = {
        id: 'word-123',
        word: 'apple',
        translation: '苹果',
        imageUrl: 'https://example.com/apple.jpg',
      };
      const userId = 'user-456';

      const distractorImages = [
        { image_url: 'https://example.com/banana.jpg', english_word: 'banana' },
        { image_url: 'https://example.com/orange.jpg', english_word: 'orange' },
        { image_url: 'https://example.com/grape.jpg', english_word: 'grape' },
      ];

      mockPool.query = jest.fn().mockResolvedValue({ rows: distractorImages });

      // Execute multiple times and collect positions
      const positions: number[] = [];
      for (let i = 0; i < 20; i++) {
        mockPool.query = jest.fn().mockResolvedValue({ rows: distractorImages });
        const question = await quizModule.generateQuestionAsync(word, userId);
        const correctIndex = question.options.findIndex((opt) => opt.isCorrect);
        positions.push(correctIndex);
      }

      // Verify: Position varies (not always the same)
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBeGreaterThan(1);
    });
  });

  describe('validateAnswer', () => {
    /**
     * Test: Correct answer validation
     * Requirements: 8.1, 8.2
     */
    it('should return correct=true when selected image matches correct answer', async () => {
      // Setup: Generate a question first
      const word = {
        id: 'word-123',
        word: 'apple',
        translation: '苹果',
        imageUrl: 'https://example.com/apple.jpg',
      };
      const userId = 'user-456';

      const distractorImages = [
        { image_url: 'https://example.com/banana.jpg', english_word: 'banana' },
        { image_url: 'https://example.com/orange.jpg', english_word: 'orange' },
        { image_url: 'https://example.com/grape.jpg', english_word: 'grape' },
      ];

      mockPool.query = jest.fn().mockResolvedValue({ rows: distractorImages });

      const question = await quizModule.generateQuestionAsync(word, userId);

      // Execute: Validate with correct answer
      const result = quizModule.validateAnswer(
        question.questionId,
        'https://example.com/apple.jpg'
      );

      // Verify
      expect(result.correct).toBe(true);
      expect(result.correctImageUrl).toBe('https://example.com/apple.jpg');
    });

    /**
     * Test: Incorrect answer validation
     * Requirements: 8.1, 8.3
     */
    it('should return correct=false when selected image does not match', async () => {
      // Setup: Generate a question first
      const word = {
        id: 'word-123',
        word: 'apple',
        translation: '苹果',
        imageUrl: 'https://example.com/apple.jpg',
      };
      const userId = 'user-456';

      const distractorImages = [
        { image_url: 'https://example.com/banana.jpg', english_word: 'banana' },
        { image_url: 'https://example.com/orange.jpg', english_word: 'orange' },
        { image_url: 'https://example.com/grape.jpg', english_word: 'grape' },
      ];

      mockPool.query = jest.fn().mockResolvedValue({ rows: distractorImages });

      const question = await quizModule.generateQuestionAsync(word, userId);

      // Execute: Validate with incorrect answer
      const result = quizModule.validateAnswer(
        question.questionId,
        'https://example.com/banana.jpg'
      );

      // Verify
      expect(result.correct).toBe(false);
      expect(result.correctImageUrl).toBe('https://example.com/apple.jpg');
    });

    /**
     * Test: Validation error for empty question ID
     * Requirements: 8.1
     */
    it('should throw ValidationError when questionId is empty', () => {
      // Execute & Verify
      expect(() => quizModule.validateAnswer('', 'https://example.com/image.jpg')).toThrow(
        ValidationError
      );
    });

    /**
     * Test: Validation error for empty selected image URL
     * Requirements: 8.1
     */
    it('should throw ValidationError when selectedImageUrl is empty', () => {
      // Execute & Verify
      expect(() => quizModule.validateAnswer('question-123', '')).toThrow(ValidationError);
    });

    /**
     * Test: Validation error for non-existent question
     * Requirements: 8.1
     */
    it('should throw ValidationError when question does not exist', () => {
      // Execute & Verify
      expect(() =>
        quizModule.validateAnswer('non-existent-id', 'https://example.com/image.jpg')
      ).toThrow(ValidationError);
    });

    /**
     * Test: Question cleanup after validation
     * Requirements: 8.1
     */
    it('should clean up question after validation', async () => {
      // Setup: Generate a question first
      const word = {
        id: 'word-123',
        word: 'apple',
        translation: '苹果',
        imageUrl: 'https://example.com/apple.jpg',
      };
      const userId = 'user-456';

      const distractorImages = [
        { image_url: 'https://example.com/banana.jpg', english_word: 'banana' },
        { image_url: 'https://example.com/orange.jpg', english_word: 'orange' },
        { image_url: 'https://example.com/grape.jpg', english_word: 'grape' },
      ];

      mockPool.query = jest.fn().mockResolvedValue({ rows: distractorImages });

      const question = await quizModule.generateQuestionAsync(word, userId);

      // Execute: Validate answer
      quizModule.validateAnswer(question.questionId, 'https://example.com/apple.jpg');

      // Verify: Question is cleaned up and cannot be validated again
      expect(() =>
        quizModule.validateAnswer(question.questionId, 'https://example.com/apple.jpg')
      ).toThrow(ValidationError);
    });
  });

  describe('getDistractorImagesAsync (private method behavior)', () => {
    /**
     * Test: Database error handling
     * Requirements: 7.4
     */
    it('should throw DatabaseError when database query fails', async () => {
      // Setup
      const word = {
        id: 'word-123',
        word: 'apple',
        translation: '苹果',
        imageUrl: 'https://example.com/apple.jpg',
      };
      const userId = 'user-456';

      // Mock database to throw error
      mockPool.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      // Execute & Verify
      await expect(quizModule.generateQuestionAsync(word, userId)).rejects.toThrow(
        DatabaseError
      );
    });
  });
});
