import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError, ExternalServiceError, DatabaseError, TimeoutError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ErrorResponse } from '../types';

/**
 * Error classification types
 * Requirements: 14.3
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  EXTERNAL_SERVICE = 'external_service',
  DATABASE = 'database',
  TIMEOUT = 'timeout',
  SYSTEM = 'system',
}

/**
 * Classify error into appropriate category
 * Requirements: 14.3
 */
function classifyError(err: Error): ErrorCategory {
  if (err instanceof ValidationError) return ErrorCategory.VALIDATION;
  if (err instanceof AuthenticationError) return ErrorCategory.AUTHENTICATION;
  if (err instanceof AuthorizationError) return ErrorCategory.AUTHORIZATION;
  if (err instanceof NotFoundError) return ErrorCategory.NOT_FOUND;
  if (err instanceof ConflictError) return ErrorCategory.CONFLICT;
  if (err instanceof ExternalServiceError) return ErrorCategory.EXTERNAL_SERVICE;
  if (err instanceof DatabaseError) return ErrorCategory.DATABASE;
  if (err instanceof TimeoutError) return ErrorCategory.TIMEOUT;
  return ErrorCategory.SYSTEM;
}

/**
 * Global error handling middleware
 * Requirements: 14.1, 14.2, 14.3
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req as any).requestId || generateRequestId();
  const userId = (req as any).user?.id;

  // Classify error
  const errorCategory = classifyError(err);

  // Prepare structured log context
  const logContext = {
    requestId,
    userId,
    path: req.path,
    method: req.method,
    errorCategory,
    errorCode: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
    errorMessage: err.message,
    stack: err.stack,
    // Additional context for debugging
    query: req.query,
    body: sanitizeLogBody(req.body),
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };

  // Log error with structured logging
  // Requirements: 14.2, 14.4
  if (err instanceof AppError) {
    // Known application errors - log as error
    logger.error('Application error', logContext);
  } else {
    // Unknown system errors - log with full stack trace
    logger.error('System error', logContext);
  }

  // Handle known application errors
  // Requirements: 14.1, 14.5
  if (err instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: err.message, // Already in Chinese, no technical details
      code: err.code,
      retryable: err.retryable,
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(err.statusCode).json(errorResponse);
    return;
  }

  // Handle unknown errors - don't expose technical details
  // Requirements: 14.1, 14.5
  const errorResponse: ErrorResponse = {
    error: '系统错误，请稍后重试',
    code: 'INTERNAL_ERROR',
    retryable: false,
    timestamp: new Date().toISOString(),
    requestId,
  };

  res.status(500).json(errorResponse);
}

/**
 * Request ID generation and tracking middleware
 * Requirements: 14.2
 */
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Use existing request ID from header or generate new one
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();
  
  // Attach to request object for use in handlers and error handler
  (req as any).requestId = requestId;
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userId: (req as any).user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  next();
}

/**
 * Generate unique request ID
 * Requirements: 14.2
 */
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sanitize request body for logging (remove sensitive data)
 * Requirements: 14.4
 */
function sanitizeLogBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}
