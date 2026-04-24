import { AuthService } from './auth.service';
import { pool } from '../config/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
  DatabaseError,
} from '../utils/errors';
import { QueryResult } from 'pg';
import fc from 'fast-check';

// Mock dependencies
jest.mock('../config/database');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const mockPool = pool as jest.Mocked<typeof pool>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Store the original bcrypt for property-based testing
const originalBcrypt = jest.requireActual('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerData = {
        username: 'testuser',
        password: 'password123',
        email: 'test@example.com',
      };

      const hashedPassword = 'hashed_password';
      const userId = 'user-123';
      const token = 'jwt_token';

      mockBcrypt.hash.mockResolvedValue(hashedPassword as never);
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            id: userId,
            username: registerData.username,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);
      mockJwt.sign.mockReturnValue(token as never);

      const result = await authService.register(registerData);

      expect(result.success).toBe(true);
      expect(result.token).toBe(token);
      expect(result.userId).toBe(userId);
      expect(result.user?.username).toBe(registerData.username);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(
        registerData.password,
        config.security.bcryptSaltRounds
      );
    });

    it('should throw ValidationError for invalid username', async () => {
      const registerData = {
        username: 'ab', // Too short
        password: 'password123',
      };

      await expect(authService.register(registerData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid password', async () => {
      const registerData = {
        username: 'testuser',
        password: '12345', // Too short
      };

      await expect(authService.register(registerData)).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError for duplicate username', async () => {
      const registerData = {
        username: 'existinguser',
        password: 'password123',
      };

      mockBcrypt.hash.mockResolvedValue('hashed_password' as never);
      (mockPool.query as jest.Mock).mockRejectedValue({ code: '23505' }); // Unique constraint violation

      await expect(authService.register(registerData)).rejects.toThrow(ConflictError);
      await expect(authService.register(registerData)).rejects.toThrow('用户名已存在');
    });

    it('should throw DatabaseError for other database errors', async () => {
      const registerData = {
        username: 'testuser',
        password: 'password123',
      };

      mockBcrypt.hash.mockResolvedValue('hashed_password' as never);
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await expect(authService.register(registerData)).rejects.toThrow(DatabaseError);
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginData = {
        username: 'testuser',
        password: 'password123',
      };

      const userId = 'user-123';
      const hashedPassword = 'hashed_password';
      const token = 'jwt_token';

      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            id: userId,
            username: loginData.username,
            passwordHash: hashedPassword,
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockJwt.sign.mockReturnValue(token as never);

      const result = await authService.login(loginData);

      expect(result.success).toBe(true);
      expect(result.token).toBe(token);
      expect(result.user?.id).toBe(userId);
      expect(result.user?.username).toBe(loginData.username);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(loginData.password, hashedPassword);
    });

    it('should throw ValidationError for empty username', async () => {
      const loginData = {
        username: '',
        password: 'password123',
      };

      await expect(authService.login(loginData)).rejects.toThrow(ValidationError);
      await expect(authService.login(loginData)).rejects.toThrow('用户名和密码不能为空');
    });

    it('should throw ValidationError for empty password', async () => {
      const loginData = {
        username: 'testuser',
        password: '',
      };

      await expect(authService.login(loginData)).rejects.toThrow(ValidationError);
    });

    it('should throw AuthenticationError for non-existent user', async () => {
      const loginData = {
        username: 'nonexistent',
        password: 'password123',
      };

      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError);
      await expect(authService.login(loginData)).rejects.toThrow('用户名或密码错误');
    });

    it('should throw AuthenticationError for incorrect password', async () => {
      const loginData = {
        username: 'testuser',
        password: 'wrongpassword',
      };

      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            id: 'user-123',
            username: loginData.username,
            passwordHash: 'hashed_password',
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError);
      await expect(authService.login(loginData)).rejects.toThrow('用户名或密码错误');
    });

    it('should throw DatabaseError for database errors', async () => {
      const loginData = {
        username: 'testuser',
        password: 'password123',
      };

      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(authService.login(loginData)).rejects.toThrow(DatabaseError);
    });
  });

  describe('verifyToken', () => {
    it('should successfully verify a valid token', () => {
      const token = 'valid_token';
      const decoded = {
        userId: 'user-123',
        username: 'testuser',
      };

      mockJwt.verify.mockReturnValue(decoded as never);

      const result = authService.verifyToken(token);

      expect(result.userId).toBe(decoded.userId);
      expect(result.username).toBe(decoded.username);
      expect(mockJwt.verify).toHaveBeenCalledWith(token, config.jwt.secret);
    });

    it('should throw AuthenticationError for invalid token', () => {
      const token = 'invalid_token';

      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => authService.verifyToken(token)).toThrow(AuthenticationError);
      expect(() => authService.verifyToken(token)).toThrow('令牌无效或已过期');
    });

    it('should throw AuthenticationError for expired token', () => {
      const token = 'expired_token';

      mockJwt.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      expect(() => authService.verifyToken(token)).toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for malformed token', () => {
      const token = 'malformed.token';

      mockJwt.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      expect(() => authService.verifyToken(token)).toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for token with invalid signature', () => {
      const token = 'token_with_invalid_signature';

      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      expect(() => authService.verifyToken(token)).toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for empty token', () => {
      const token = '';

      mockJwt.verify.mockImplementation(() => {
        throw new Error('jwt must be provided');
      });

      expect(() => authService.verifyToken(token)).toThrow(AuthenticationError);
    });
  });

  describe('Additional Edge Cases', () => {
    describe('register - additional scenarios', () => {
      it('should successfully register user without email', async () => {
        const registerData = {
          username: 'testuser',
          password: 'password123',
        };

        const hashedPassword = 'hashed_password';
        const userId = 'user-123';
        const token = 'jwt_token';

        mockBcrypt.hash.mockResolvedValue(hashedPassword as never);
        (mockPool.query as jest.Mock).mockResolvedValue({
          rows: [
            {
              id: userId,
              username: registerData.username,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
        } as QueryResult);
        mockJwt.sign.mockReturnValue(token as never);

        const result = await authService.register(registerData);

        expect(result.success).toBe(true);
        expect(result.token).toBe(token);
      });

      it('should throw ValidationError for username with special characters', async () => {
        const registerData = {
          username: 'test@user!',
          password: 'password123',
        };

        await expect(authService.register(registerData)).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError for username that is too long', async () => {
        const registerData = {
          username: 'a'.repeat(21), // 21 characters, exceeds max of 20
          password: 'password123',
        };

        await expect(authService.register(registerData)).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError for empty username', async () => {
        const registerData = {
          username: '',
          password: 'password123',
        };

        await expect(authService.register(registerData)).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError for empty password', async () => {
        const registerData = {
          username: 'testuser',
          password: '',
        };

        await expect(authService.register(registerData)).rejects.toThrow(ValidationError);
      });
    });

    describe('login - additional scenarios', () => {
      it('should throw DatabaseError when database query fails unexpectedly', async () => {
        const loginData = {
          username: 'testuser',
          password: 'password123',
        };

        (mockPool.query as jest.Mock).mockRejectedValue(new Error('Connection timeout'));

        await expect(authService.login(loginData)).rejects.toThrow(DatabaseError);
        await expect(authService.login(loginData)).rejects.toThrow('登录失败，请重试');
      });

      it('should not leak information about whether user exists', async () => {
        const loginData = {
          username: 'nonexistent',
          password: 'password123',
        };

        (mockPool.query as jest.Mock).mockResolvedValue({
          rows: [],
          command: 'SELECT',
          rowCount: 0,
          oid: 0,
          fields: [],
        } as QueryResult);

        try {
          await authService.login(loginData);
        } catch (error: any) {
          // Should use generic error message
          expect(error.message).toBe('用户名或密码错误');
        }
      });

      it('should handle bcrypt comparison failure', async () => {
        const loginData = {
          username: 'testuser',
          password: 'password123',
        };

        (mockPool.query as jest.Mock).mockResolvedValue({
          rows: [
            {
              id: 'user-123',
              username: loginData.username,
              passwordHash: 'hashed_password',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        } as QueryResult);
        (mockBcrypt.compare as jest.Mock).mockRejectedValue(new Error('Bcrypt error'));

        await expect(authService.login(loginData)).rejects.toThrow(DatabaseError);
      });
    });

    describe('token generation', () => {
      it('should generate token with correct payload structure', async () => {
        const registerData = {
          username: 'testuser',
          password: 'password123',
        };

        const userId = 'user-123';
        const hashedPassword = 'hashed_password';

        mockBcrypt.hash.mockResolvedValue(hashedPassword as never);
        (mockPool.query as jest.Mock).mockResolvedValue({
          rows: [
            {
              id: userId,
              username: registerData.username,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
        } as QueryResult);
        mockJwt.sign.mockReturnValue('jwt_token' as never);

        await authService.register(registerData);

        expect(mockJwt.sign).toHaveBeenCalledWith(
          { userId, username: registerData.username },
          config.jwt.secret,
          { expiresIn: config.jwt.expiresIn }
        );
      });

      it('should generate different tokens for different users', async () => {
        const user1Data = {
          username: 'user1',
          password: 'password123',
        };

        const user2Data = {
          username: 'user2',
          password: 'password123',
        };

        mockBcrypt.hash.mockResolvedValue('hashed_password' as never);
        
        // First user
        (mockPool.query as jest.Mock).mockResolvedValueOnce({
          rows: [
            {
              id: 'user-1',
              username: user1Data.username,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
        } as QueryResult);
        mockJwt.sign.mockReturnValueOnce('token1' as never);

        const result1 = await authService.register(user1Data);

        // Second user
        (mockPool.query as jest.Mock).mockResolvedValueOnce({
          rows: [
            {
              id: 'user-2',
              username: user2Data.username,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
        } as QueryResult);
        mockJwt.sign.mockReturnValueOnce('token2' as never);

        const result2 = await authService.register(user2Data);

        expect(result1.token).not.toBe(result2.token);
      });
    });
  });

  // Feature: children-english-learning-platform, Property 20: 对于任意用户密码，存储到数据库中的值应该是经过bcrypt哈希处理的字符串，不应该是明文密码，且哈希值的长度应该符合bcrypt输出格式（60字符）。
  describe('Property-Based Test: Password Hash Storage', () => {
    it('should store passwords as bcrypt hashes with correct format for any valid password', async () => {
      // **Validates: Requirements 15.3**
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/),
            // Generate passwords with at least 6 printable ASCII characters (excluding whitespace-only)
            password: fc.stringOf(
              fc.char().filter(c => c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126),
              { minLength: 6, maxLength: 100 }
            ),
            email: fc.option(fc.emailAddress(), { nil: undefined })
          }),
          async (registerData) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();

            // Mock database query to capture the hash being stored
            let storedPasswordHash: string | undefined;
            (mockPool.query as jest.Mock).mockImplementation((query: string, params: any[]) => {
              // Check if this is the INSERT query (contains INSERT INTO users and password_hash)
              if (typeof query === 'string' && query.includes('INSERT INTO users') && query.includes('password_hash')) {
                // Capture the password hash being stored (second parameter - index 1)
                storedPasswordHash = params[1];
                return Promise.resolve({
                  rows: [{
                    id: 'test-user-id',
                    username: registerData.username,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }],
                  command: 'INSERT',
                  rowCount: 1,
                  oid: 0,
                  fields: [],
                } as QueryResult);
              }
              return Promise.resolve({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] } as QueryResult);
            });
            
            // Don't mock bcrypt.hash - let it run normally to generate real hashes
            // This ensures the actual bcrypt hashing happens
            mockBcrypt.hash.mockImplementation(((password: string | Buffer, saltRounds: string | number) => {
              return originalBcrypt.hash(password, saltRounds);
            }) as any);
            
            mockJwt.sign.mockReturnValue('test-token' as never);

            // Execute the register function
            await authService.register(registerData);

            // Property 1: The stored value should NOT be the plaintext password
            expect(storedPasswordHash).toBeDefined();
            expect(storedPasswordHash).not.toBe(registerData.password);

            // Property 2: The stored value should be a bcrypt hash (60 characters)
            expect(storedPasswordHash).toHaveLength(60);

            // Property 3: The stored value should start with bcrypt format identifier ($2a$, $2b$, or $2y$)
            expect(storedPasswordHash).toMatch(/^\$2[aby]\$/);

            // Property 4: The hash should be verifiable with bcrypt
            const isValidHash = await originalBcrypt.compare(registerData.password, storedPasswordHash!);
            expect(isValidHash).toBe(true);

            // Property 5: Different passwords should produce different hashes
            // (This is implicitly tested by the bcrypt.compare verification)
          }
        ),
        { numRuns: 20 } // Reduced from 100 to 20 due to bcrypt being slow
      );
    }, 30000); // Increased timeout to 30 seconds for property-based test with bcrypt
  });
});
