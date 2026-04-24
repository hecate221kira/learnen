import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../utils/errors';

// Mock AuthService before importing the middleware
const mockVerifyToken = jest.fn();
jest.mock('../services/auth.service', () => {
  return {
    AuthService: jest.fn().mockImplementation(() => {
      return {
        verifyToken: mockVerifyToken,
      };
    }),
  };
});

// Import middleware after mocking
import { authenticateToken, optionalAuth } from './auth.middleware';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token and attach user to request', () => {
      const token = 'valid_token';
      const decoded = {
        userId: 'user-123',
        username: 'testuser',
      };

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };
      mockVerifyToken.mockReturnValue(decoded);

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(decoded);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should throw AuthenticationError when no token provided', () => {
      mockRequest.headers = {};

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(mockRequest.user).toBeUndefined();
    });

    it('should throw AuthenticationError when authorization header is malformed', () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token',
      };

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should pass error to next when token verification fails', () => {
      const token = 'invalid_token';
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      const error = new AuthenticationError('令牌无效或已过期');
      mockVerifyToken.mockImplementation(() => {
        throw error;
      });

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRequest.user).toBeUndefined();
    });

    it('should handle token without Bearer prefix', () => {
      mockRequest.headers = {
        authorization: 'token_without_bearer',
      };

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should handle expired token', () => {
      const token = 'expired_token';
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      const error = new AuthenticationError('令牌无效或已过期');
      mockVerifyToken.mockImplementation(() => {
        throw error;
      });

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRequest.user).toBeUndefined();
    });

    it('should extract token correctly from Bearer header', () => {
      const token = 'valid_token';
      const decoded = {
        userId: 'user-123',
        username: 'testuser',
      };

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };
      mockVerifyToken.mockReturnValue(decoded);

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockVerifyToken).toHaveBeenCalledWith(token);
    });

    it('should handle case-sensitive Bearer prefix', () => {
      mockRequest.headers = {
        authorization: 'bearer valid_token', // lowercase
      };

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('optionalAuth', () => {
    it('should attach user when valid token is provided', () => {
      const token = 'valid_token';
      const decoded = {
        userId: 'user-123',
        username: 'testuser',
      };

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };
      mockVerifyToken.mockReturnValue(decoded);

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(decoded);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without error when no token provided', () => {
      mockRequest.headers = {};

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without error when token is invalid', () => {
      const token = 'invalid_token';
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockVerifyToken.mockImplementation(() => {
        throw new AuthenticationError('令牌无效或已过期');
      });

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not attach user when authorization header is malformed', () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token',
      };

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without error when token is expired', () => {
      const token = 'expired_token';
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockVerifyToken.mockImplementation(() => {
        throw new AuthenticationError('令牌无效或已过期');
      });

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle any error gracefully', () => {
      const token = 'valid_token';
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockVerifyToken.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
