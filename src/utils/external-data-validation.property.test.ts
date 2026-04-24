import fc from 'fast-check';
import { validateExternalData, validateTranslationResponse, validateImageResponse, validateURL } from './validation';
import { ValidationError } from './errors';

/**
 * Property-Based Tests for External Data Validation
 * Feature: children-english-learning-platform, Property 22: 外部数据验证
 * **Validates: Requirements 15.5**
 * 
 * Tests that arbitrary external API data is properly validated before use
 */
describe('External Data Validation - Property Tests', () => {
  /**
   * Property 22: 外部数据验证
   * 对于任意从外部API接收的数据，应该经过验证（类型检查、格式验证、长度限制）
   */
  it('should validate external data structure with required fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string(),
          age: fc.integer(),
          email: fc.string(),
        }),
        (data) => {
          const expectedFields = [
            { field: 'name', type: 'string', required: true },
            { field: 'age', type: 'number', required: true },
            { field: 'email', type: 'string', required: true },
          ];

          // Should pass validation for correct structure
          expect(() => validateExternalData(data, expectedFields)).not.toThrow();
          expect(validateExternalData(data, expectedFields)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject external data with missing required fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string(),
          // Missing 'age' field
        }),
        (data) => {
          const expectedFields = [
            { field: 'name', type: 'string', required: true },
            { field: 'age', type: 'number', required: true },
          ];

          // Should throw ValidationError for missing required field
          expect(() => validateExternalData(data, expectedFields)).toThrow(ValidationError);
          expect(() => validateExternalData(data, expectedFields)).toThrow('外部数据缺少必需字段');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject external data with wrong field types', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.integer(), // Wrong type - should be string
          age: fc.integer(),
        }),
        (data) => {
          const expectedFields = [
            { field: 'name', type: 'string', required: true },
            { field: 'age', type: 'number', required: true },
          ];

          // Should throw ValidationError for wrong type
          expect(() => validateExternalData(data, expectedFields)).toThrow(ValidationError);
          expect(() => validateExternalData(data, expectedFields)).toThrow('外部数据字段类型错误');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate translation API responses', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        (translation) => {
          // Valid translation string (non-empty after trim)
          expect(() => validateTranslationResponse(translation)).not.toThrow();
          expect(validateTranslationResponse(translation)).toBe(true);

          // Valid translation array
          expect(() => validateTranslationResponse([translation])).not.toThrow();
          expect(validateTranslationResponse([translation])).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject invalid translation responses', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(''),
          fc.constant([]),
          fc.integer(),
          fc.record({}),
          fc.string({ minLength: 201, maxLength: 500 }), // Too long
        ),
        (invalidResponse) => {
          // Should throw ValidationError for invalid responses
          expect(() => validateTranslationResponse(invalidResponse)).toThrow(ValidationError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate image URL responses', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (imageUrl) => {
          // Valid image URL
          expect(() => validateImageResponse(imageUrl)).not.toThrow();
          expect(validateImageResponse(imageUrl)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject invalid image URL responses', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(''),
          fc.integer(),
          fc.record({}),
          fc.constant('not-a-url'),
          fc.constant('ftp://invalid-protocol.com/image.jpg'),
          fc.string({ minLength: 2049, maxLength: 3000 }), // Too long
        ),
        (invalidUrl) => {
          // Should throw ValidationError for invalid URLs
          expect(() => validateImageResponse(invalidUrl)).toThrow(ValidationError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate URL format and protocol', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (url) => {
          // Valid HTTP/HTTPS URLs should pass
          expect(() => validateURL(url)).not.toThrow();
          expect(validateURL(url)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject non-HTTP/HTTPS protocols', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ftp', 'file', 'data', 'javascript'),
        fc.string({ minLength: 5, maxLength: 20 }),
        (protocol, path) => {
          const url = `${protocol}://${path}`;
          
          // Should throw ValidationError for non-HTTP/HTTPS protocols
          expect(() => validateURL(url)).toThrow(ValidationError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle optional fields in external data', () => {
    fc.assert(
      fc.property(
        fc.record({
          required: fc.string(),
          // optional field may or may not be present
        }),
        (data) => {
          const expectedFields = [
            { field: 'required', type: 'string', required: true },
            { field: 'optional', type: 'string', required: false },
          ];

          // Should pass validation even without optional field
          expect(() => validateExternalData(data, expectedFields)).not.toThrow();
          expect(validateExternalData(data, expectedFields)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate optional fields when present', () => {
    fc.assert(
      fc.property(
        fc.record({
          required: fc.string(),
          optional: fc.integer(), // Wrong type for optional field
        }),
        (data) => {
          const expectedFields = [
            { field: 'required', type: 'string', required: true },
            { field: 'optional', type: 'string', required: false },
          ];

          // Should throw ValidationError for wrong type even in optional field
          expect(() => validateExternalData(data, expectedFields)).toThrow(ValidationError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject non-object external data', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.integer(),
          fc.boolean(),
        ),
        (invalidData) => {
          const expectedFields = [{ field: 'test', type: 'string', required: true }];

          // Should throw ValidationError for non-object data
          expect(() => validateExternalData(invalidData, expectedFields)).toThrow(ValidationError);
          expect(() => validateExternalData(invalidData, expectedFields)).toThrow('外部数据格式无效');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle null and undefined field values correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined),
        (nullishValue) => {
          const data = { field: nullishValue };
          const expectedFields = [{ field: 'field', type: 'string', required: false }];

          // Should not throw for null/undefined optional fields
          expect(() => validateExternalData(data, expectedFields)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
