import { ReviewScheduleService } from './review-schedule.service';
import { pool } from '../config/database';
import { ValidationError, DatabaseError } from '../utils/errors';

// Mock the database pool
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe('ReviewScheduleService', () => {
  let service: ReviewScheduleService;
  const mockQuery = pool.query as jest.Mock;

  beforeEach(() => {
    service = new ReviewScheduleService();
    jest.clearAllMocks();
  });

  describe('calculateInitialSchedule', () => {
    it('should generate 5 review dates with correct intervals', () => {
      const learnedDate = new Date('2024-01-01');
      const schedule = service.calculateInitialSchedule(learnedDate);

      expect(schedule).toHaveLength(5);

      // Verify intervals: 1, 3, 7, 15, 30 days
      expect(schedule[0]).toEqual(new Date('2024-01-02')); // +1 day
      expect(schedule[1]).toEqual(new Date('2024-01-04')); // +3 days
      expect(schedule[2]).toEqual(new Date('2024-01-08')); // +7 days
      expect(schedule[3]).toEqual(new Date('2024-01-16')); // +15 days
      expect(schedule[4]).toEqual(new Date('2024-01-31')); // +30 days
    });

    it('should handle leap year dates correctly', () => {
      const learnedDate = new Date('2024-02-28');
      const schedule = service.calculateInitialSchedule(learnedDate);

      expect(schedule).toHaveLength(5);
      expect(schedule[0]).toEqual(new Date('2024-02-29')); // Leap year
    });

    it('should throw ValidationError for invalid date', () => {
      expect(() => service.calculateInitialSchedule(null as any)).toThrow(ValidationError);
      expect(() => service.calculateInitialSchedule(undefined as any)).toThrow(ValidationError);
      expect(() => service.calculateInitialSchedule(new Date('invalid'))).toThrow(
        ValidationError
      );
    });
  });

  describe('calculateNextReview', () => {
    it('should move to next interval when answer is correct', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      jest.useFakeTimers().setSystemTime(now);

      // Current interval: 1 day, correct answer -> next interval: 3 days
      const nextReview = service.calculateNextReview(1, true);
      expect(nextReview).toEqual(new Date('2024-01-18T10:00:00Z'));

      jest.useRealTimers();
    });

    it('should progress through all intervals correctly', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      jest.useFakeTimers().setSystemTime(now);

      // Test progression: 1 -> 3 -> 7 -> 15 -> 30 -> 60 -> 90
      expect(service.calculateNextReview(1, true)).toEqual(new Date('2024-01-18T10:00:00Z')); // +3
      expect(service.calculateNextReview(3, true)).toEqual(new Date('2024-01-22T10:00:00Z')); // +7
      expect(service.calculateNextReview(7, true)).toEqual(new Date('2024-01-30T10:00:00Z')); // +15
      expect(service.calculateNextReview(15, true)).toEqual(new Date('2024-02-14T10:00:00Z')); // +30
      expect(service.calculateNextReview(30, true)).toEqual(new Date('2024-03-15T10:00:00Z')); // +60
      expect(service.calculateNextReview(60, true)).toEqual(new Date('2024-04-14T10:00:00Z')); // +90
      expect(service.calculateNextReview(90, true)).toEqual(new Date('2024-04-14T10:00:00Z')); // stays at 90

      jest.useRealTimers();
    });

    it('should reset to 1 day when answer is incorrect', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      jest.useFakeTimers().setSystemTime(now);

      // Any interval with incorrect answer -> 1 day
      expect(service.calculateNextReview(7, false)).toEqual(new Date('2024-01-16T10:00:00Z'));
      expect(service.calculateNextReview(30, false)).toEqual(new Date('2024-01-16T10:00:00Z'));
      expect(service.calculateNextReview(90, false)).toEqual(new Date('2024-01-16T10:00:00Z'));

      jest.useRealTimers();
    });

    it('should throw ValidationError for invalid interval', () => {
      expect(() => service.calculateNextReview(0, true)).toThrow(ValidationError);
      expect(() => service.calculateNextReview(-1, true)).toThrow(ValidationError);
      expect(() => service.calculateNextReview(null as any, true)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid correct flag', () => {
      expect(() => service.calculateNextReview(1, null as any)).toThrow(ValidationError);
      expect(() => service.calculateNextReview(1, undefined as any)).toThrow(ValidationError);
    });
  });

  describe('createInitialSchedules', () => {
    it('should create 5 review schedules in database', async () => {
      const wordId = 'word-123';
      const userId = 'user-456';
      const learnedDate = new Date('2024-01-01');

      const mockRows = [
        {
          id: 'schedule-1',
          word_id: wordId,
          user_id: userId,
          due_date: new Date('2024-01-02'),
          interval_days: 1,
          completed: false,
          completed_at: null,
        },
        {
          id: 'schedule-2',
          word_id: wordId,
          user_id: userId,
          due_date: new Date('2024-01-04'),
          interval_days: 3,
          completed: false,
          completed_at: null,
        },
        {
          id: 'schedule-3',
          word_id: wordId,
          user_id: userId,
          due_date: new Date('2024-01-08'),
          interval_days: 7,
          completed: false,
          completed_at: null,
        },
        {
          id: 'schedule-4',
          word_id: wordId,
          user_id: userId,
          due_date: new Date('2024-01-16'),
          interval_days: 15,
          completed: false,
          completed_at: null,
        },
        {
          id: 'schedule-5',
          word_id: wordId,
          user_id: userId,
          due_date: new Date('2024-01-31'),
          interval_days: 30,
          completed: false,
          completed_at: null,
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows } as any);

      const result = await service.createInitialSchedules(wordId, userId, learnedDate);

      expect(result).toHaveLength(5);
      expect(result[0].intervalDays).toBe(1);
      expect(result[1].intervalDays).toBe(3);
      expect(result[2].intervalDays).toBe(7);
      expect(result[3].intervalDays).toBe(15);
      expect(result[4].intervalDays).toBe(30);

      // Verify batch insert was called
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[0]).toContain('INSERT INTO review_schedules');
      expect(queryCall[1]).toHaveLength(25); // 5 schedules * 5 values each
    });

    it('should throw ValidationError for empty wordId', async () => {
      await expect(service.createInitialSchedules('', 'user-123')).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for empty userId', async () => {
      await expect(service.createInitialSchedules('word-123', '')).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw DatabaseError for foreign key violation', async () => {
      mockQuery.mockRejectedValue({ code: '23503' });

      await expect(service.createInitialSchedules('word-123', 'user-456')).rejects.toThrow(
        DatabaseError
      );
    });

    it('should throw DatabaseError for other database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Connection failed'));

      await expect(service.createInitialSchedules('word-123', 'user-456')).rejects.toThrow(
        DatabaseError
      );
    });
  });

  describe('createNextSchedule', () => {
    it('should create next schedule with increased interval for correct answer', async () => {
      const wordId = 'word-123';
      const userId = 'user-456';
      const currentInterval = 7;

      const now = new Date('2024-01-15T10:00:00Z');
      jest.useFakeTimers().setSystemTime(now);

      const mockRow = {
        id: 'schedule-new',
        word_id: wordId,
        user_id: userId,
        due_date: new Date('2024-01-30'),
        interval_days: 15,
        completed: false,
        completed_at: null,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow] } as any);

      const result = await service.createNextSchedule(wordId, userId, currentInterval, true);

      expect(result.intervalDays).toBe(15);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO review_schedules'),
        expect.arrayContaining([wordId, userId, '2024-01-30', 15, false])
      );

      jest.useRealTimers();
    });

    it('should create next schedule with 1 day interval for incorrect answer', async () => {
      const wordId = 'word-123';
      const userId = 'user-456';
      const currentInterval = 30;

      const now = new Date('2024-01-15T10:00:00Z');
      jest.useFakeTimers().setSystemTime(now);

      const mockRow = {
        id: 'schedule-new',
        word_id: wordId,
        user_id: userId,
        due_date: new Date('2024-01-16'),
        interval_days: 1,
        completed: false,
        completed_at: null,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow] } as any);

      const result = await service.createNextSchedule(wordId, userId, currentInterval, false);

      expect(result.intervalDays).toBe(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO review_schedules'),
        expect.arrayContaining([wordId, userId, '2024-01-16', 1, false])
      );

      jest.useRealTimers();
    });

    it('should throw ValidationError for empty wordId', async () => {
      await expect(service.createNextSchedule('', 'user-123', 1, true)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for empty userId', async () => {
      await expect(service.createNextSchedule('word-123', '', 1, true)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw DatabaseError when insert fails', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      await expect(service.createNextSchedule('word-123', 'user-456', 1, true)).rejects.toThrow(
        DatabaseError
      );
    });
  });

  describe('markScheduleCompleted', () => {
    it('should mark schedule as completed', async () => {
      const scheduleId = 'schedule-123';

      const mockRow = {
        id: scheduleId,
        word_id: 'word-123',
        user_id: 'user-456',
        due_date: new Date('2024-01-15'),
        interval_days: 7,
        completed: true,
        completed_at: new Date('2024-01-15T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow] } as any);

      const result = await service.markScheduleCompleted(scheduleId);

      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeTruthy();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE review_schedules'),
        [scheduleId]
      );
    });

    it('should throw ValidationError for empty scheduleId', async () => {
      await expect(service.markScheduleCompleted('')).rejects.toThrow(ValidationError);
    });

    it('should throw DatabaseError when schedule not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      await expect(service.markScheduleCompleted('schedule-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('getDueSchedules', () => {
    it('should return due schedules ordered by due date', async () => {
      const userId = 'user-123';

      const mockRows = [
        {
          id: 'schedule-1',
          word_id: 'word-1',
          user_id: userId,
          due_date: new Date('2024-01-10'),
          interval_days: 7,
          completed: false,
          completed_at: null,
        },
        {
          id: 'schedule-2',
          word_id: 'word-2',
          user_id: userId,
          due_date: new Date('2024-01-12'),
          interval_days: 3,
          completed: false,
          completed_at: null,
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows } as any);

      const result = await service.getDueSchedules(userId);

      expect(result).toHaveLength(2);
      expect(result[0].dueDate).toEqual(new Date('2024-01-10'));
      expect(result[1].dueDate).toEqual(new Date('2024-01-12'));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY due_date ASC'),
        [userId, 20]
      );
    });

    it('should respect limit parameter', async () => {
      const userId = 'user-123';
      const limit = 10;

      mockQuery.mockResolvedValue({ rows: [] } as any);

      await service.getDueSchedules(userId, limit);

      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [userId, limit]);
    });

    it('should return empty array when no due schedules', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      const result = await service.getDueSchedules('user-123');

      expect(result).toEqual([]);
    });

    it('should throw ValidationError for empty userId', async () => {
      await expect(service.getDueSchedules('')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid limit', async () => {
      await expect(service.getDueSchedules('user-123', 0)).rejects.toThrow(ValidationError);
      await expect(service.getDueSchedules('user-123', 21)).rejects.toThrow(ValidationError);
    });

    it('should throw DatabaseError on database failure', async () => {
      mockQuery.mockRejectedValue(new Error('Connection failed'));

      await expect(service.getDueSchedules('user-123')).rejects.toThrow(DatabaseError);
    });
  });
});
