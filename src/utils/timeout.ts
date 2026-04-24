/**
 * Timeout Utilities
 * Requirements: 2.2, 3.2 - Task 14.2
 * Provides timeout control for async operations
 */

import { TimeoutError } from './errors';

/**
 * Execute a promise with a timeout
 * @param promise - Promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message
 * @returns Promise result
 * @throws TimeoutError if operation exceeds timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = '操作超时'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(errorMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Execute a function with retry and timeout
 * @param fn - Function to execute
 * @param options - Retry and timeout options
 * @returns Function result
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    timeoutMs?: number;
    retryDelays?: number[];
    errorMessage?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    timeoutMs = 5000,
    retryDelays = [1000, 2000, 4000],
    errorMessage = '操作超时',
  } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs, errorMessage);
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) {
        throw error;
      }

      // Wait before retrying
      const delay = retryDelays[attempt] || retryDelays[retryDelays.length - 1];
      await sleep(delay);
    }
  }

  throw new TimeoutError(errorMessage);
}

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create an AbortController with timeout
 * @param timeoutMs - Timeout in milliseconds
 * @returns AbortController and cleanup function
 */
export function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const cleanup = () => {
    clearTimeout(timeoutId);
  };

  return { controller, cleanup };
}

/**
 * Execute database query with timeout
 * @param queryFn - Query function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns Query result
 */
export async function withDatabaseTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return withTimeout(
    queryFn(),
    timeoutMs,
    '数据库查询超时，请重试'
  );
}

/**
 * Execute external API call with timeout
 * @param apiFn - API function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param serviceName - Name of the service for error message
 * @returns API result
 */
export async function withApiTimeout<T>(
  apiFn: () => Promise<T>,
  timeoutMs: number,
  serviceName: string = '外部服务'
): Promise<T> {
  return withTimeout(
    apiFn(),
    timeoutMs,
    `${serviceName}请求超时，请重试`
  );
}

