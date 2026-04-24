# 部署文档 / Deployment Documentation

## 概述 / Overview

本文档描述如何部署儿童英语学习平台到生产环境。

This document describes how to deploy the Children's English Learning Platform to production.

---

## 目录 / Table of Contents

1. [系统要求 / System Requirements](#系统要求--system-requirements)
2. [环境准备 / Environment Preparation](#环境准备--environment-preparation)
3. [Docker 部署 / Docker Deployment](#docker-部署--docker-deployment)
4. [手动部署 / Manual Deployment](#手动部署--manual-deployment)
5. [数据库迁移 / Database Migration](#数据库迁移--database-migration)
6. [环境变量配置 / Environment Variables](#环境变量配置--environment-variables)
7. [健康检查 / Health Checks](#健康检查--health-checks)
8. [监控和日志 / Monitoring and Logging](#监控和日志--monitoring-and-logging)
9. [故障排除 / Troubleshooting](#故障排除--troubleshooting)

---

## 系统要求 / System Requirements

### 最低配置 / Minimum Requirements

- **CPU**: 2 核心 / 2 cores
- **内存 / RAM**: 2 GB
- **存储 / Storage**: 10 GB
- **操作系统 / OS**: Linux (Ubuntu 20.04+, CentOS 7+, Debian 10+)

### 推荐配置 / Recommended Requirements

- **CPU**: 4 核心 / 4 cores
- **内存 / RAM**: 4 GB
- **存储 / Storage**: 20 GB SSD
- **操作系统 / OS**: Linux (Ubuntu 22.04 LTS)

### 软件依赖 / Software Dependencies

- **Node.js**: 18.x 或更高 / 18.x or higher
- **PostgreSQL**: 15.x 或更高 / 15.x or higher
- **Docker**: 20.10+ (可选，用于容器化部署 / Optional, for containerized deployment)
- **Docker Compose**: 2.0+ (可选 / Optional)

---

## 环境准备 / Environment Preparation

### 1. 安装 Node.js / Install Node.js

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation / 验证安装
node --version  # Should be v18.x or higher
npm --version
```

### 2. 安装 PostgreSQL / Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Start PostgreSQL service / 启动 PostgreSQL 服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation / 验证安装
psql --version  # Should be 15.x or higher
```

### 3. 安装 Docker (可选) / Install Docker (Optional)

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose / 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation / 验证安装
docker --version
docker-compose --version
```

---

## Docker 部署 / Docker Deployment

### 快速开始 / Quick Start

Docker 部署是推荐的生产部署方式。

Docker deployment is the recommended production deployment method.

#### 1. 克隆代码库 / Clone Repository

```bash
git clone <repository-url>
cd children-english-learning-platform
```

#### 2. 配置环境变量 / Configure Environment Variables

```bash
# Copy production environment template / 复制生产环境模板
cp .env.production .env

# Edit environment variables / 编辑环境变量
nano .env
```

**必须修改的变量 / Required Variables to Change**:

- `DB_PASSWORD`: 数据库密码 / Database password
- `JWT_SECRET`: JWT 密钥 / JWT secret (生成方法 / Generate with: `openssl rand -base64 32`)
- `GOOGLE_TRANSLATE_API_KEY`: Google 翻译 API 密钥 / Google Translate API key
- `IMAGE_API_KEY`: 图像 API 密钥 / Image API key

#### 3. 构建和启动服务 / Build and Start Services

```bash
# Build and start all services / 构建并启动所有服务
docker-compose up -d

# Check service status / 检查服务状态
docker-compose ps

# View logs / 查看日志
docker-compose logs -f app
```

#### 4. 运行数据库迁移 / Run Database Migrations

```bash
# Wait for database to be ready (about 10 seconds)
# 等待数据库准备就绪（约 10 秒）
sleep 10

# Run migrations / 运行迁移
docker-compose exec app npm run migrate:up
```

#### 5. 验证部署 / Verify Deployment

```bash
# Check health endpoint / 检查健康端点
curl http://localhost:3000/health

# Expected response / 期望响应:
# {"status":"ok","timestamp":"2024-01-15T10:30:00.000Z"}
```

### Docker 命令参考 / Docker Command Reference

```bash
# Start services / 启动服务
docker-compose up -d

# Stop services / 停止服务
docker-compose down

# Restart services / 重启服务
docker-compose restart

# View logs / 查看日志
docker-compose logs -f [service_name]

# Execute command in container / 在容器中执行命令
docker-compose exec app [command]

# Rebuild and restart / 重新构建并重启
docker-compose up -d --build

# Remove all containers and volumes / 删除所有容器和卷
docker-compose down -v
```

---

## 手动部署 / Manual Deployment

### 1. 准备数据库 / Prepare Database

```bash
# Switch to postgres user / 切换到 postgres 用户
sudo -u postgres psql

# Create database and user / 创建数据库和用户
CREATE DATABASE english_learning;
CREATE USER app_user WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE english_learning TO app_user;

# Exit psql / 退出 psql
\q
```

### 2. 克隆和构建应用 / Clone and Build Application

```bash
# Clone repository / 克隆代码库
git clone <repository-url>
cd children-english-learning-platform

# Install dependencies / 安装依赖
npm ci --only=production

# Build TypeScript / 构建 TypeScript
npm run build
```

### 3. 配置环境变量 / Configure Environment Variables

```bash
# Copy and edit environment file / 复制并编辑环境文件
cp .env.example .env
nano .env
```

### 4. 运行数据库迁移 / Run Database Migrations

```bash
# Make migration scripts executable / 使迁移脚本可执行
chmod +x scripts/*.sh

# Run migrations / 运行迁移
./scripts/migrate-up.sh

# Verify database schema / 验证数据库架构
./scripts/verify-db.sh
```

### 5. 启动应用 / Start Application

```bash
# Start with Node.js / 使用 Node.js 启动
npm start

# Or use PM2 for process management / 或使用 PM2 进行进程管理
npm install -g pm2
pm2 start dist/index.js --name english-learning-app
pm2 save
pm2 startup
```

### 6. 配置反向代理 (Nginx) / Configure Reverse Proxy (Nginx)

```bash
# Install Nginx / 安装 Nginx
sudo apt-get install -y nginx

# Create Nginx configuration / 创建 Nginx 配置
sudo nano /etc/nginx/sites-available/english-learning
```

**Nginx 配置示例 / Nginx Configuration Example**:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS / 重定向 HTTP 到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates / SSL 证书
    ssl_certificate /etc/ssl/certs/your_cert.crt;
    ssl_certificate_key /etc/ssl/private/your_key.key;

    # SSL configuration / SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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

    # Security headers / 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

```bash
# Enable site / 启用站点
sudo ln -s /etc/nginx/sites-available/english-learning /etc/nginx/sites-enabled/

# Test configuration / 测试配置
sudo nginx -t

# Reload Nginx / 重新加载 Nginx
sudo systemctl reload nginx
```

---

## 数据库迁移 / Database Migration

### 迁移脚本 / Migration Scripts

项目包含以下迁移脚本：

The project includes the following migration scripts:

1. `001_create_users_table.sql` - 创建用户表 / Create users table
2. `002_create_words_table.sql` - 创建单词表 / Create words table
3. `003_create_review_schedules_table.sql` - 创建复习计划表 / Create review schedules table
4. `004_create_review_attempts_table.sql` - 创建复习尝试表 / Create review attempts table
5. `005_create_image_cache_table.sql` - 创建图像缓存表 / Create image cache table
6. `006_add_performance_indexes.sql` - 添加性能索引 / Add performance indexes

### 运行迁移 / Running Migrations

```bash
# Apply all migrations / 应用所有迁移
npm run migrate:up
# Or / 或
./scripts/migrate-up.sh

# Rollback all migrations / 回滚所有迁移
npm run migrate:down
# Or / 或
./scripts/migrate-down.sh

# Verify database schema / 验证数据库架构
npm run migrate:verify
# Or / 或
./scripts/verify-db.sh
```

### 迁移故障排除 / Migration Troubleshooting

如果迁移失败：

If migration fails:

1. 检查数据库连接 / Check database connection
2. 验证环境变量 / Verify environment variables
3. 检查数据库用户权限 / Check database user permissions
4. 查看迁移日志 / Review migration logs

```bash
# Test database connection / 测试数据库连接
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT version();"

# Check migration status manually / 手动检查迁移状态
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt"
```

---

## 环境变量配置 / Environment Variables

### 必需变量 / Required Variables

| 变量 / Variable | 描述 / Description | 示例 / Example |
|----------------|-------------------|---------------|
| `NODE_ENV` | 运行环境 / Runtime environment | `production` |
| `PORT` | 应用端口 / Application port | `3000` |
| `DB_HOST` | 数据库主机 / Database host | `localhost` |
| `DB_PORT` | 数据库端口 / Database port | `5432` |
| `DB_NAME` | 数据库名称 / Database name | `english_learning` |
| `DB_USER` | 数据库用户 / Database user | `app_user` |
| `DB_PASSWORD` | 数据库密码 / Database password | `strong_password` |
| `JWT_SECRET` | JWT 密钥 / JWT secret | `random_32_char_string` |
| `GOOGLE_TRANSLATE_API_KEY` | Google 翻译 API 密钥 / Google Translate API key | `your_api_key` |
| `IMAGE_API_KEY` | 图像 API 密钥 / Image API key | `your_api_key` |

### 可选变量 / Optional Variables

| 变量 / Variable | 描述 / Description | 默认值 / Default |
|----------------|-------------------|-----------------|
| `JWT_EXPIRES_IN` | JWT 过期时间 / JWT expiration | `7d` |
| `IMAGE_API_PROVIDER` | 图像 API 提供商 / Image API provider | `unsplash` |
| `BCRYPT_SALT_ROUNDS` | Bcrypt 盐轮数 / Bcrypt salt rounds | `10` |
| `TRANSLATION_TIMEOUT` | 翻译超时（毫秒）/ Translation timeout (ms) | `5000` |
| `IMAGE_TIMEOUT` | 图像超时（毫秒）/ Image timeout (ms) | `5000` |
| `DB_QUERY_TIMEOUT` | 数据库查询超时（毫秒）/ DB query timeout (ms) | `10000` |

### 生成安全密钥 / Generate Secure Keys

```bash
# Generate JWT secret / 生成 JWT 密钥
openssl rand -base64 32

# Generate database password / 生成数据库密码
openssl rand -base64 24
```

---

## 健康检查 / Health Checks

### 应用健康检查 / Application Health Check

```bash
# Check application health / 检查应用健康
curl http://localhost:3000/health

# Expected response / 期望响应:
# {"status":"ok","timestamp":"2024-01-15T10:30:00.000Z"}
```

### 数据库健康检查 / Database Health Check

```bash
# Check database connection / 检查数据库连接
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"
```

### Docker 健康检查 / Docker Health Check

```bash
# Check container health / 检查容器健康
docker-compose ps

# View health check logs / 查看健康检查日志
docker inspect --format='{{json .State.Health}}' english-learning-app
```

---

## 监控和日志 / Monitoring and Logging

### 应用日志 / Application Logs

```bash
# View application logs (Docker) / 查看应用日志（Docker）
docker-compose logs -f app

# View application logs (PM2) / 查看应用日志（PM2）
pm2 logs english-learning-app

# View application logs (systemd) / 查看应用日志（systemd）
journalctl -u english-learning-app -f
```

### 数据库日志 / Database Logs

```bash
# PostgreSQL logs location / PostgreSQL 日志位置
# Ubuntu/Debian: /var/log/postgresql/
tail -f /var/log/postgresql/postgresql-15-main.log
```

### 日志轮转配置 / Log Rotation Configuration

创建日志轮转配置文件：

Create log rotation configuration file:

```bash
sudo nano /etc/logrotate.d/english-learning
```

```
/var/log/english-learning/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nodejs nodejs
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 监控指标 / Monitoring Metrics

建议监控以下指标：

Recommended metrics to monitor:

- **CPU 使用率 / CPU Usage**: < 70%
- **内存使用率 / Memory Usage**: < 80%
- **磁盘使用率 / Disk Usage**: < 80%
- **响应时间 / Response Time**: < 500ms (P95)
- **错误率 / Error Rate**: < 1%
- **数据库连接数 / Database Connections**: < 80% of max

---

## 故障排除 / Troubleshooting

### 常见问题 / Common Issues

#### 1. 应用无法启动 / Application Won't Start

**症状 / Symptoms**: 应用启动失败或立即退出

**解决方案 / Solutions**:

```bash
# Check logs / 检查日志
docker-compose logs app
# Or / 或
pm2 logs english-learning-app

# Verify environment variables / 验证环境变量
cat .env

# Check database connection / 检查数据库连接
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"

# Verify port is not in use / 验证端口未被占用
sudo lsof -i :3000
```

#### 2. 数据库连接失败 / Database Connection Failed

**症状 / Symptoms**: `ECONNREFUSED` 或 `Connection timeout`

**解决方案 / Solutions**:

```bash
# Check PostgreSQL is running / 检查 PostgreSQL 是否运行
sudo systemctl status postgresql

# Check database credentials / 检查数据库凭证
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Check firewall rules / 检查防火墙规则
sudo ufw status

# For Docker, check network / 对于 Docker，检查网络
docker network ls
docker network inspect children-english-learning-platform_app-network
```

#### 3. 翻译 API 错误 / Translation API Error

**症状 / Symptoms**: `EXTERNAL_SERVICE_ERROR` 或 `TIMEOUT_ERROR`

**解决方案 / Solutions**:

```bash
# Verify API key / 验证 API 密钥
echo $GOOGLE_TRANSLATE_API_KEY

# Test API connection / 测试 API 连接
curl -X POST "https://translation.googleapis.com/language/translate/v2?key=$GOOGLE_TRANSLATE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q":"hello","target":"zh-CN"}'

# Check API quota / 检查 API 配额
# Visit Google Cloud Console / 访问 Google Cloud 控制台
```

#### 4. 内存不足 / Out of Memory

**症状 / Symptoms**: 应用崩溃，日志显示 `JavaScript heap out of memory`

**解决方案 / Solutions**:

```bash
# Increase Node.js memory limit / 增加 Node.js 内存限制
# Edit package.json start script / 编辑 package.json 启动脚本
"start": "node --max-old-space-size=2048 dist/index.js"

# Or set environment variable / 或设置环境变量
export NODE_OPTIONS="--max-old-space-size=2048"

# For Docker, increase container memory / 对于 Docker，增加容器内存
# Edit docker-compose.yml / 编辑 docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
```

#### 5. 性能问题 / Performance Issues

**症状 / Symptoms**: 响应缓慢，超时

**解决方案 / Solutions**:

```bash
# Check database indexes / 检查数据库索引
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\di"

# Analyze slow queries / 分析慢查询
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check connection pool / 检查连接池
# Monitor active connections / 监控活动连接
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT count(*) FROM pg_stat_activity;"

# Enable query logging / 启用查询日志
# Edit postgresql.conf / 编辑 postgresql.conf
log_min_duration_statement = 1000  # Log queries > 1 second
```

### 获取帮助 / Getting Help

如果问题仍未解决：

If the issue persists:

1. 收集日志 / Collect logs
2. 检查系统资源 / Check system resources
3. 查看 GitHub Issues / Check GitHub Issues
4. 联系技术支持 / Contact technical support

---

## 安全最佳实践 / Security Best Practices

### 1. 使用强密码 / Use Strong Passwords

- 数据库密码至少 16 字符 / Database password at least 16 characters
- JWT 密钥至少 32 字符 / JWT secret at least 32 characters
- 定期轮换密钥 / Rotate keys regularly

### 2. 启用 HTTPS / Enable HTTPS

- 使用 Let's Encrypt 免费 SSL 证书 / Use Let's Encrypt free SSL certificates
- 强制 HTTPS 重定向 / Force HTTPS redirect
- 使用 HSTS 头 / Use HSTS headers

### 3. 限制网络访问 / Restrict Network Access

```bash
# Configure firewall / 配置防火墙
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 5432/tcp   # PostgreSQL (only allow from localhost)
sudo ufw enable
```

### 4. 定期更新 / Regular Updates

```bash
# Update system packages / 更新系统包
sudo apt-get update
sudo apt-get upgrade

# Update Node.js dependencies / 更新 Node.js 依赖
npm audit
npm audit fix

# Update Docker images / 更新 Docker 镜像
docker-compose pull
docker-compose up -d
```

### 5. 备份策略 / Backup Strategy

```bash
# Backup database / 备份数据库
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f backup_$(date +%Y%m%d).dump

# Restore database / 恢复数据库
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c backup_20240115.dump

# Automate backups with cron / 使用 cron 自动化备份
# Add to crontab / 添加到 crontab
0 2 * * * /path/to/backup-script.sh
```

---

## 性能优化 / Performance Optimization

### 1. 数据库优化 / Database Optimization

```sql
-- Analyze tables / 分析表
ANALYZE;

-- Vacuum tables / 清理表
VACUUM ANALYZE;

-- Check index usage / 检查索引使用
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### 2. 应用优化 / Application Optimization

- 启用 gzip 压缩 / Enable gzip compression
- 使用 CDN 托管静态资源 / Use CDN for static assets
- 实现缓存策略 / Implement caching strategy
- 优化数据库查询 / Optimize database queries

### 3. 负载均衡 / Load Balancing

对于高流量场景，考虑：

For high-traffic scenarios, consider:

- 使用 Nginx 负载均衡 / Use Nginx load balancing
- 部署多个应用实例 / Deploy multiple app instances
- 使用 Redis 会话存储 / Use Redis for session storage
- 实现数据库读写分离 / Implement database read/write splitting

---

## 版本信息 / Version Information

- **文档版本 / Documentation Version**: 1.0.0
- **最后更新 / Last Updated**: 2024-01-15
- **适用版本 / Applicable Version**: 1.0.0

---

## 联系方式 / Contact

如有部署问题或建议，请联系开发团队。

For deployment issues or suggestions, please contact the development team.
