import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { config } from '../config/env';
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
  DatabaseError,
} from '../utils/errors';
import { validateUsername, validatePassword } from '../utils/validation';
import { User, RegisterRequest, LoginRequest, AuthResponse } from '../types';

export class AuthService {
  /**
   * Register a new user
   * @param data - Registration data
   * @returns Authentication response with token
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const { username, password, email } = data;

    // Validate input
    validateUsername(username);
    validatePassword(password);

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.security.bcryptSaltRounds);

    try {
      // Insert user into database
      const result = await pool.query<User>(
        `INSERT INTO users (username, password_hash, email, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, username, created_at, updated_at`,
        [username, passwordHash, email || null]
      );

      const user = result.rows[0];

      // Generate JWT token
      const token = this.generateToken(user.id, user.username);

      return {
        success: true,
        token,
        userId: user.id,
        user: {
          id: user.id,
          username: user.username,
        },
      };
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new ConflictError('用户名已存在');
      }
      console.error('Registration error details:', error);
      throw new DatabaseError('注册失败，请重试');
    }
  }

  /**
   * Login user
   * @param data - Login credentials
   * @returns Authentication response with token
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const { username, password } = data;

    if (!username || !password) {
      throw new ValidationError('用户名和密码不能为空');
    }

    try {
      // Query user from database
      const result = await pool.query<User>(
        'SELECT id, username, password_hash as "passwordHash" FROM users WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        throw new AuthenticationError('用户名或密码错误');
      }

      const user = result.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        throw new AuthenticationError('用户名或密码错误');
      }

      // Generate JWT token
      const token = this.generateToken(user.id, user.username);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error('Login error details:', error);
      throw new DatabaseError('登录失败，请重试');
    }
  }

  /**
   * Verify JWT token
   * @param token - JWT token
   * @returns Decoded token payload
   */
  verifyToken(token: string): { userId: string; username: string } {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        username: string;
      };
      return decoded;
    } catch (error) {
      throw new AuthenticationError('令牌无效或已过期');
    }
  }

  /**
   * Generate JWT token
   * @param userId - User ID
   * @param username - Username
   * @returns JWT token
   */
  private generateToken(userId: string, username: string): string {
    return jwt.sign(
      { userId, username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );
  }
}
