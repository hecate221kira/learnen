import { Request, Response } from 'express';
import { errorHandler, requestIdMiddleware } from './errorHandler';
import { 
  ValidationError, 
  AuthenticationError, 
  DatabaseError, 
  ExternalServiceError 
} from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Unit Tests for Error Handling Middleware
 * Requirements: 14.1, 14.2, 14.4
 */
describe('Error Handler Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    mockNext = jest.fn();
    
    mockReq = {
      path: '/api/test',
      method: 'POST',
      headers: {},
      query: { test: 'value' },
      body: { data: 'test' },
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    };
    
    mockRes = {
      status: statusSpy,
      json: jsonSpy,
    };

    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  describe('Error Classification and Response', () => {
    it('should handle ValidationError with 400 status', () => {
      const error = new ValidationError('单词只能包含字母和空格');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '单词只能包含字母和空格',
          code: 'VALIDATION_ERROR',
          retryable: false,
        })
      );
    });

    it('should handle AuthenticationError with 401 status', () => {
      const error = new AuthenticationError('请先登录');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '请先登录',
          code: 'UNAUTHORIZED',
          retryable: false,
        })
      );
    });

    it('should handle DatabaseError with 500 status', () => {
      const error = new DatabaseError('数据库操作失败，请重试');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '数据库操作失败，请重试',
          code: 'DATABASE_ERROR',
          retryable: true,
        })
      );
    });

    it('should handle ExternalServiceError with 502 status', () => {
      const error = new ExternalServiceError('翻译服务暂时不可用，请稍后重试', true);

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(502);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '翻译服务暂时不可用，请稍后重试',
          code: 'EXTERNAL_SERVICE_ERROR',
          retryable: true,
        })
      );
    });

    it('should handle unknown errors with generic message', () => {
      const error = new Error('Internal server error with technical details');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '系统错误，请稍后重试',
          code: 'INTERNAL_ERROR',
          retryable: false,
        })
      );
    });
  });

  describe('Error Response Format', () => {
    it('should include all required fields in error response', () => {
      const error = new ValidationError('测试错误');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonSpy).toHaveBeenCalled();
      const response = jsonSpy.mock.calls[0][0];

      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('retryable');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('requestId');
    });

    it('should include valid ISO timestamp', () => {
      const error = new ValidationError('测试错误');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const response = jsonSpy.mock.calls[0][0];
      const timestamp = new Date(response.timestamp);

      expect(timestamp.toISOString()).toBe(response.timestamp);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should include request ID', () => {
      const error = new ValidationError('测试错误');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const response = jsonSpy.mock.calls[0][0];

      expect(response.requestId).toBeTruthy();
      expect(response.requestId).toMatch(/^req-/);
    });

    it('should use existing request ID from request object', () => {
      const existingRequestId = 'req-12345-abcde';
      (mockReq as any).requestId = existingRequestId;
      
      const error = new ValidationError('测试错误');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const response = jsonSpy.mock.calls[0][0];

      expect(response.requestId).toBe(existingRequestId);
    });
  });

  describe('Error Logging', () => {
    it('should log error with structured context', () => {
      const error = new ValidationError('测试错误');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(loggerErrorSpy).toHaveBeenCalled();
      const logContext = loggerErrorSpy.mock.calls[0][1];

      expect(logContext).toHaveProperty('requestId');
      expect(logContext).toHaveProperty('path');
      expect(logContext).toHaveProperty('method');
      expect(logContext).toHaveProperty('errorCategory');
      expect(logContext).toHaveProperty('errorCode');
      expect(logContext).toHaveProperty('errorMessage');
      expect(logContext).toHaveProperty('stack');
    });

    it('should log request details', () => {
      const error = new ValidationError('测试错误');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const logContext = loggerErrorSpy.mock.calls[0][1];

      expect(logContext.path).toBe('/api/test');
      expect(logContext.method).toBe('POST');
      expect(logContext.query).toEqual({ test: 'value' });
      expect(logContext.ip).toBe('127.0.0.1');
    });

    it('should sanitize sensitive data in logs', () => {
      mockReq.body = {
        username: 'testuser',
        password: 'secret123',
        token: 'abc123',
      };

      const error = new ValidationError('测试错误');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const logContext = loggerErrorSpy.mock.calls[0][1];

      expect(logContext.body.username).toBe('testuser');
      expect(logContext.body.password).toBe('[REDACTED]');
      expect(logContext.body.token).toBe('[REDACTED]');
    });

    it('should include error stack trace in logs', () => {
      const error = new Error('测试错误');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const logContext = loggerErrorSpy.mock.calls[0][1];

      expect(logContext.stack).toBeTruthy();
      expect(logContext.stack).toContain('Error');
    });
  });

  describe('Request ID Middleware', () => {
    it('should generate request ID if not present', () => {
      requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).requestId).toBeTruthy();
      expect((mockReq as any).requestId).toMatch(/^req-/);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use existing request ID from header', () => {
      const existingId = 'req-existing-12345';
      mockReq.headers = { 'x-request-id': existingId };

      requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).requestId).toBe(existingId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log incoming request', () => {
      const loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation();

      requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(loggerInfoSpy).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          requestId: expect.any(String),
          method: 'POST',
          path: '/api/test',
        })
      );

      loggerInfoSpy.mockRestore();
    });
  });

  describe('Error Message Localization', () => {
    it('should return Chinese error messages', () => {
      const errors = [
        new ValidationError('单词不能为空'),
        new AuthenticationError('请先登录'),
        new DatabaseError('数据库操作失败，请重试'),
      ];

      errors.forEach((error) => {
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
        const response = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][0];
        
        // Should contain Chinese characters
        expect(/[\u4e00-\u9fa5]/.test(response.error)).toBe(true);
      });
    });

    it('should not expose technical details in error messages', () => {
      const error = new Error('TypeError: Cannot read property "x" of undefined at line 42');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const response = jsonSpy.mock.calls[0][0];

      expect(response.error).not.toContain('TypeError');
      expect(response.error).not.toContain('undefined');
      expect(response.error).not.toContain('line 42');
      expect(response.error).toBe('系统错误，请稍后重试');
    });

    it('should not expose stack traces in response', () => {
      const error = new Error('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const response = jsonSpy.mock.calls[0][0];

      expect(response.stack).toBeUndefined();
      expect(response.details).toBeUndefined();
    });
  });
});
