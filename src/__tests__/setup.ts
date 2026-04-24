/**
 * Test Setup File
 * Configures test environment and global settings
 */

// Load environment variables from .env file FIRST
import dotenv from 'dotenv';
dotenv.config();

// Set test environment
process.env.NODE_ENV = 'test';

// Set test database (if different from development)
if (!process.env.DB_NAME) {
  process.env.DB_NAME = 'english_learning_test';
}

// Set shorter timeouts for tests
process.env.TRANSLATION_TIMEOUT = '5000';
process.env.IMAGE_TIMEOUT = '5000';
process.env.DB_QUERY_TIMEOUT = '10000';

// Increase Jest timeout for integration tests
jest.setTimeout(30000);

// Add a simple test to satisfy Jest requirement
describe('Test Setup', () => {
  it('should configure test environment correctly', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.DB_NAME).toBe('english_learning_test');
    expect(process.env.TRANSLATION_TIMEOUT).toBe('5000');
    expect(process.env.IMAGE_TIMEOUT).toBe('5000');
    expect(process.env.DB_QUERY_TIMEOUT).toBe('10000');
  });
});
