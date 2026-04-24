import { ValidationError } from './errors';

/**
 * Validates that a word contains only letters and spaces
 * @param word - The word to validate
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateWordInput(word: string): boolean {
  if (!word || word.trim().length === 0) {
    throw new ValidationError('单词不能为空');
  }

  if (word.length > 50) {
    throw new ValidationError('单词长度不能超过50个字符');
  }

  const validPattern = /^[a-zA-Z ]+$/;
  if (!validPattern.test(word)) {
    throw new ValidationError('单词只能包含字母和空格');
  }

  return true;
}

/**
 * Validates username format
 * @param username - The username to validate
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateUsername(username: string): boolean {
  if (!username || username.length < 3 || username.length > 20) {
    throw new ValidationError('用户名长度必须在3-20个字符之间');
  }

  const validPattern = /^[a-zA-Z0-9_]+$/;
  if (!validPattern.test(username)) {
    throw new ValidationError('用户名只能包含字母、数字和下划线');
  }

  return true;
}

/**
 * Validates password strength
 * @param password - The password to validate
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validatePassword(password: string): boolean {
  if (!password || password.length < 6) {
    throw new ValidationError('密码长度至少为6个字符');
  }

  return true;
}

/**
 * Validates UUID format
 * Requirements: 15.4
 * @param id - The ID to validate
 * @param fieldName - Name of the field for error message
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateUUID(id: string, fieldName: string = 'ID'): boolean {
  if (!id || id.trim().length === 0) {
    throw new ValidationError(`${fieldName}不能为空`);
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(id)) {
    throw new ValidationError(`${fieldName}格式无效`);
  }

  return true;
}

/**
 * Validates URL format
 * Requirements: 15.5
 * @param url - The URL to validate
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateURL(url: string): boolean {
  if (!url || url.trim().length === 0) {
    throw new ValidationError('URL不能为空');
  }

  try {
    const urlObj = new URL(url);
    // Only allow http and https protocols
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      throw new ValidationError('URL必须使用HTTP或HTTPS协议');
    }
    return true;
  } catch {
    throw new ValidationError('URL格式无效');
  }
}

/**
 * Sanitizes user input to prevent SQL injection
 * This function is a safety net, but parameterized queries should always be used
 * Requirements: 15.4
 * @param input - The input to sanitize
 * @returns Sanitized input
 */
export function sanitizeInput(input: string): string {
  if (!input) return input;
  
  // Remove SQL special characters that could be used for injection
  // Note: This is a defense-in-depth measure. Always use parameterized queries!
  return input.replace(/[;'"\\]/g, '');
}

/**
 * Validates that input doesn't contain SQL injection patterns
 * Requirements: 15.4
 * @param input - The input to check
 * @returns true if safe
 * @throws ValidationError if potentially dangerous
 */
export function checkSQLInjection(input: string): boolean {
  if (!input) return true;

  // Check for common SQL injection patterns
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--)/,  // SQL comments
    /(\*\/|\/\*)/,  // Block comments
    /(\bOR\b\s*['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/i,  // OR 1=1 patterns
    /(['"]?\s*OR\s*['"]?\d+['"]?\s*=\s*['"]?\d+)/i,  // ' OR '1'='1 patterns
    /(\bUNION\b.*\bSELECT\b)/i,  // UNION SELECT
    /(;\s*\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b)/i,  // Multiple statements
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      throw new ValidationError('输入包含不允许的字符或模式');
    }
  }

  return true;
}

/**
 * Validates external API response data
 * Requirements: 15.5
 * @param data - The data to validate
 * @param expectedFields - Expected fields in the data
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateExternalData(
  data: any,
  expectedFields: { field: string; type: string; required?: boolean }[]
): boolean {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('外部数据格式无效');
  }

  for (const { field, type, required = true } of expectedFields) {
    if (required && !(field in data)) {
      throw new ValidationError(`外部数据缺少必需字段: ${field}`);
    }

    if (field in data && data[field] !== null && data[field] !== undefined) {
      const actualType = typeof data[field];
      if (actualType !== type) {
        throw new ValidationError(
          `外部数据字段类型错误: ${field} (期望 ${type}, 实际 ${actualType})`
        );
      }
    }
  }

  return true;
}

/**
 * Validates translation API response
 * Requirements: 15.5
 * @param response - The API response to validate
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateTranslationResponse(response: any): boolean {
  if (!response) {
    throw new ValidationError('翻译API返回空响应');
  }

  // Validate response structure
  if (typeof response !== 'string' && !Array.isArray(response)) {
    throw new ValidationError('翻译API响应格式无效');
  }

  // If array, check first element
  const translation = Array.isArray(response) ? response[0] : response;

  if (typeof translation !== 'string') {
    throw new ValidationError('翻译结果必须是字符串');
  }

  if (translation.trim().length === 0) {
    throw new ValidationError('翻译结果不能为空');
  }

  if (translation.length > 200) {
    throw new ValidationError('翻译结果长度异常');
  }

  return true;
}

/**
 * Validates image API response
 * Requirements: 15.5
 * @param imageUrl - The image URL to validate
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateImageResponse(imageUrl: any): boolean {
  if (!imageUrl) {
    throw new ValidationError('图像API返回空响应');
  }

  if (typeof imageUrl !== 'string') {
    throw new ValidationError('图像URL必须是字符串');
  }

  // Validate URL format
  validateURL(imageUrl);

  // Check URL length
  if (imageUrl.length > 2048) {
    throw new ValidationError('图像URL长度异常');
  }

  return true;
}
