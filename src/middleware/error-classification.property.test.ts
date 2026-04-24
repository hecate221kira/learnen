import fc from 'fast-check';
import { Request, Response } from 'express';
import { errorHandler, ErrorCategory } from './errorHandler';
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
import { logger } from '../utils/logger';

/**
 * Property-Based Tests for Error Type Classification
 * Feature: children-english-learning-platform, Property 17: 错误类型区分
 * **Validates: Requirements 14.3**
 * 
 * Tests that arbitrary errors are correctly classified and logged with appropriate category
 */
describe('Error Type Classification - Property Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;
  let loggerErrorSpy: jest.SpyInstance;

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

    // Spy on logger
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  /**
   * Property 17: 错误类型区分
   * 对于任意错误，系统应该能够正确识别其类型并在日志中记录相应的错误类别标识
   */
  it('should classify ValidationError correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (message) => {
          const error = new ValidationError(message);

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[0][1];

          // Should classify as validation error
          expect(logContext.errorCategory).toBe(ErrorCategory.VALIDATION);
          expect(logContext.errorCode).toBe('VALIDATION_ERROR');
          
          // Should use correct HTTP status
          expect(statusSpy).toHaveBeenCalledWith(400);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify AuthenticationError correctly', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        (message) => {
          const error = message ? new AuthenticationError(message) : new AuthenticationError();

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[0][1];

          // Should classify as authentication error
          expect(logContext.errorCategory).toBe(ErrorCategory.AUTHENTICATION);
          expect(logContext.errorCode).toBe('UNAUTHORIZED');
          
          // Should use correct HTTP status
          expect(statusSpy).toHaveBeenCalledWith(401);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify AuthorizationError correctly', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        (message) => {
          const error = message ? new AuthorizationError(message) : new AuthorizationError();

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[0][1];

          // Should classify as authorization error
          expect(logContext.errorCategory).toBe(ErrorCategory.AUTHORIZATION);
          expect(logContext.errorCode).toBe('FORBIDDEN');
          
          // Should use correct HTTP status
          expect(statusSpy).toHaveBeenCalledWith(403);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify NotFoundError correctly', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        (message) => {
          const error = message ? new NotFoundError(message) : new NotFoundError();

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[0][1];

          // Should classify as not found error
          expect(logContext.errorCategory).toBe(ErrorCategory.NOT_FOUND);
          expect(logContext.errorCode).toBe('NOT_FOUND');
          
          // Should use correct HTTP status
          expect(statusSpy).toHaveBeenCalledWith(404);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify ConflictError correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (message) => {
          const error = new ConflictError(message);

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[0][1];

          // Should classify as conflict error
          expect(logContext.errorCategory).toBe(ErrorCategory.CONFLICT);
          expect(logContext.errorCode).toBe('CONFLICT');
          
          // Should use correct HTTP status
          expect(statusSpy).toHaveBeenCalledWith(409);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify ExternalServiceError correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.boolean(),
        (message, retryable) => {
          const error = new ExternalServiceError(message, retryable);

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[0][1];

          // Should classify as external service error
          expect(logContext.errorCategory).toBe(ErrorCategory.EXTERNAL_SERVICE);
          expect(logContext.errorCode).toBe('EXTERNAL_SERVICE_ERROR');
          
          // Should use correct HTTP status
          expect(statusSpy).toHaveBeenCalledWith(502);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify DatabaseError correctly', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        (message) => {
          const error = message ? new DatabaseError(message) : new DatabaseError();

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[0][1];

          // Should classify as database error
          expect(logContext.errorCategory).toBe(ErrorCategory.DATABASE);
          expect(logContext.errorCode).toBe('DATABASE_ERROR');
          
          // Should use correct HTTP status
          expect(statusSpy).toHaveBeenCalledWith(500);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify TimeoutError correctly', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        (message) => {
          const error = message ? new TimeoutError(message) : new TimeoutError();

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[0][1];

          // Should classify as timeout error
          expect(logContext.errorCategory).toBe(ErrorCategory.TIMEOUT);
          expect(logContext.errorCode).toBe('TIMEOUT_ERROR');
          
          // Should use correct HTTP status
          expect(statusSpy).toHaveBeenCalledWith(504);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify unknown errors as system errors', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (message) => {
          const error = new Error(message);

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[0][1];

          // Should classify as system error
          expect(logContext.errorCategory).toBe(ErrorCategory.SYSTEM);
          expect(logContext.errorCode).toBe('INTERNAL_ERROR');
          
          // Should use correct HTTP status
          expect(statusSpy).toHaveBeenCalledWith(500);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should log error category for all error types', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new ValidationError('错误')),
          fc.constant(new AuthenticationError()),
          fc.constant(new AuthorizationError()),
          fc.constant(new NotFoundError()),
          fc.constant(new ConflictError('错误')),
          fc.constant(new ExternalServiceError('错误')),
          fc.constant(new DatabaseError()),
          fc.constant(new TimeoutError()),
          fc.constant(new Error('错误')),
        ),
        (error) => {
          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[0][1];

          // Should have errorCategory field
          expect(logContext.errorCategory).toBeTruthy();
          expect(typeof logContext.errorCategory).toBe('string');
          
          // Should be one of the defined categories
          const validCategories = Object.values(ErrorCategory);
          expect(validCategories).toContain(logContext.errorCategory);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include request context in error logs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
        (pathStr, method) => {
          const testReq: Partial<Request> = {
            path: pathStr,
            method,
            headers: {},
            query: {},
            body: {},
            ip: '127.0.0.1',
            get: jest.fn(),
          };
          
          const error = new ValidationError('测试错误');

          errorHandler(error, testReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[loggerErrorSpy.mock.calls.length - 1][1];

          // Should include request context
          expect(logContext.path).toBe(pathStr);
          expect(logContext.method).toBe(method);
          expect(logContext.requestId).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include error message and stack in logs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (message) => {
          const error = new Error(message);

          errorHandler(error, mockReq as Request, mockRes as Response, jest.fn());

          expect(loggerErrorSpy).toHaveBeenCalled();
          const logContext = loggerErrorSpy.mock.calls[loggerErrorSpy.mock.calls.length - 1][1];

          // Should include error message and stack
          expect(logContext.errorMessage).toBe(message);
          expect(logContext.stack).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });
});
