# API 文档 / API Documentation

## 概述 / Overview

儿童英语学习平台 RESTful API 文档。本 API 提供用户认证、单词学习、复习系统和测验功能。

Children's English Learning Platform RESTful API Documentation. This API provides user authentication, word learning, review system, and quiz functionality.

**Base URL**: `http://localhost:3000/api`

**认证方式 / Authentication**: JWT Bearer Token

---

## 目录 / Table of Contents

1. [认证 API / Authentication API](#认证-api--authentication-api)
2. [单词学习 API / Word Learning API](#单词学习-api--word-learning-api)
3. [复习系统 API / Review System API](#复习系统-api--review-system-api)
4. [测验 API / Quiz API](#测验-api--quiz-api)
5. [错误代码 / Error Codes](#错误代码--error-codes)

---

## 认证 API / Authentication API

### 1. 用户注册 / Register User

注册新用户账户。

**端点 / Endpoint**: `POST /api/auth/register`

**访问权限 / Access**: Public

**请求体 / Request Body**:

```json
{
  "username": "string",  // 3-20 字符，字母数字下划线 / 3-20 chars, alphanumeric + underscore
  "password": "string",  // 最少 6 字符 / minimum 6 chars
  "email": "string"      // 可选 / optional
}
```

**成功响应 / Success Response** (201 Created):

```json
{
  "success": true,
  "userId": "uuid",
  "token": "jwt_token_string",
  "user": {
    "id": "uuid",
    "username": "string"
  }
}
```

**错误响应示例 / Error Response Examples**:

```json
// 400 Bad Request - 用户名已存在 / Username already exists
{
  "error": "用户名已存在",
  "code": "CONFLICT",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}

// 400 Bad Request - 验证失败 / Validation failed
{
  "error": "用户名必须在3到20个字符之间",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}
```

**需求 / Requirements**: 1.1, 15.3

---

### 2. 用户登录 / Login User

用户登录并获取 JWT 令牌。

**端点 / Endpoint**: `POST /api/auth/login`

**访问权限 / Access**: Public

**请求体 / Request Body**:

```json
{
  "username": "string",
  "password": "string"
}
```

**成功响应 / Success Response** (200 OK):

```json
{
  "success": true,
  "token": "jwt_token_string",
  "user": {
    "id": "uuid",
    "username": "string"
  }
}
```

**错误响应示例 / Error Response Examples**:

```json
// 401 Unauthorized - 凭证无效 / Invalid credentials
{
  "error": "用户名或密码错误",
  "code": "UNAUTHORIZED",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}
```

**需求 / Requirements**: 1.1, 1.2

---

### 3. 用户登出 / Logout User

用户登出（客户端应删除 JWT 令牌）。

**端点 / Endpoint**: `POST /api/auth/logout`

**访问权限 / Access**: Public

**请求体 / Request Body**: 无 / None

**成功响应 / Success Response** (200 OK):

```json
{
  "success": true,
  "message": "登出成功"
}
```

**需求 / Requirements**: 1.4

---

### 4. 验证令牌 / Verify Token

验证 JWT 令牌是否有效。

**端点 / Endpoint**: `GET /api/auth/verify`

**访问权限 / Access**: Protected (需要 JWT 令牌 / Requires JWT token)

**请求头 / Request Headers**:

```
Authorization: Bearer <jwt_token>
```

**成功响应 / Success Response** (200 OK):

```json
{
  "valid": true,
  "userId": "uuid",
  "username": "string"
}
```

**错误响应示例 / Error Response Examples**:

```json
// 401 Unauthorized - 令牌无效或过期 / Invalid or expired token
{
  "error": "令牌无效或已过期",
  "code": "UNAUTHORIZED",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}
```

**需求 / Requirements**: 1.3

---

## 单词学习 API / Word Learning API

### 5. 翻译单词 / Translate Word

翻译英语单词为中文并获取相关图像。

**端点 / Endpoint**: `POST /api/words/translate`

**访问权限 / Access**: Protected (需要 JWT 令牌 / Requires JWT token)

**请求头 / Request Headers**:

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**请求体 / Request Body**:

```json
{
  "word": "string"  // 1-50 字符，仅字母和空格 / 1-50 chars, letters and spaces only
}
```

**成功响应 / Success Response** (200 OK):

```json
{
  "success": true,
  "word": "apple",
  "translation": "苹果",
  "imageUrl": "https://example.com/image.jpg"
}
```

**错误响应示例 / Error Response Examples**:

```json
// 400 Bad Request - 无效输入 / Invalid input
{
  "error": "单词只能包含字母和空格",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}

// 502 Bad Gateway - 翻译服务错误 / Translation service error
{
  "error": "翻译服务暂时不可用，请稍后重试",
  "code": "EXTERNAL_SERVICE_ERROR",
  "retryable": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}

// 504 Gateway Timeout - 请求超时 / Request timeout
{
  "error": "请求超时，请重试",
  "code": "TIMEOUT_ERROR",
  "retryable": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}
```

**需求 / Requirements**: 2.1, 2.2, 2.4, 3.1, 3.4, 15.1, 15.2

---

### 6. 保存单词 / Save Word

保存单词、翻译和图像，并创建复习计划。

**端点 / Endpoint**: `POST /api/words/save`

**访问权限 / Access**: Protected (需要 JWT 令牌 / Requires JWT token)

**请求头 / Request Headers**:

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**请求体 / Request Body**:

```json
{
  "word": "string",
  "translation": "string",
  "imageUrl": "string"
}
```

**成功响应 / Success Response** (201 Created):

```json
{
  "success": true,
  "wordId": "uuid",
  "reviewSchedule": [
    "2024-01-16T00:00:00.000Z",  // +1 天 / +1 day
    "2024-01-18T00:00:00.000Z",  // +3 天 / +3 days
    "2024-01-22T00:00:00.000Z",  // +7 天 / +7 days
    "2024-01-30T00:00:00.000Z",  // +15 天 / +15 days
    "2024-02-14T00:00:00.000Z"   // +30 天 / +30 days
  ]
}
```

**错误响应示例 / Error Response Examples**:

```json
// 400 Bad Request - 缺少必需字段 / Missing required fields
{
  "error": "单词、翻译和图像URL都是必需的",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}

// 500 Internal Server Error - 数据库错误 / Database error
{
  "error": "数据库操作失败，请重试",
  "code": "DATABASE_ERROR",
  "retryable": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}
```

**需求 / Requirements**: 4.1, 4.2, 4.3, 4.4

---

## 复习系统 API / Review System API

### 7. 获取到期复习 / Get Due Reviews

获取当前用户到期需要复习的单词列表。

**端点 / Endpoint**: `GET /api/reviews/due`

**访问权限 / Access**: Protected (需要 JWT 令牌 / Requires JWT token)

**请求头 / Request Headers**:

```
Authorization: Bearer <jwt_token>
```

**查询参数 / Query Parameters**:

- `limit` (可选 / optional): 返回的单词数量，1-20 之间，默认 20 / Number of words to return, between 1-20, default 20

**请求示例 / Request Example**:

```
GET /api/reviews/due?limit=10
```

**成功响应 / Success Response** (200 OK):

```json
{
  "success": true,
  "reviews": [
    {
      "scheduleId": "uuid",
      "wordId": "uuid",
      "word": "apple",
      "translation": "苹果",
      "imageUrl": "https://example.com/image.jpg",
      "dueDate": "2024-01-15T00:00:00.000Z",
      "intervalDays": 1
    }
  ],
  "totalDue": 1
}
```

**空结果响应 / Empty Result Response** (200 OK):

```json
{
  "success": true,
  "reviews": [],
  "totalDue": 0
}
```

**错误响应示例 / Error Response Examples**:

```json
// 400 Bad Request - 无效的限制参数 / Invalid limit parameter
{
  "error": "限制必须在1到20之间",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}
```

**需求 / Requirements**: 6.1, 6.2, 6.3, 6.4

---

### 8. 完成复习 / Complete Review

记录复习结果并更新复习计划。

**端点 / Endpoint**: `POST /api/reviews/complete`

**访问权限 / Access**: Protected (需要 JWT 令牌 / Requires JWT token)

**请求头 / Request Headers**:

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**请求体 / Request Body**:

```json
{
  "scheduleId": "string",      // 复习计划 ID / Review schedule ID
  "correct": boolean,          // 是否回答正确 / Whether answer is correct
  "responseTimeMs": number     // 可选，响应时间（毫秒）/ Optional, response time in milliseconds
}
```

**成功响应 / Success Response** (200 OK):

```json
{
  "success": true,
  "nextReviewDate": "2024-01-18T00:00:00.000Z",  // 下次复习日期 / Next review date
  "attemptId": "uuid"                             // 复习尝试记录 ID / Review attempt record ID
}
```

**错误响应示例 / Error Response Examples**:

```json
// 400 Bad Request - 缺少必需字段 / Missing required fields
{
  "error": "复习计划ID是必需的",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}

// 404 Not Found - 复习计划不存在 / Review schedule not found
{
  "error": "复习计划不存在",
  "code": "NOT_FOUND",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}
```

**需求 / Requirements**: 5.4, 5.5, 9.1, 9.2, 9.3, 9.4

---

## 测验 API / Quiz API

### 9. 生成测验 / Generate Quiz

为到期的单词生成测验题目。

**端点 / Endpoint**: `GET /api/quiz/generate`

**访问权限 / Access**: Protected (需要 JWT 令牌 / Requires JWT token)

**请求头 / Request Headers**:

```
Authorization: Bearer <jwt_token>
```

**查询参数 / Query Parameters**:

- `limit` (可选 / optional): 生成的题目数量，1-20 之间，默认 20 / Number of questions to generate, between 1-20, default 20

**请求示例 / Request Example**:

```
GET /api/quiz/generate?limit=5
```

**成功响应 / Success Response** (200 OK):

```json
{
  "success": true,
  "questions": [
    {
      "questionId": "uuid",
      "word": "apple",
      "translation": "苹果",
      "options": [
        {
          "imageUrl": "https://example.com/apple.jpg",
          "isCorrect": true
        },
        {
          "imageUrl": "https://example.com/banana.jpg",
          "isCorrect": false
        },
        {
          "imageUrl": "https://example.com/orange.jpg",
          "isCorrect": false
        },
        {
          "imageUrl": "https://example.com/grape.jpg",
          "isCorrect": false
        }
      ]
    }
  ]
}
```

**无到期单词响应 / No Due Words Response** (200 OK):

```json
{
  "success": true,
  "questions": [],
  "message": "当前没有需要复习的单词"
}
```

**错误响应示例 / Error Response Examples**:

```json
// 400 Bad Request - 无效的限制参数 / Invalid limit parameter
{
  "error": "限制必须在1到20之间",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}
```

**需求 / Requirements**: 6.5, 7.1, 7.2, 7.3, 7.4, 7.5

---

### 10. 回答测验 / Answer Quiz

验证测验答案并记录结果。

**端点 / Endpoint**: `POST /api/quiz/answer`

**访问权限 / Access**: Protected (需要 JWT 令牌 / Requires JWT token)

**请求头 / Request Headers**:

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**请求体 / Request Body**:

```json
{
  "questionId": "string",         // 问题 ID / Question ID
  "selectedImageUrl": "string",   // 用户选择的图像 URL / User selected image URL
  "scheduleId": "string",         // 复习计划 ID / Review schedule ID
  "responseTimeMs": number        // 可选，响应时间（毫秒）/ Optional, response time in milliseconds
}
```

**成功响应 / Success Response** (200 OK):

```json
{
  "success": true,
  "correct": true,                                    // 是否回答正确 / Whether answer is correct
  "correctImageUrl": "https://example.com/apple.jpg", // 正确答案的图像 URL / Correct answer image URL
  "nextReviewDate": "2024-01-18T00:00:00.000Z",      // 下次复习日期 / Next review date
  "explanation": "回答正确！继续保持！"                 // 反馈消息 / Feedback message
}
```

**错误答案响应 / Incorrect Answer Response** (200 OK):

```json
{
  "success": true,
  "correct": false,
  "correctImageUrl": "https://example.com/apple.jpg",
  "nextReviewDate": "2024-01-16T00:00:00.000Z",      // 1天后重新复习 / Review again in 1 day
  "explanation": "回答错误。正确答案已显示。"
}
```

**错误响应示例 / Error Response Examples**:

```json
// 400 Bad Request - 缺少必需字段 / Missing required fields
{
  "error": "问题ID是必需的",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}

// 404 Not Found - 问题不存在 / Question not found
{
  "error": "问题不存在或已过期",
  "code": "NOT_FOUND",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}
```

**需求 / Requirements**: 8.1, 8.2, 8.3, 8.4

---

## 错误代码 / Error Codes

所有错误响应遵循统一格式：

All error responses follow a unified format:

```json
{
  "error": "string",        // 用户友好的中文错误消息 / User-friendly Chinese error message
  "code": "string",         // 错误代码 / Error code
  "details": "any",         // 可选，详细信息（仅开发环境）/ Optional, details (dev only)
  "retryable": boolean,     // 可选，是否可重试 / Optional, whether retryable
  "timestamp": "string",    // ISO 8601 时间戳 / ISO 8601 timestamp
  "requestId": "string"     // 请求 ID（用于追踪）/ Request ID (for tracking)
}
```

### 错误代码列表 / Error Code List

| 错误代码 / Code | HTTP 状态码 / Status | 描述 / Description | 可重试 / Retryable |
|----------------|---------------------|-------------------|-------------------|
| `VALIDATION_ERROR` | 400 | 验证错误，输入不符合要求 / Validation error, input doesn't meet requirements | ❌ |
| `UNAUTHORIZED` | 401 | 未授权，需要登录或令牌无效 / Unauthorized, login required or invalid token | ❌ |
| `FORBIDDEN` | 403 | 禁止访问，没有权限 / Forbidden, no permission | ❌ |
| `NOT_FOUND` | 404 | 资源不存在 / Resource not found | ❌ |
| `CONFLICT` | 409 | 冲突，如用户名已存在 / Conflict, e.g., username already exists | ❌ |
| `DATABASE_ERROR` | 500 | 数据库操作失败 / Database operation failed | ✅ |
| `INTERNAL_ERROR` | 500 | 系统内部错误 / Internal system error | ✅ |
| `EXTERNAL_SERVICE_ERROR` | 502 | 外部服务错误（翻译、图像 API）/ External service error (translation, image API) | ✅ |
| `TIMEOUT_ERROR` | 504 | 请求超时 / Request timeout | ✅ |

### 常见错误消息 / Common Error Messages

#### 认证相关 / Authentication Related

- `用户名或密码错误` - Invalid username or password
- `令牌无效或已过期` - Invalid or expired token
- `请先登录` - Please login first
- `用户名已存在` - Username already exists
- `用户名必须在3到20个字符之间` - Username must be between 3 and 20 characters

#### 验证相关 / Validation Related

- `单词不能为空` - Word cannot be empty
- `单词只能包含字母和空格` - Word can only contain letters and spaces
- `单词长度不能超过50个字符` - Word length cannot exceed 50 characters
- `单词、翻译和图像URL都是必需的` - Word, translation, and image URL are all required
- `限制必须在1到20之间` - Limit must be between 1 and 20

#### 服务相关 / Service Related

- `翻译服务暂时不可用，请稍后重试` - Translation service temporarily unavailable, please try again later
- `图像服务暂时不可用，请稍后重试` - Image service temporarily unavailable, please try again later
- `请求超时，请重试` - Request timeout, please retry
- `数据库操作失败，请重试` - Database operation failed, please retry

#### 业务逻辑相关 / Business Logic Related

- `当前没有需要复习的单词` - No words currently need review
- `复习计划不存在` - Review schedule does not exist
- `问题不存在或已过期` - Question does not exist or has expired

---

## 认证流程 / Authentication Flow

1. **注册 / Register**: `POST /api/auth/register` → 获取 JWT 令牌 / Get JWT token
2. **登录 / Login**: `POST /api/auth/login` → 获取 JWT 令牌 / Get JWT token
3. **使用令牌 / Use Token**: 在所有受保护的端点请求头中包含 `Authorization: Bearer <token>` / Include `Authorization: Bearer <token>` in all protected endpoint request headers
4. **验证令牌 / Verify Token**: `GET /api/auth/verify` → 检查令牌是否有效 / Check if token is valid
5. **登出 / Logout**: `POST /api/auth/logout` → 客户端删除令牌 / Client deletes token

---

## 学习流程 / Learning Flow

1. **翻译单词 / Translate Word**: `POST /api/words/translate` → 获取翻译和图像 / Get translation and image
2. **确认保存 / Confirm Save**: `POST /api/words/save` → 保存单词并创建复习计划 / Save word and create review schedule
3. **获取到期复习 / Get Due Reviews**: `GET /api/reviews/due` → 查看需要复习的单词 / View words that need review
4. **生成测验 / Generate Quiz**: `GET /api/quiz/generate` → 获取测验题目 / Get quiz questions
5. **回答测验 / Answer Quiz**: `POST /api/quiz/answer` → 提交答案并更新复习计划 / Submit answer and update review schedule

---

## 复习间隔算法 / Review Interval Algorithm

基于艾宾浩斯遗忘曲线的间隔重复算法：

Spaced repetition algorithm based on Ebbinghaus forgetting curve:

- **初始复习计划 / Initial Review Schedule**: 1天、3天、7天、15天、30天 / 1 day, 3 days, 7 days, 15 days, 30 days
- **回答正确 / Correct Answer**: 进入下一个间隔（3→7→15→30→60→90天）/ Move to next interval (3→7→15→30→60→90 days)
- **回答错误 / Incorrect Answer**: 1天后重新复习 / Review again in 1 day
- **最大间隔 / Maximum Interval**: 90天 / 90 days

---

## 速率限制 / Rate Limiting

**注意 / Note**: 当前版本未实现速率限制。生产环境建议配置。

Current version does not implement rate limiting. Configuration recommended for production environment.

**建议配置 / Recommended Configuration**:
- 认证端点 / Auth endpoints: 5 次/分钟 / 5 requests per minute
- 其他端点 / Other endpoints: 60 次/分钟 / 60 requests per minute

---

## 健康检查 / Health Check

**端点 / Endpoint**: `GET /health`

**访问权限 / Access**: Public

**成功响应 / Success Response** (200 OK):

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 版本信息 / Version Information

- **API 版本 / API Version**: 1.0.0
- **最后更新 / Last Updated**: 2024-01-15
- **文档版本 / Documentation Version**: 1.0.0

---

## 联系方式 / Contact

如有问题或建议，请联系开发团队。

For questions or suggestions, please contact the development team.
