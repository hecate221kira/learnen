import fc from 'fast-check';
import { QuizModule } from './quiz.module';
import { pool } from '../config/database';
import { ImageService } from '../services/image.service';

// Mock dependencies
jest.mock('../config/database');
jest.mock('../services/image.service');
jest.mock('../utils/logger');

describe('QuizModule - Property-Based Tests', () => {
  let quizModule: QuizModule;
  let mockPool: jest.Mocked<typeof pool>;
  let mockImageService: jest.Mocked<ImageService>;

  beforeEach(() => {
    jest.clearAllMocks();
    quizModule = new QuizModule();
    mockPool = pool as jest.Mocked<typeof pool>;
    mockImageService = (quizModule as any).imageService as jest.Mocked<ImageService>;
  });

  /**
   * Feature: children-english-learning-platform, Property 8:
   * 对于任意单词和可用图像集合，生成的测验应该包含恰好4个图像选项，
   * 其中1个是正确答案，3个是干扰项。如果用户学习的单词不足4个，
   * 应该从默认图像池补充。
   * 
   * **Validates: Requirements 7.2, 7.5**
   */
  it('Property 8: should always generate exactly 4 image options with 1 correct answer', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          wordId: fc.uuid(),
          word: fc.string({ minLength: 1, maxLength: 50 }),
          translation: fc.string({ minLength: 1, maxLength: 100 }),
          correctImageUrl: fc.webUrl(),
          userId: fc.uuid(),
          userImageCount: fc.integer({ min: 0, max: 10 }),
        }),
        async ({ wordId, word, translation, correctImageUrl, userId, userImageCount }) => {
          // Setup: Mock database to return varying numbers of user images
          const userImages = Array.from({ length: userImageCount }, (_, i) => ({
            image_url: `https://example.com/image${i}.jpg`,
            english_word: `word${i}`,
          }));

          mockPool.query = jest.fn()
            .mockResolvedValueOnce({ rows: userImages }) // First call: get user images
            .mockResolvedValueOnce({ rows: [] }); // Second call: get exclude words

          // Mock image service to provide default images if needed
          const defaultImagesNeeded = Math.max(0, 3 - userImageCount);
          if (defaultImagesNeeded > 0) {
            const defaultImages = Array.from(
              { length: defaultImagesNeeded },
              (_, i) => `https://example.com/default${i}.jpg`
            );
            mockImageService.getDistractorImagesAsync = jest
              .fn()
              .mockResolvedValue(defaultImages);
          }

          // Execute: Generate question
          const question = await quizModule.generateQuestionAsync(
            {
              id: wordId,
              word,
              translation,
              imageUrl: correctImageUrl,
            },
            userId
          );

          // Verify: Exactly 4 options (Requirement 7.2)
          expect(question.options).toHaveLength(4);

          // Verify: Exactly 1 correct answer
          const correctOptions = question.options.filter((opt) => opt.isCorrect);
          expect(correctOptions).toHaveLength(1);

          // Verify: Correct answer is the original image
          expect(correctOptions[0].imageUrl).toBe(correctImageUrl);

          // Verify: 3 distractor options
          const distractorOptions = question.options.filter((opt) => !opt.isCorrect);
          expect(distractorOptions).toHaveLength(3);

          // Verify: All image URLs are unique
          const imageUrls = question.options.map((opt) => opt.imageUrl);
          const uniqueUrls = new Set(imageUrls);
          expect(uniqueUrls.size).toBe(4);

          // Verify: Question metadata is correct
          expect(question.questionId).toBeTruthy();
          expect(question.word).toBe(word);
          expect(question.translation).toBe(translation);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: children-english-learning-platform, Property 9:
   * 对于任意生成的测验题目，4个图像选项中必定包含正确答案，
   * 且正确答案的位置应该是随机的（多次生成同一单词的测验，
   * 正确答案位置应该变化）。
   * 
   * **Validates: Requirements 7.3**
   */
  it('Property 9: correct answer must exist and position should be randomized', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          wordId: fc.uuid(),
          word: fc.string({ minLength: 1, maxLength: 50 }),
          translation: fc.string({ minLength: 1, maxLength: 100 }),
          correctImageUrl: fc.webUrl(),
          userId: fc.uuid(),
        }),
        async ({ wordId, word, translation, correctImageUrl, userId }) => {
          // Setup: Mock database to return 3 distractor images
          const distractorImages = [
            { image_url: 'https://example.com/dist1.jpg', english_word: 'word1' },
            { image_url: 'https://example.com/dist2.jpg', english_word: 'word2' },
            { image_url: 'https://example.com/dist3.jpg', english_word: 'word3' },
          ];

          mockPool.query = jest.fn()
            .mockResolvedValueOnce({ rows: distractorImages })
            .mockResolvedValueOnce({ rows: [] });

          // Execute: Generate question multiple times
          const positions: number[] = [];
          const iterations = 10;

          for (let i = 0; i < iterations; i++) {
            mockPool.query = jest.fn()
              .mockResolvedValueOnce({ rows: distractorImages })
              .mockResolvedValueOnce({ rows: [] });

            const question = await quizModule.generateQuestionAsync(
              {
                id: wordId,
                word,
                translation,
                imageUrl: correctImageUrl,
              },
              userId
            );

            // Verify: Correct answer exists
            const correctIndex = question.options.findIndex(
              (opt) => opt.imageUrl === correctImageUrl && opt.isCorrect
            );
            expect(correctIndex).toBeGreaterThanOrEqual(0);
            expect(correctIndex).toBeLessThan(4);

            positions.push(correctIndex);
          }

          // Verify: Position varies (not always in the same position)
          // With 10 iterations and 4 positions, we expect some variation
          // Statistical test: at least 2 different positions should appear
          const uniquePositions = new Set(positions);
          expect(uniquePositions.size).toBeGreaterThanOrEqual(2);
        }
      ),
      { numRuns: 20 } // Fewer runs since we do 10 iterations per property
    );
  });

  /**
   * Feature: children-english-learning-platform, Property 10:
   * 对于任意测验题目和用户选择，当且仅当用户选择的图像URL
   * 与正确答案的图像URL完全匹配时，验证结果应该为"正确"。
   * 
   * **Validates: Requirements 8.1**
   */
  it('Property 10: answer validation should be correct if and only if URLs match exactly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          wordId: fc.uuid(),
          word: fc.string({ minLength: 1, maxLength: 50 }),
          translation: fc.string({ minLength: 1, maxLength: 100 }),
          correctImageUrl: fc.webUrl(),
          userId: fc.uuid(),
          selectedImageUrl: fc.webUrl(),
        }),
        async ({ wordId, word, translation, correctImageUrl, userId, selectedImageUrl }) => {
          // Setup: Mock database to return distractor images
          const distractorImages = [
            { image_url: 'https://example.com/dist1.jpg', english_word: 'word1' },
            { image_url: 'https://example.com/dist2.jpg', english_word: 'word2' },
            { image_url: 'https://example.com/dist3.jpg', english_word: 'word3' },
          ];

          mockPool.query = jest.fn()
            .mockResolvedValueOnce({ rows: distractorImages })
            .mockResolvedValueOnce({ rows: [] });

          // Execute: Generate question
          const question = await quizModule.generateQuestionAsync(
            {
              id: wordId,
              word,
              translation,
              imageUrl: correctImageUrl,
            },
            userId
          );

          // Execute: Validate answer
          const result = quizModule.validateAnswer(question.questionId, selectedImageUrl);

          // Verify: Result is correct if and only if URLs match exactly (Requirement 8.1)
          const shouldBeCorrect = selectedImageUrl === correctImageUrl;
          expect(result.correct).toBe(shouldBeCorrect);

          // Verify: Correct image URL is always returned
          expect(result.correctImageUrl).toBe(correctImageUrl);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Verify that distractor images are different from correct answer
   */
  it('Property: distractor images should never be the same as correct answer', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          wordId: fc.uuid(),
          word: fc.string({ minLength: 1, maxLength: 50 }),
          translation: fc.string({ minLength: 1, maxLength: 100 }),
          correctImageUrl: fc.webUrl(),
          userId: fc.uuid(),
        }),
        async ({ wordId, word, translation, correctImageUrl, userId }) => {
          // Setup: Mock database to return distractor images (different from correct)
          const distractorImages = [
            { image_url: 'https://example.com/dist1.jpg', english_word: 'word1' },
            { image_url: 'https://example.com/dist2.jpg', english_word: 'word2' },
            { image_url: 'https://example.com/dist3.jpg', english_word: 'word3' },
          ];

          mockPool.query = jest.fn()
            .mockResolvedValueOnce({ rows: distractorImages })
            .mockResolvedValueOnce({ rows: [] });

          // Execute: Generate question
          const question = await quizModule.generateQuestionAsync(
            {
              id: wordId,
              word,
              translation,
              imageUrl: correctImageUrl,
            },
            userId
          );

          // Verify: Distractor images are different from correct answer
          const distractorOptions = question.options.filter((opt) => !opt.isCorrect);
          distractorOptions.forEach((distractor) => {
            expect(distractor.imageUrl).not.toBe(correctImageUrl);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
