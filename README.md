# Children English Learning Platform

一个儿童英语学习平台，采用智能复习和图像测验的方式让学习变得简单有趣。

## ✨ 特色功能

- **🎨 美观的用户界面** - 响应式设计，支持桌面和移动设备
- **👤 用户认证** - 安全的登录和会话管理（JWT）
- **📚 单词学习** - 输入英文单词，自动获取中文翻译和相关图片
- **🖼️ 图像关联** - 通过图片加深记忆
- **🔄 智能复习** - 基于艾宾浩斯遗忘曲线的复习计划
- **✏️ 图片测验** - 4选项图片测验巩固学习
- **📊 进度追踪** - 完整的学习历史和复习统计

## 🚀 快速开始

### 前置要求

- Node.js 18 或更高版本
- PostgreSQL 14 或更高版本

### 安装步骤

1. **克隆仓库**
```bash
git clone <repository-url>
cd children-english-learning-platform
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库和 API Key
```

4. **创建数据库**
```bash
createdb english_learning_test
```

5. **运行数据库迁移**
```bash
npm run migrate:up
```

6. **启动开发服务器**
```bash
npm run dev
```

7. **打开浏览器访问**
```
http://localhost:3000
```

🎉 **就这么简单！** 你会看到一个漂亮的登录页面。

详细使用说明请查看：**[快速开始指南](QUICK_START.md)**

## 📖 文档

- **[快速开始指南](QUICK_START.md)** - 一分钟启动项目
- **[前端使用指南](FRONTEND_GUIDE.md)** - 前端界面详细说明
- **[项目状态报告](PROJECT_STATUS.md)** - 当前项目状态和功能清单
- **[API 文档](docs/API.md)** - 完整的 API 参考
- **[部署指南](docs/DEPLOYMENT.md)** - 生产环境部署说明
- **[安全指南](docs/SECURITY.md)** - 安全配置和最佳实践

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT + bcrypt
- **Translation**: Google Translate API
- **Testing**: Jest + fast-check (property-based testing)
- **Language**: TypeScript

## Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- Google Translate API key
- Image API key (Unsplash or Pexels)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd children-english-learning-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Create database
createdb english_learning

# Run migrations (to be implemented)
npm run migrate
```

## Development

Start the development server:
```bash
npm run dev
```

## Testing

Run all tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Building

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Project Structure

```
src/
├── config/          # Configuration files
├── middleware/      # Express middleware
├── routes/          # API routes
├── controllers/     # Request handlers
├── services/        # Business logic
├── models/          # Database models
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
└── index.ts         # Application entry point
```

## Documentation

- **[API Documentation](docs/API.md)** - Complete API reference with request/response examples
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Security Guide](docs/SECURITY.md)** - Security configuration and best practices

## Quick Start with Docker

The easiest way to run the application is using Docker:

```bash
# 1. Copy environment template
cp .env.production .env

# 2. Edit .env and set required variables:
#    - DB_PASSWORD
#    - JWT_SECRET
#    - GOOGLE_TRANSLATE_API_KEY
#    - IMAGE_API_KEY

# 3. Start services
docker-compose up -d

# 4. Run database migrations
docker-compose exec app npm run migrate:up

# 5. Verify deployment
curl http://localhost:3000/health
```

## Production Deployment

### Security Features

- ✅ **HTTPS Enforcement** - Automatic redirect to HTTPS in production
- ✅ **CORS Configuration** - Configurable cross-origin resource sharing
- ✅ **Rate Limiting** - Protection against brute force attacks
- ✅ **Security Headers** - HSTS, CSP, X-Frame-Options, etc.
- ✅ **Input Validation** - SQL injection and XSS protection
- ✅ **Password Hashing** - Bcrypt with salt rounds
- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Request Size Limits** - Protection against large payload attacks

### Deployment Options

#### Option 1: Docker (Recommended)

See [Deployment Guide](docs/DEPLOYMENT.md#docker-部署--docker-deployment) for detailed instructions.

#### Option 2: Manual Deployment

See [Deployment Guide](docs/DEPLOYMENT.md#手动部署--manual-deployment) for detailed instructions.

### Environment Variables

Required environment variables for production:

```bash
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=english_learning
DB_USER=postgres
DB_PASSWORD=your_strong_password
JWT_SECRET=your_jwt_secret_32_chars
GOOGLE_TRANSLATE_API_KEY=your_api_key
IMAGE_API_KEY=your_api_key
```

See `.env.example` for all available configuration options.

## Database Migrations

```bash
# Apply all migrations
npm run migrate:up

# Rollback all migrations
npm run migrate:down

# Verify database schema
npm run migrate:verify
```

## API Documentation

See [API Documentation](docs/API.md) for complete API reference.

### Quick API Overview

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify JWT token

#### Words
- `POST /api/words/translate` - Translate English word to Chinese
- `POST /api/words/save` - Save word with translation and image

#### Reviews
- `GET /api/reviews/due` - Get due review words
- `POST /api/reviews/complete` - Complete a review

#### Quiz
- `GET /api/quiz/generate` - Generate quiz questions
- `POST /api/quiz/answer` - Submit quiz answer

## Monitoring and Logs

### View Logs

```bash
# Docker
docker-compose logs -f app

# PM2
pm2 logs english-learning-app

# Direct
tail -f /var/log/english-learning/app.log
```

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Security

See [Security Guide](docs/SECURITY.md) for comprehensive security documentation.

### Security Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Generate strong JWT secret (32+ characters)
- [ ] Configure CORS origins
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure firewall rules
- [ ] Set up log rotation
- [ ] Configure backups
- [ ] Review security headers

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
