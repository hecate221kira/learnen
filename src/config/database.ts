import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { config } from './env';
import { logger } from '../utils/logger';
import { TimeoutError } from '../utils/errors';

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'english_learning',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Add statement timeout for query performance (Requirements: 2.2, 3.2)
  statement_timeout: config.timeouts.dbQuery,
};

export const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
  console.log('Database connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

/**
 * Execute a query with timeout control
 * Requirements: 2.2, 3.2 - Task 14.2
 * @param text - SQL query text
 * @param params - Query parameters
 * @param timeoutMs - Optional timeout override
 * @returns Query result
 */
export async function queryWithTimeout<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
  timeoutMs?: number
): Promise<QueryResult<T>> {
  const timeout = timeoutMs || config.timeouts.dbQuery;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError('数据库查询超时，请重试'));
    }, timeout);
  });

  const queryPromise = pool.query<T>(text, params);

  try {
    const result = await Promise.race([queryPromise, timeoutPromise]);
    return result;
  } catch (error) {
    if (error instanceof TimeoutError) {
      logger.error('Database query timeout', {
        query: text.substring(0, 100),
        timeout,
      });
    }
    throw error;
  }
}

export default pool;

