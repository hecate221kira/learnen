// User types
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Word types
export interface Word {
  id: string;
  userId: string;
  englishWord: string;
  chineseTranslation: string;
  imageUrl: string;
  imageValidatedAt?: Date;
  learnedAt: Date;
}

// Review Schedule types
export interface ReviewSchedule {
  id: string;
  wordId: string;
  userId: string;
  dueDate: Date;
  intervalDays: number;
  completed: boolean;
  completedAt?: Date;
}

// Review Attempt types
export interface ReviewAttempt {
  id: string;
  scheduleId: string;
  wordId: string;
  userId: string;
  attemptedAt: Date;
  correct: boolean;
  responseTimeMs?: number;
}

// Image Cache types
export interface ImageCache {
  id: string;
  searchTerm: string;
  imageUrl: string;
  source?: string;
  cachedAt: Date;
  validatedAt: Date;
  isValid: boolean;
}

// API Request/Response types
export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  userId?: string;
  user?: {
    id: string;
    username: string;
  };
}

export interface TranslateRequest {
  word: string;
}

export interface TranslateResponse {
  success: boolean;
  word: string;
  translation: string;
  imageUrl: string;
  error?: string;
}

export interface SaveWordRequest {
  word: string;
  translation: string;
  imageUrl: string;
}

export interface SaveWordResponse {
  success: boolean;
  wordId: string;
  reviewSchedule: Date[];
}

// Quiz types
export interface QuizOption {
  imageUrl: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  questionId: string;
  word: string;
  translation: string;
  options: QuizOption[];
}

export interface AnswerQuizRequest {
  questionId: string;
  selectedImageUrl: string;
}

export interface AnswerQuizResponse {
  correct: boolean;
  correctImageUrl: string;
  explanation?: string;
}

// Error types
export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
  retryable?: boolean;
  timestamp: string;
  requestId: string;
}
