import {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  DatabaseError,
} from './errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with correct properties', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 400, true);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('AppError');
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with correct defaults', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
    });
  });

  describe('AuthenticationError', () => {
    it('should create an authentication error with default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('请先登录');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
    });

    it('should create an authentication error with custom message', () => {
      const error = new AuthenticationError('Invalid token');

      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error', () => {
      const error = new NotFoundError('User not found');

      expect(error.message).toBe('User not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('DatabaseError', () => {
    it('should create a database error with retryable flag', () => {
      const error = new DatabaseError();

      expect(error.message).toBe('数据库操作失败，请重试');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
    });
  });
});
