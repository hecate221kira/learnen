import fc from 'fast-check';
import { Request, Response } from 'express';
import { errorHandler } from './errorHandler';
import { 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError, 
  ConflictError, 
  ExternalServiceError, 
  DatabaseError, 
  TimeoutError 
} from '../utils/errors';

/**
 * Property-Based Tests for Error Message Localization
 * Feature: children-english-learning-platform, Property 16: 错误消息本地化
 * **Validates: Requirements 14.1, 14.5**
 * 
 * Tests that arbitrary error types return Chinese messages without technical details
 */
describe('Error Message Localization - Property Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    
    mockReq = {
      path: '/test',
      method: 'GET',
      headers: {},
      query: {},
      body: {},
      ip: '127.0.0.1',
      get: jest.fn(),
    };
    
    mockRes = {
      status: statusSpy,
      json: jsonSpy,
    };
  });

  /**
   * Property 16: 错误消息本地化
   * 对于任意错误类型，系统返回给用户的错误消息应该是中文，且不应包含技术细节
   */
  it('should return Chinese error messages for all AppError types', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new ValidationError('测试验证错误')),
          fc.constant(new AuthenticationError('请先登录')),
          fc.constant(new AuthorizationError('没有权限访问此资源')),
          fc.constant(new NotFoundError('资源不存在')),
          fc.constant(new ConflictError('数据冲突')),
          fc.constant(new ExternalServiceError('外部服务错误')),
          fc.constant(new DatabaseError('数据库错误')),
          fc.constant(new TimeoutError('请求超时')),
        ),
        (error) => {
          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(jsonSpy).toHaveBeenCalled();
          const response = jsonSpy.mock.calls[0][0];

          // Should have Chinese error message
          expect(response.error).toBeTruthy();
          expect(typeof response.error).toBe('string');
          
          // Should contain Chinese characters
          expect(/[\u4e00-\u9fa5]/.test(response.error)).toBe(true);
          
          // Should not contain technical details
          expect(response.error).not.toContain('Error:');
          expect(response.error).not.toContain('at ');
          expect(response.error).not.toContain('.ts:');
          expect(response.error).not.toContain('Stack trace');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not expose stack traces in error responses', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 100 }),
        (errorMessage) => {
          const error = new Error(errorMessage);
          error.stack = 'Error: test\n    at Object.<anonymous> (/path/to/file.ts:10:15)';

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(jsonSpy).toHaveBeenCalled();
          const response = jsonSpy.mock.calls[0][0];

          // Should not contain stack trace
          expect(response.stack).toBeUndefined();
          expect(response.error).not.toContain('at Object');
          expect(response.error).not.toContain('.ts:');
          expect(response.error).not.toContain('Error:');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return generic Chinese message for unknown errors', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (errorMessage) => {
          const error = new Error(errorMessage);

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(jsonSpy).toHaveBeenCalled();
          const response = jsonSpy.mock.calls[0][0];

          // Should return generic Chinese error message
          expect(response.error).toBe('系统错误，请稍后重试');
          
          // Should contain Chinese characters
          expect(/[\u4e00-\u9fa5]/.test(response.error)).toBe(true);
          
          // Should not expose original error message
          expect(response.error).not.toBe(errorMessage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not expose SQL queries in error messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'SELECT * FROM users WHERE id = 1',
          'INSERT INTO words VALUES (1, 2, 3)',
          'UPDATE review_schedules SET completed = true',
          'DELETE FROM image_cache WHERE id = 1',
        ),
        (sqlQuery) => {
          const error = new DatabaseError('数据库操作失败');
          (error as any).query = sqlQuery; // Simulate SQL query in error

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(jsonSpy).toHaveBeenCalled();
          const response = jsonSpy.mock.calls[0][0];

          // Should not contain SQL query
          expect(response.error).not.toContain('SELECT');
          expect(response.error).not.toContain('INSERT');
          expect(response.error).not.toContain('UPDATE');
          expect(response.error).not.toContain('DELETE');
          expect(response.query).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not expose internal variable names in error messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'passwordHash',
          'apiKey',
          'databaseConnection',
          'secretToken',
          'userId',
        ),
        (variableName) => {
          const error = new Error(`Variable ${variableName} is undefined`);

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(jsonSpy).toHaveBeenCalled();
          const response = jsonSpy.mock.calls[0][0];

          // Should not contain variable names
          expect(response.error).not.toContain(variableName);
          expect(response.error).not.toContain('undefined');
          expect(response.error).not.toContain('Variable');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include error code for all error types', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new ValidationError('验证错误')),
          fc.constant(new AuthenticationError()),
          fc.constant(new DatabaseError()),
          fc.constant(new ExternalServiceError('服务错误')),
          fc.constant(new Error('未知错误')),
        ),
        (error) => {
          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(jsonSpy).toHaveBeenCalled();
          const response = jsonSpy.mock.calls[0][0];

          // Should have error code
          expect(response.code).toBeTruthy();
          expect(typeof response.code).toBe('string');
          
          // Error code should be uppercase with underscores
          expect(/^[A-Z_]+$/.test(response.code)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include timestamp in ISO format', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new ValidationError('错误')),
          fc.constant(new Error('错误')),
        ),
        (error) => {
          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(jsonSpy).toHaveBeenCalled();
          const response = jsonSpy.mock.calls[0][0];

          // Should have timestamp
          expect(response.timestamp).toBeTruthy();
          
          // Should be valid ISO 8601 format
          expect(() => new Date(response.timestamp)).not.toThrow();
          expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include request ID for tracking', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new ValidationError('错误')),
          fc.constant(new Error('错误')),
        ),
        (error) => {
          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(jsonSpy).toHaveBeenCalled();
          const response = jsonSpy.mock.calls[0][0];

          // Should have request ID
          expect(response.requestId).toBeTruthy();
          expect(typeof response.requestId).toBe('string');
          
          // Request ID should start with 'req-'
          expect(response.requestId).toMatch(/^req-/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not include details field in production errors', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new ValidationError('错误')),
          fc.constant(new DatabaseError()),
          fc.constant(new Error('错误')),
        ),
        (error) => {
          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(jsonSpy).toHaveBeenCalled();
          const response = jsonSpy.mock.calls[0][0];

          // Should not have details field (no technical information)
          expect(response.details).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
