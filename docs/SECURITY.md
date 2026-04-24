# 安全配置指南 / Security Configuration Guide

## 概述 / Overview

本文档描述儿童英语学习平台的安全配置和最佳实践。

This document describes security configuration and best practices for the Children's English Learning Platform.

---

## 目录 / Table of Contents

1. [安全功能 / Security Features](#安全功能--security-features)
2. [HTTPS 配置 / HTTPS Configuration](#https-配置--https-configuration)
3. [CORS 策略 / CORS Policy](#cors-策略--cors-policy)
4. [速率限制 / Rate Limiting](#速率限制--rate-limiting)
5. [安全头 / Security Headers](#安全头--security-headers)
6. [日志轮转 / Log Rotation](#日志轮转--log-rotation)
7. [安全检查清单 / Security Checklist](#安全检查清单--security-checklist)

---

## 安全功能 / Security Features

平台实现了以下安全功能：

The platform implements the following security features:

### 1. 认证和授权 / Authentication and Authorization

- **JWT 令牌认证 / JWT Token Authentication**: 无状态会话管理 / Stateless session management
- **密码哈希 / Password Hashing**: Bcrypt 加密存储 / Bcrypt encrypted storage
- **令牌过期 / Token Expiration**: 7 天自动过期 / 7-day automatic expiration
- **用户数据隔离 / User Data Isolation**: 每个用户只能访问自己的数据 / Each user can only access their own data

### 2. 输入验证 / Input Validation

- **字符验证 / Character Validation**: 仅允许字母和空格 / Only letters and spaces allowed
- **长度限制 / Length Limits**: 单词最多 50 字符 / Words max 50 characters
- **SQL 注入防护 / SQL Injection Protection**: 参数化查询 / Parameterized queries
- **XSS 防护 / XSS Protection**: 输入清理和转义 / Input sanitization and escaping

### 3. 网络安全 / Network Security

- **HTTPS 强制 / HTTPS Enforcement**: 生产环境强制 HTTPS / Force HTTPS in production
- **CORS 配置 / CORS Configuration**: 限制跨域访问 / Restrict cross-origin access
- **速率限制 / Rate Limiting**: 防止暴力攻击 / Prevent brute force attacks
- **请求大小限制 / Request Size Limit**: 防止大负载攻击 / Prevent large payload attacks

### 4. 数据安全 / Data Security

- **加密传输 / Encrypted Transmission**: HTTPS/TLS 1.2+ 
- **密码加密 / Password Encryption**: Bcrypt with salt rounds
- **敏感数据保护 / Sensitive Data Protection**: 不记录密码和令牌 / Don't log passwords and tokens
- **数据库安全 / Database Security**: 最小权限原则 / Principle of least privilege

---

## HTTPS 配置 / HTTPS Configuration

### 使用 Let's Encrypt 免费证书 / Using Let's Encrypt Free Certificates

#### 1. 安装 Certbot / Install Certbot

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
```

#### 2. 获取证书 / Obtain Certificate

```bash
# Stop Nginx temporarily / 临时停止 Nginx
sudo systemctl stop nginx

# Obtain certificate / 获取证书
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Start Nginx / 启动 Nginx
sudo systemctl start nginx
```

#### 3. 配置 Nginx HTTPS / Configure Nginx HTTPS

编辑 Nginx 配置文件：

Edit Nginx configuration file:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect all HTTP to HTTPS / 重定向所有 HTTP 到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates / SSL 证书
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration / SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # OCSP stapling / OCSP 装订
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;

    # Security headers / 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Proxy to Node.js application / 代理到 Node.js 应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 4. 自动续期 / Automatic Renewal

```bash
# Test renewal / 测试续期
sudo certbot renew --dry-run

# Add to crontab for automatic renewal / 添加到 crontab 自动续期
sudo crontab -e

# Add this line / 添加此行
0 0 1 * * certbot renew --quiet && systemctl reload nginx
```

### 应用层 HTTPS 强制 / Application-Level HTTPS Enforcement

应用已配置 HTTPS 重定向中间件：

The application is configured with HTTPS redirect middleware:

```typescript
// src/middleware/security.middleware.ts
export function httpsRedirectMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] !== 'https' &&
    !req.secure
  ) {
    res.redirect(301, `https://${req.headers.host}${req.url}`);
    return;
  }
  next();
}
```

---

## CORS 策略 / CORS Policy

### 配置 CORS / Configure CORS

在 `.env` 文件中配置允许的源：

Configure allowed origins in `.env` file:

```bash
# Single origin / 单个源
CORS_ORIGIN=https://yourdomain.com

# Multiple origins / 多个源
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com,https://app.yourdomain.com
```

### CORS 中间件实现 / CORS Middleware Implementation

```typescript
// src/middleware/security.middleware.ts
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'];

  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
```

### CORS 测试 / CORS Testing

```bash
# Test CORS headers / 测试 CORS 头
curl -H "Origin: https://yourdomain.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://api.yourdomain.com/api/auth/login -v
```

---

## 速率限制 / Rate Limiting

### 速率限制配置 / Rate Limit Configuration

应用实现了两级速率限制：

The application implements two-tier rate limiting:

#### 1. 认证端点 / Authentication Endpoints

- **限制 / Limit**: 5 次请求/分钟 / 5 requests per minute
- **端点 / Endpoints**: `/api/auth/*`
- **目的 / Purpose**: 防止暴力破解 / Prevent brute force attacks

#### 2. API 端点 / API Endpoints

- **限制 / Limit**: 60 次请求/分钟 / 60 requests per minute
- **端点 / Endpoints**: `/api/words/*`, `/api/reviews/*`, `/api/quiz/*`
- **目的 / Purpose**: 防止滥用 / Prevent abuse

### 自定义速率限制 / Custom Rate Limits

在 `.env` 文件中配置：

Configure in `.env` file:

```bash
# Rate limit window in milliseconds / 速率限制窗口（毫秒）
RATE_LIMIT_WINDOW_MS=60000

# Maximum requests per window / 每个窗口的最大请求数
RATE_LIMIT_MAX_REQUESTS=60

# Auth endpoints rate limit / 认证端点速率限制
AUTH_RATE_LIMIT_MAX_REQUESTS=5
```

### 速率限制响应 / Rate Limit Response

当超过限制时，返回：

When limit is exceeded, returns:

```json
{
  "error": "请求过于频繁，请稍后重试",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 45,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

响应头包含：

Response headers include:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-01-15T10:31:00.000Z
```

---

## 安全头 / Security Headers

### 实现的安全头 / Implemented Security Headers

应用自动添加以下安全头：

The application automatically adds the following security headers:

#### 1. X-Frame-Options

```
X-Frame-Options: SAMEORIGIN
```

**目的 / Purpose**: 防止点击劫持攻击 / Prevent clickjacking attacks

#### 2. X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```

**目的 / Purpose**: 防止 MIME 类型嗅探 / Prevent MIME type sniffing

#### 3. X-XSS-Protection

```
X-XSS-Protection: 1; mode=block
```

**目的 / Purpose**: 启用 XSS 过滤器 / Enable XSS filter

#### 4. Referrer-Policy

```
Referrer-Policy: no-referrer-when-downgrade
```

**目的 / Purpose**: 控制 Referrer 信息 / Control Referrer information

#### 5. Content-Security-Policy

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;
```

**目的 / Purpose**: 防止 XSS 和数据注入攻击 / Prevent XSS and data injection attacks

#### 6. Strict-Transport-Security (生产环境 / Production Only)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**目的 / Purpose**: 强制 HTTPS 连接 / Force HTTPS connections

### 验证安全头 / Verify Security Headers

```bash
# Check security headers / 检查安全头
curl -I https://yourdomain.com/api/health

# Or use online tools / 或使用在线工具
# https://securityheaders.com/
```

---

## 日志轮转 / Log Rotation

### 配置日志轮转 / Configure Log Rotation

#### 1. 创建日志目录 / Create Log Directory

```bash
sudo mkdir -p /var/log/english-learning
sudo chown nodejs:nodejs /var/log/english-learning
```

#### 2. 配置 Logrotate / Configure Logrotate

创建配置文件：

Create configuration file:

```bash
sudo nano /etc/logrotate.d/english-learning
```

添加以下内容：

Add the following content:

```
/var/log/english-learning/*.log {
    # Rotate daily / 每天轮转
    daily
    
    # Keep 14 days of logs / 保留 14 天的日志
    rotate 14
    
    # Compress old logs / 压缩旧日志
    compress
    
    # Delay compression until next rotation / 延迟压缩到下次轮转
    delaycompress
    
    # Don't rotate if log is empty / 如果日志为空则不轮转
    notifempty
    
    # Create new log file with permissions / 创建新日志文件并设置权限
    create 0640 nodejs nodejs
    
    # Use shared scripts for all logs / 对所有日志使用共享脚本
    sharedscripts
    
    # Reload application after rotation / 轮转后重新加载应用
    postrotate
        # For PM2 / 对于 PM2
        pm2 reloadLogs
        
        # For Docker / 对于 Docker
        # docker-compose exec app kill -USR1 1
    endscript
}
```

#### 3. 测试日志轮转 / Test Log Rotation

```bash
# Test configuration / 测试配置
sudo logrotate -d /etc/logrotate.d/english-learning

# Force rotation / 强制轮转
sudo logrotate -f /etc/logrotate.d/english-learning

# Check rotated logs / 检查轮转的日志
ls -lh /var/log/english-learning/
```

### 应用日志配置 / Application Log Configuration

更新 `.env` 文件：

Update `.env` file:

```bash
# Log level / 日志级别
LOG_LEVEL=info

# Log file path / 日志文件路径
LOG_FILE_PATH=/var/log/english-learning/app.log

# Enable log rotation / 启用日志轮转
LOG_ROTATION_ENABLED=true

# Max log file size / 最大日志文件大小
LOG_MAX_SIZE=10M

# Max log files / 最大日志文件数
LOG_MAX_FILES=14
```

### Docker 日志管理 / Docker Log Management

配置 Docker 日志驱动：

Configure Docker log driver:

```yaml
# docker-compose.yml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

查看 Docker 日志：

View Docker logs:

```bash
# View logs / 查看日志
docker-compose logs -f app

# View logs with timestamps / 查看带时间戳的日志
docker-compose logs -f -t app

# View last 100 lines / 查看最后 100 行
docker-compose logs --tail=100 app
```

---

## 安全检查清单 / Security Checklist

### 部署前检查 / Pre-Deployment Checklist

- [ ] **环境变量 / Environment Variables**
  - [ ] 更改所有默认密码 / Change all default passwords
  - [ ] 生成强 JWT 密钥 / Generate strong JWT secret
  - [ ] 配置 API 密钥 / Configure API keys
  - [ ] 设置 CORS 源 / Set CORS origins

- [ ] **HTTPS 配置 / HTTPS Configuration**
  - [ ] 获取 SSL 证书 / Obtain SSL certificate
  - [ ] 配置 Nginx HTTPS / Configure Nginx HTTPS
  - [ ] 启用 HSTS / Enable HSTS
  - [ ] 测试 HTTPS 重定向 / Test HTTPS redirect

- [ ] **数据库安全 / Database Security**
  - [ ] 更改数据库密码 / Change database password
  - [ ] 限制数据库访问 / Restrict database access
  - [ ] 启用 SSL 连接 / Enable SSL connection
  - [ ] 配置备份 / Configure backups

- [ ] **防火墙配置 / Firewall Configuration**
  - [ ] 仅开放必要端口 / Only open necessary ports
  - [ ] 限制 SSH 访问 / Restrict SSH access
  - [ ] 配置 fail2ban / Configure fail2ban

- [ ] **应用安全 / Application Security**
  - [ ] 启用速率限制 / Enable rate limiting
  - [ ] 配置 CORS / Configure CORS
  - [ ] 验证安全头 / Verify security headers
  - [ ] 测试输入验证 / Test input validation

- [ ] **监控和日志 / Monitoring and Logging**
  - [ ] 配置日志轮转 / Configure log rotation
  - [ ] 设置监控告警 / Set up monitoring alerts
  - [ ] 配置错误追踪 / Configure error tracking

### 定期安全审计 / Regular Security Audit

每月执行：

Execute monthly:

- [ ] 更新依赖包 / Update dependencies
- [ ] 审查访问日志 / Review access logs
- [ ] 检查异常活动 / Check for anomalous activity
- [ ] 测试备份恢复 / Test backup restoration
- [ ] 审查用户权限 / Review user permissions

每季度执行：

Execute quarterly:

- [ ] 轮换密钥和密码 / Rotate keys and passwords
- [ ] 安全漏洞扫描 / Security vulnerability scan
- [ ] 渗透测试 / Penetration testing
- [ ] 更新安全文档 / Update security documentation

---

## 安全事件响应 / Security Incident Response

### 发现安全问题时 / When Security Issue is Discovered

1. **立即行动 / Immediate Actions**
   - 隔离受影响的系统 / Isolate affected systems
   - 收集日志和证据 / Collect logs and evidence
   - 通知相关人员 / Notify relevant personnel

2. **评估影响 / Assess Impact**
   - 确定受影响的数据 / Identify affected data
   - 评估损害程度 / Assess damage extent
   - 确定攻击向量 / Determine attack vector

3. **修复和恢复 / Remediate and Recover**
   - 修补漏洞 / Patch vulnerabilities
   - 恢复服务 / Restore services
   - 更改受影响的凭证 / Change affected credentials

4. **事后分析 / Post-Incident Analysis**
   - 记录事件详情 / Document incident details
   - 分析根本原因 / Analyze root cause
   - 更新安全措施 / Update security measures

### 联系方式 / Contact Information

**安全问题报告 / Security Issue Reporting**:
- Email: security@yourdomain.com
- 紧急电话 / Emergency Phone: +86-xxx-xxxx-xxxx

---

## 合规性 / Compliance

### 数据保护 / Data Protection

- **GDPR 合规 / GDPR Compliance**: 如果服务欧盟用户 / If serving EU users
- **个人信息保护 / Personal Information Protection**: 遵守当地法律 / Comply with local laws
- **数据保留政策 / Data Retention Policy**: 定义数据保留期限 / Define data retention periods

### 审计日志 / Audit Logs

记录以下事件：

Log the following events:

- 用户登录/登出 / User login/logout
- 密码更改 / Password changes
- 数据访问 / Data access
- 配置更改 / Configuration changes
- 安全事件 / Security events

---

## 参考资源 / Reference Resources

### 安全标准 / Security Standards

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

### 工具 / Tools

- [SSL Labs](https://www.ssllabs.com/ssltest/) - SSL 配置测试 / SSL configuration testing
- [Security Headers](https://securityheaders.com/) - 安全头检查 / Security headers check
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - 依赖漏洞扫描 / Dependency vulnerability scan

---

## 版本信息 / Version Information

- **文档版本 / Documentation Version**: 1.0.0
- **最后更新 / Last Updated**: 2024-01-15
- **适用版本 / Applicable Version**: 1.0.0

---

## 联系方式 / Contact

如有安全问题或建议，请联系安全团队。

For security issues or suggestions, please contact the security team.
