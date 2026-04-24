import fc from 'fast-check';
import { checkSQLInjection, sanitizeInput } from './validation';
import { ValidationError } from './errors';

/**
 * Property-Based Tests for SQL Injection Protection
 * Feature: children-english-learning-platform, Property 21: SQL注入防护
 * **Validates: Requirements 15.4**
 * 
 * Tests that arbitrary input containing SQL special characters is properly validated and sanitized
 */
describe('SQL Injection Protection - Property Tests', () => {
  /**
   * Property 21: SQL注入防护
   * 对于任意包含SQL特殊字符的输入，系统应该正确检测并拒绝或清理
   */
  it('should detect and reject SQL injection patterns', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // SQL keywords
          fc.constantFrom('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER'),
          // SQL comments
          fc.constantFrom('--', '/*', '*/', '/* comment */'),
          // OR patterns
          fc.constantFrom("' OR '1'='1", "' OR 1=1--", '" OR "1"="1'),
          // UNION patterns
          fc.constantFrom("' UNION SELECT", "' UNION ALL SELECT"),
          // Multiple statements
          fc.constantFrom("'; DROP TABLE users--", "'; DELETE FROM words--"),
          // Combinations
          fc.string().map(s => `${s}; SELECT * FROM users`),
          fc.string().map(s => `${s}' OR '1'='1`),
        ),
        (maliciousInput) => {
          // Should throw ValidationError for dangerous patterns
          expect(() => checkSQLInjection(maliciousInput)).toThrow(ValidationError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow safe input without SQL patterns', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Safe words (only letters and spaces)
          fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', ' '), { minLength: 1, maxLength: 50 }),
          // Numbers
          fc.integer().map(n => n.toString()),
          // Safe special characters (no SQL-related ones)
          fc.stringOf(fc.constantFrom('a', 'b', 'c', '1', '2', '3', '_', '@', '#', '$', '%'), { minLength: 1, maxLength: 50 }),
        ),
        (safeInput) => {
          // Should not throw for safe input
          expect(() => checkSQLInjection(safeInput)).not.toThrow();
          expect(checkSQLInjection(safeInput)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sanitize SQL special characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (input) => {
          const sanitized = sanitizeInput(input);
          
          // Sanitized output should not contain dangerous characters
          expect(sanitized).not.toContain(';');
          expect(sanitized).not.toContain("'");
          expect(sanitized).not.toContain('"');
          expect(sanitized).not.toContain('\\');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve safe characters during sanitization', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', '1', '2', '3', ' ', '_', '-'), { minLength: 1, maxLength: 50 }),
        (safeInput) => {
          const sanitized = sanitizeInput(safeInput);
          
          // Safe input should remain unchanged
          expect(sanitized).toBe(safeInput);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty and null inputs safely', () => {
    expect(() => checkSQLInjection('')).not.toThrow();
    expect(checkSQLInjection('')).toBe(true);
    
    expect(sanitizeInput('')).toBe('');
    expect(sanitizeInput(null as any)).toBe(null);
    expect(sanitizeInput(undefined as any)).toBe(undefined);
  });

  it('should detect case-insensitive SQL keywords', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('select', 'SELECT', 'SeLeCt', 'insert', 'INSERT', 'InSeRt'),
        fc.string({ maxLength: 20 }),
        (keyword, suffix) => {
          const input = `${keyword} ${suffix}`;
          
          // Should detect SQL keywords regardless of case
          expect(() => checkSQLInjection(input)).toThrow(ValidationError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect SQL injection in various positions', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 20 }),
        fc.constantFrom("' OR '1'='1", "; DROP TABLE", "-- comment"),
        fc.string({ maxLength: 20 }),
        (prefix, injection, suffix) => {
          const input = `${prefix}${injection}${suffix}`;
          
          // Should detect injection regardless of position
          expect(() => checkSQLInjection(input)).toThrow(ValidationError);
        }
      ),
      { numRuns: 100 }
    );
  });
});
