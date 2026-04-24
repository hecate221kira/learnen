# Authentication System Manual Test Guide

## Prerequisites
1. Ensure PostgreSQL is running
2. Run database migrations: `npm run migrate:up`
3. Start the server: `npm run dev`

## Test Scenarios

### 1. User Registration

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123",
    "email": "test@example.com"
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "uuid-here",
  "user": {
    "id": "uuid-here",
    "username": "testuser"
  }
}
```

### 2. User Registration - Invalid Username (Too Short)

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "ab",
    "password": "password123"
  }'
```

**Expected Response (400):**
```json
{
  "error": "用户名长度必须在3-20个字符之间",
  "code": "VALIDATION_ERROR",
  "retryable": false,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-..."
}
```

### 3. User Registration - Duplicate Username

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

**Expected Response (409):**
```json
{
  "error": "用户名已存在",
  "code": "CONFLICT",
  "retryable": false,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-..."
}
```

### 4. User Login - Valid Credentials

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "username": "testuser"
  }
}
```

### 5. User Login - Invalid Credentials

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "wrongpassword"
  }'
```

**Expected Response (401):**
```json
{
  "error": "用户名或密码错误",
  "code": "UNAUTHORIZED",
  "retryable": false,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-..."
}
```

### 6. Token Verification - Valid Token

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response (200):**
```json
{
  "valid": true,
  "userId": "uuid-here",
  "username": "testuser"
}
```

### 7. Token Verification - Missing Token

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/verify
```

**Expected Response (401):**
```json
{
  "error": "请提供认证令牌",
  "code": "UNAUTHORIZED",
  "retryable": false,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-..."
}
```

### 8. Token Verification - Invalid Token

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer invalid_token"
```

**Expected Response (401):**
```json
{
  "error": "令牌无效或已过期",
  "code": "UNAUTHORIZED",
  "retryable": false,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-..."
}
```

### 9. Logout

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/logout
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "登出成功"
}
```

## Verification Checklist

- [ ] User can register with valid credentials
- [ ] Registration rejects invalid username (too short/long, invalid characters)
- [ ] Registration rejects invalid password (too short)
- [ ] Registration rejects duplicate username
- [ ] Password is hashed in database (not stored as plaintext)
- [ ] User can login with valid credentials
- [ ] Login rejects invalid credentials
- [ ] JWT token is generated with 7-day expiration
- [ ] JWT token can be verified successfully
- [ ] Invalid/expired tokens are rejected
- [ ] Protected routes require valid token
- [ ] Error messages are in Chinese
- [ ] Error responses follow standard format
