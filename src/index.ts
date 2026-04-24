import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

import express, { Application } from 'express';
import path from 'path';
import authRoutes from './routes/auth.routes';
import wordRoutes from './routes/word.routes';
import reviewRoutes from './routes/review.routes';
import quizRoutes from './routes/quiz.routes';
import { errorHandler, requestIdMiddleware } from './middleware/errorHandler';
import {
  corsMiddleware,
  securityHeadersMiddleware,
  rateLimitMiddleware,
  requestSizeLimitMiddleware,
  httpsRedirectMiddleware,
} from './middleware/security.middleware';

const app: Application = express();
const PORT = process.env.PORT || 4000;

// Security middleware (must be first)
// HTTPS redirect in production (Requirement: 16.3)
app.use(httpsRedirectMiddleware);

// CORS configuration (Requirement: 16.3)
app.use(corsMiddleware);

// Security headers (Requirement: 16.3)
app.use(securityHeadersMiddleware);

// Request size limit (Requirement: 16.3)
app.use(requestSizeLimitMiddleware(1024 * 1024)); // 1MB limit

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request ID tracking middleware (Requirements: 14.2)
app.use(requestIdMiddleware);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting (Requirement: 16.3)
// Different limits for different endpoint types
const authRateLimit = rateLimitMiddleware(60000, 5); // 5 requests per minute for auth
const apiRateLimit = rateLimitMiddleware(60000, 60); // 60 requests per minute for API

// Health check endpoint (no rate limit)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes with rate limiting
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/words', apiRateLimit, wordRoutes);
app.use('/api/reviews', apiRateLimit, reviewRoutes);
app.use('/api/quiz', apiRateLimit, quizRoutes);

// Serve index.html for all other routes (SPA support)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend available at: http://localhost:${PORT}`);
});

export default app;
