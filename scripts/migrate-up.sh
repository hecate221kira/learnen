#!/bin/bash
# Database migration script - Apply all migrations
# 数据库迁移脚本 - 应用所有迁移

set -e

echo "Starting database migration..."
echo "开始数据库迁移..."

# Check if required environment variables are set
if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo "Error: Required database environment variables are not set"
    echo "错误：未设置必需的数据库环境变量"
    echo "Required: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
    exit 1
fi

# Run migrations using ts-node or node
if [ -f "src/database/migrate.ts" ]; then
    echo "Running migrations with ts-node..."
    npx ts-node src/database/migrate.ts up
elif [ -f "dist/database/migrate.js" ]; then
    echo "Running migrations with node..."
    node dist/database/migrate.js up
else
    echo "Error: Migration script not found"
    echo "错误：未找到迁移脚本"
    exit 1
fi

echo "Database migration completed successfully!"
echo "数据库迁移成功完成！"
