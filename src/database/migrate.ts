/**
 * Database Migration Runner
 * 
 * Programmatic interface for running database migrations.
 * Can be used in development, testing, and deployment scripts.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationResult {
  success: boolean;
  migration: string;
  error?: string;
}

/**
 * Run all database migrations in order
 */
export async function runMigrations(pool: Pool): Promise<MigrationResult[]> {
  const migrationsDir = path.join(__dirname, 'migrations');
  const results: MigrationResult[] = [];

  // Migration files in order
  const migrationFiles = [
    '001_create_users_table.sql',
    '002_create_words_table.sql',
    '003_create_review_schedules_table.sql',
    '004_create_review_attempts_table.sql',
    '005_create_image_cache_table.sql',
  ];

  console.log('Starting database migrations...\n');

  // Enable pgcrypto extension for UUID generation
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    console.log('✓ pgcrypto extension enabled');
  } catch (error) {
    console.error('✗ Failed to enable pgcrypto extension:', error);
    throw error;
  }

  // Run each migration
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    
    try {
      const sql = fs.readFileSync(filePath, 'utf-8');
      await pool.query(sql);
      
      console.log(`✓ ${file}`);
      results.push({
        success: true,
        migration: file,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${file}: ${errorMessage}`);
      
      results.push({
        success: false,
        migration: file,
        error: errorMessage,
      });
      
      // Stop on first error
      throw new Error(`Migration failed: ${file}`);
    }
  }

  console.log('\n✓ All migrations completed successfully!');
  return results;
}

/**
 * Rollback all migrations (drop all tables)
 */
export async function rollbackMigrations(pool: Pool): Promise<void> {
  console.log('Rolling back all migrations...\n');

  const tables = [
    'review_attempts',
    'review_schedules',
    'image_cache',
    'words',
    'users',
  ];

  for (const table of tables) {
    try {
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`✓ Dropped table: ${table}`);
    } catch (error) {
      console.error(`✗ Failed to drop table ${table}:`, error);
      throw error;
    }
  }

  console.log('\n✓ All migrations rolled back successfully!');
}

/**
 * Verify database schema
 */
export async function verifySchema(pool: Pool): Promise<boolean> {
  console.log('Verifying database schema...\n');

  const expectedTables = [
    'users',
    'words',
    'review_schedules',
    'review_attempts',
    'image_cache',
  ];

  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name = ANY($1)
      ORDER BY table_name
    `, [expectedTables]);

    const existingTables = result.rows.map(row => row.table_name);
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      console.error('✗ Missing tables:', missingTables.join(', '));
      return false;
    }

    console.log('✓ All expected tables exist:');
    existingTables.forEach(table => console.log(`  - ${table}`));
    
    return true;
  } catch (error) {
    console.error('✗ Schema verification failed:', error);
    return false;
  }
}

/**
 * CLI interface for running migrations
 */
async function main() {
  const command = process.argv[2];

  // Load database configuration from environment
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'children_english_learning',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    switch (command) {
      case 'up':
        await runMigrations(pool);
        await verifySchema(pool);
        break;

      case 'down':
        await rollbackMigrations(pool);
        break;

      case 'verify':
        const isValid = await verifySchema(pool);
        process.exit(isValid ? 0 : 1);
        break;

      default:
        console.log('Usage: ts-node src/database/migrate.ts [up|down|verify]');
        console.log('');
        console.log('Commands:');
        console.log('  up      - Run all migrations');
        console.log('  down    - Rollback all migrations');
        console.log('  verify  - Verify database schema');
        process.exit(1);
    }
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main();
}
