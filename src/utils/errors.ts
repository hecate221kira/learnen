export class AppError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400, false);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = '请先登录') {
    super(message, 'UNAUTHORIZED', 401, false);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = '没有权限访问此资源') {
    super(message, 'FORBIDDEN', 403, false);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = '资源不存在') {
    super(message, 'NOT_FOUND', 404, false);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409, false);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, retryable: boolean = true) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, retryable);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = '数据库操作失败，请重试') {
    super(message, 'DATABASE_ERROR', 500, true);
  }
}

export class TimeoutError extends AppError {
  constructor(message: string = '请求超时，请重试') {
    super(message, 'TIMEOUT_ERROR', 504, true);
  }
}
