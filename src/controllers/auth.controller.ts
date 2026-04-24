import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterRequest, LoginRequest } from '../types';

const authService = new AuthService();

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data: RegisterRequest = req.body;
    const result = await authService.register(data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data: LoginRequest = req.body;
    const result = await authService.login(data);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Logout user
 * POST /api/auth/logout
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  // Since we're using JWT, logout is handled client-side by removing the token
  // This endpoint is provided for consistency and future enhancements
  res.status(200).json({ success: true, message: '登出成功' });
}

/**
 * Verify token
 * GET /api/auth/verify
 */
export async function verify(req: Request, res: Response): Promise<void> {
  // If we reach here, the authenticateToken middleware has already verified the token
  res.status(200).json({
    valid: true,
    userId: req.user?.userId,
    username: req.user?.username,
  });
}
