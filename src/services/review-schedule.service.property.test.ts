import fc from 'fast-check';
import { ReviewScheduleService } from './review-schedule.service';
import { ValidationError } from '../utils/errors';

describe('ReviewScheduleService - Property-Based Tests', () => {
  let service: ReviewScheduleService;

  beforeEach(() => {
    service = new ReviewScheduleService();
  });

  describe('Property 4: Initial Review Schedule Generation', () => {
    // Feature: children-english-learning-platform, Property 4: 初始复习计划生成
    // 对于任意学习日期，系统应该生成恰好5个复习日期，
    // 分别在学习日期后的1天、3天、7天、15天和30天
    // **Validates: Requirements 4.3, 5.1, 5.2**

    it('should generate exactly 5 review dates for any learning date', () => {
      fc.assert(
        fc.property(
          fc.date({
            min: new Date('1970-01-01'),
            max: new Date('2100-12-31'),
          }),
          (learnedDate) => {
            const schedule = service.calculateInitialSchedule(learnedDate);

            // Property: Must generate exactly 5 review dates
            expect(schedule).toHaveLength(5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate review dates at correct intervals (1, 3, 7, 15, 30 days) for any learning date', () => {
      fc.assert(
        fc.property(
          fc.date({
            min: new Date('1970-01-01'),
            max: new Date('2100-12-31'),
          }),
          (learnedDate) => {
            const schedule = service.calculateInitialSchedule(learnedDate);
            const expectedIntervals = [1, 3, 7, 15, 30];

            // Property: Each review date must be at the correct interval from learned date
            schedule.forEach((reviewDate, index) => {
              // Use date-only comparison to avoid DST issues
              const learnedDateOnly = new Date(learnedDate.getFullYear(), learnedDate.getMonth(), learnedDate.getDate());
              const reviewDateOnly = new Date(reviewDate.getFullYear(), reviewDate.getMonth(), reviewDate.getDate());
              const daysDiff = Math.round(
                (reviewDateOnly.getTime() - learnedDateOnly.getTime()) / (1000 * 60 * 60 * 24)
              );
              expect(daysDiff).toBe(expectedIntervals[index]);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate review dates in ascending chronological order for any learning date', () => {
      fc.assert(
        fc.property(
          fc.date({
            min: new Date('1970-01-01'),
            max: new Date('2100-12-31'),
          }),
          (learnedDate) => {
            const schedule = service.calculateInitialSchedule(learnedDate);

            // Property: Review dates must be in ascending order
            for (let i = 1; i < schedule.length; i++) {
              expect(schedule[i].getTime()).toBeGreaterThan(schedule[i - 1].getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate all review dates after the learning date for any learning date', () => {
      fc.assert(
        fc.property(
          fc.date({
            min: new Date('1970-01-01'),
            max: new Date('2100-12-31'),
          }),
          (learnedDate) => {
            const schedule = service.calculateInitialSchedule(learnedDate);

            // Property: All review dates must be after the learned date
            schedule.forEach((reviewDate) => {
              expect(reviewDate.getTime()).toBeGreaterThan(learnedDate.getTime());
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case dates correctly (leap years, month boundaries, year boundaries)', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Leap year dates
            fc.constantFrom(
              new Date('2024-02-28'),
              new Date('2024-02-29'),
              new Date('2020-02-29')
            ),
            // Month boundaries
            fc.constantFrom(
              new Date('2024-01-31'),
              new Date('2024-03-31'),
              new Date('2024-04-30'),
              new Date('2024-12-31')
            ),
            // Year boundaries
            fc.constantFrom(new Date('2023-12-31'), new Date('2024-01-01')),
            // Random dates
            fc.date({
              min: new Date('1970-01-01'),
              max: new Date('2100-12-31'),
            })
          ),
          (learnedDate) => {
            const schedule = service.calculateInitialSchedule(learnedDate);
            const expectedIntervals = [1, 3, 7, 15, 30];

            // Property: Must still generate exactly 5 dates with correct intervals
            expect(schedule).toHaveLength(5);

            schedule.forEach((reviewDate, index) => {
              const daysDiff = Math.floor(
                (reviewDate.getTime() - learnedDate.getTime()) / (1000 * 60 * 60 * 24)
              );
              expect(daysDiff).toBe(expectedIntervals[index]);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate consistent results for the same learning date', () => {
      fc.assert(
        fc.property(
          fc.date({
            min: new Date('1970-01-01'),
            max: new Date('2100-12-31'),
          }),
          (learnedDate) => {
            // Property: Multiple calls with same date should produce identical results
            const schedule1 = service.calculateInitialSchedule(learnedDate);
            const schedule2 = service.calculateInitialSchedule(learnedDate);

            expect(schedule1).toHaveLength(schedule2.length);
            schedule1.forEach((date, index) => {
              expect(date.getTime()).toBe(schedule2[index].getTime());
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid dates with ValidationError', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(new Date('invalid')),
            fc.constant({} as Date),
            fc.constant('2024-01-01' as any),
            fc.constant(1234567890 as any)
          ),
          (invalidDate) => {
            // Property: Invalid dates must throw ValidationError
            expect(() => service.calculateInitialSchedule(invalidDate as any)).toThrow(
              ValidationError
            );
            expect(() => service.calculateInitialSchedule(invalidDate as any)).toThrow(
              '学习日期无效'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate valid Date objects for any learning date', () => {
      fc.assert(
        fc.property(
          fc.date({
            min: new Date('1970-01-01'),
            max: new Date('2100-12-31'),
          }),
          (learnedDate) => {
            const schedule = service.calculateInitialSchedule(learnedDate);

            // Property: All returned values must be valid Date objects
            schedule.forEach((reviewDate) => {
              expect(reviewDate).toBeInstanceOf(Date);
              expect(isNaN(reviewDate.getTime())).toBe(false);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain correct day-of-week relationships across intervals', () => {
      fc.assert(
        fc.property(
          fc.date({
            min: new Date('1970-01-01'),
            max: new Date('2100-12-31'),
          }),
          (learnedDate) => {
            const schedule = service.calculateInitialSchedule(learnedDate);
            const expectedIntervals = [1, 3, 7, 15, 30];

            // Property: Day of week should shift correctly based on interval
            schedule.forEach((reviewDate, index) => {
              const expectedDayOfWeek =
                (learnedDate.getDay() + expectedIntervals[index]) % 7;
              expect(reviewDate.getDay()).toBe(expectedDayOfWeek);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle dates near epoch and far future correctly', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Near epoch
            fc.date({
              min: new Date('1970-01-01'),
              max: new Date('1970-12-31'),
            }),
            // Far future
            fc.date({
              min: new Date('2099-01-01'),
              max: new Date('2100-12-31'),
            }),
            // Normal range
            fc.date({
              min: new Date('2000-01-01'),
              max: new Date('2050-12-31'),
            })
          ),
          (learnedDate) => {
            const schedule = service.calculateInitialSchedule(learnedDate);
            const expectedIntervals = [1, 3, 7, 15, 30];

            // Property: Must work correctly regardless of date range
            expect(schedule).toHaveLength(5);

            schedule.forEach((reviewDate, index) => {
              const daysDiff = Math.floor(
                (reviewDate.getTime() - learnedDate.getTime()) / (1000 * 60 * 60 * 24)
              );
              expect(daysDiff).toBe(expectedIntervals[index]);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Review Interval Dynamic Adjustment', () => {
    // Feature: children-english-learning-platform, Property 5: 复习间隔动态调整
    // 对于任意当前复习间隔和答题结果：
    // - 如果回答正确，下次复习间隔应该增加到序列中的下一个值（1→3→7→15→30→60→90天）
    // - 如果回答错误，下次复习应该安排在1天后
    // **Validates: Requirements 5.5, 9.3, 9.4**

    it('should increase interval to next value in sequence when answer is correct', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(1, 3, 7, 15, 30, 60, 90), // Valid intervals from the sequence
          (currentInterval) => {
            const nextReviewDate = service.calculateNextReview(currentInterval, true);
            const now = new Date();

            // Calculate expected next interval
            const intervals = [1, 3, 7, 15, 30, 60, 90];
            const currentIndex = intervals.indexOf(currentInterval);
            const expectedNextInterval =
              currentIndex === intervals.length - 1
                ? intervals[intervals.length - 1] // Stay at max
                : intervals[currentIndex + 1]; // Move to next

            // Calculate expected date
            const expectedDate = new Date(now);
            expectedDate.setDate(expectedDate.getDate() + expectedNextInterval);

            // Verify the date is correct (within same day)
            const daysDiff = Math.floor(
              (nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            expect(daysDiff).toBe(expectedNextInterval);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reset interval to 1 day when answer is incorrect', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(1, 3, 7, 15, 30, 60, 90), // Any valid interval
          (currentInterval) => {
            const nextReviewDate = service.calculateNextReview(currentInterval, false);
            const now = new Date();

            // Property: Incorrect answer always resets to 1 day
            const daysDiff = Math.floor(
              (nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            expect(daysDiff).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle arbitrary current intervals by finding next larger interval when correct', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // Arbitrary positive intervals
          (currentInterval) => {
            const now = new Date();
            const nextReviewDate = service.calculateNextReview(currentInterval, true);

            const intervals = [1, 3, 7, 15, 30, 60, 90];

            // Find expected next interval
            let expectedNextInterval = intervals[intervals.length - 1]; // Default to max

            if (intervals.includes(currentInterval)) {
              // If in sequence, move to next
              const index = intervals.indexOf(currentInterval);
              expectedNextInterval =
                index === intervals.length - 1
                  ? intervals[intervals.length - 1]
                  : intervals[index + 1];
            } else {
              // If not in sequence, find next larger interval
              for (const interval of intervals) {
                if (interval > currentInterval) {
                  expectedNextInterval = interval;
                  break;
                }
              }
            }

            const daysDiff = Math.round(
              (nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            expect(daysDiff).toBe(expectedNextInterval);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always reset to 1 day for incorrect answer regardless of current interval', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }), // Any positive interval
          (currentInterval) => {
            const nextReviewDate = service.calculateNextReview(currentInterval, false);
            const now = new Date();

            // Property: Incorrect answer ALWAYS resets to 1 day
            const daysDiff = Math.floor(
              (nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            expect(daysDiff).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return valid Date objects for any interval and correctness combination', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.boolean(),
          (currentInterval, correct) => {
            const nextReviewDate = service.calculateNextReview(currentInterval, correct);

            // Property: Must return valid Date object
            expect(nextReviewDate).toBeInstanceOf(Date);
            expect(isNaN(nextReviewDate.getTime())).toBe(false);

            // Property: Next review date must be in the future
            const now = new Date();
            expect(nextReviewDate.getTime()).toBeGreaterThan(now.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain max interval of 90 days when at the end of sequence', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(90, 100, 200, 365), // Intervals at or beyond max
          (currentInterval) => {
            const now = new Date();
            const nextReviewDate = service.calculateNextReview(currentInterval, true);

            // Property: Should not exceed 90 days (max interval)
            const daysDiff = Math.round(
              (nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            expect(daysDiff).toBe(90);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce consistent results for the same inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.boolean(),
          (currentInterval, correct) => {
            // Property: Multiple calls with same inputs should produce same interval
            const result1 = service.calculateNextReview(currentInterval, correct);
            const result2 = service.calculateNextReview(currentInterval, correct);

            const daysDiff1 = Math.floor(
              (result1.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );
            const daysDiff2 = Math.floor(
              (result2.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );

            expect(daysDiff1).toBe(daysDiff2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid current intervals with ValidationError', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(0),
            fc.constant(-1),
            fc.integer({ min: -100, max: 0 }),
            fc.constant(null),
            fc.constant(undefined),
            fc.constant('5' as any),
            fc.constant({} as any)
          ),
          fc.boolean(),
          (invalidInterval, correct) => {
            // Property: Invalid intervals must throw ValidationError
            expect(() => service.calculateNextReview(invalidInterval as any, correct)).toThrow(
              ValidationError
            );
            expect(() => service.calculateNextReview(invalidInterval as any, correct)).toThrow(
              '当前间隔必须是正数'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid correctness values with ValidationError', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(1, 3, 7, 15, 30),
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant('true' as any),
            fc.constant(1 as any),
            fc.constant(0 as any),
            fc.constant({} as any)
          ),
          (currentInterval, invalidCorrect) => {
            // Property: Invalid correctness values must throw ValidationError
            expect(() =>
              service.calculateNextReview(currentInterval, invalidCorrect as any)
            ).toThrow(ValidationError);
            expect(() =>
              service.calculateNextReview(currentInterval, invalidCorrect as any)
            ).toThrow('正确性标志必须是布尔值');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case: transition from each interval in sequence correctly', () => {
      const intervals = [1, 3, 7, 15, 30, 60, 90];
      const expectedTransitions = [3, 7, 15, 30, 60, 90, 90]; // Next interval for each

      intervals.forEach((currentInterval, index) => {
        const nextReviewDate = service.calculateNextReview(currentInterval, true);
        const now = new Date();

        const daysDiff = Math.floor(
          (nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        expect(daysDiff).toBe(expectedTransitions[index]);
      });
    });

    it('should calculate next review date relative to current time, not learned date', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(1, 3, 7, 15, 30),
          fc.boolean(),
          (currentInterval, correct) => {
            const beforeCall = new Date();
            const nextReviewDate = service.calculateNextReview(currentInterval, correct);
            const afterCall = new Date();

            // Property: Next review should be calculated from "now", not some past date
            const expectedInterval = correct
              ? currentInterval === 1
                ? 3
                : currentInterval === 3
                ? 7
                : currentInterval === 7
                ? 15
                : currentInterval === 15
                ? 30
                : 60
              : 1;

            const minExpectedDate = new Date(beforeCall);
            minExpectedDate.setDate(minExpectedDate.getDate() + expectedInterval);

            const maxExpectedDate = new Date(afterCall);
            maxExpectedDate.setDate(maxExpectedDate.getDate() + expectedInterval);

            // Next review should be within the expected range
            expect(nextReviewDate.getTime()).toBeGreaterThanOrEqual(
              minExpectedDate.getTime() - 1000
            ); // Allow 1s tolerance
            expect(nextReviewDate.getTime()).toBeLessThanOrEqual(
              maxExpectedDate.getTime() + 1000
            ); // Allow 1s tolerance
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
