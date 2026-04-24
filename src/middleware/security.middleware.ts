import { Request, Response, NextFunction } from 'express';

/**
 * CORS middleware
 * Configures Cross-Origin Resource Sharing policy
 * 
 * Requirements: Production security configuration
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:4000', 'http://localhost:4001'];

  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

/**
 * Security headers middleware
 * Adds security-related HTTP headers
 * 
 * Requirements: Production security configuration
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');

  // Content Security Policy (basic)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );

  // Strict Transport Security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
}

/**
 * Rate limiting middleware
 * Limits the number of requests from a single IP address
 * 
 * Requirements: Production security configuration
 */
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach((key) => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
}, 5 * 60 * 1000);

export function rateLimitMiddleware(
  windowMs: number = 60000, // 1 minute default
  maxRequests: number = 60 // 60 requests per minute default
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test') {
      next();
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // Initialize or get rate limit data for this IP
    if (!rateLimitStore[ip] || rateLimitStore[ip].resetTime < now) {
      rateLimitStore[ip] = {
        count: 1,
        resetTime: now + windowMs,
      };
      next();
      return;
    }

    // Increment request count
    rateLimitStore[ip].count++;

    // Check if limit exceeded
    if (rateLimitStore[ip].count > maxRequests) {
      res.status(429).json({
        error: '请求过于频繁，请稍后重试',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((rateLimitStore[ip].resetTime - now) / 1000),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - rateLimitStore[ip].count).toString());
    res.setHeader(
      'X-RateLimit-Reset',
      new Date(rateLimitStore[ip].resetTime).toISOString()
    );

    next();
  };
}

/**
 * Request size limit middleware
 * Prevents large payload attacks
 * 
 * Requirements: Production security configuration
 */
export function requestSizeLimitMiddleware(
  maxSize: number = 1024 * 1024 // 1MB default
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];

    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      res.status(413).json({
        error: '请求体过大',
        code: 'PAYLOAD_TOO_LARGE',
        maxSize: `${maxSize / 1024}KB`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * HTTPS redirect middleware
 * Redirects HTTP requests to HTTPS in production
 * 
 * Requirements: Production security configuration
 */
export function httpsRedirectMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] !== 'https' &&
    !req.secure
  ) {
    res.redirect(301, `https://${req.headers.host}${req.url}`);
    return;
  }

  next();
}
