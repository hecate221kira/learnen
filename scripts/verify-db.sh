#!/bin/bash
# Database verification script - Verify database schema
# 数据库验证脚本 - 验证数据库架构

set -e

echo "Verifying database schema..."
echo "验证数据库架构..."

# Check if required environment variables are set
if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo "Error: Required database environment variables are not set"
    echo "错误：未设置必需的数据库环境变量"
    echo "Required: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
    exit 1
fi

# Run verification using ts-node or node
if [ -f "src/database/migrate.ts" ]; then
    echo "Running verification with ts-node..."
    npx ts-node src/database/migrate.ts verify
elif [ -f "dist/database/migrate.js" ]; then
    echo "Running verification with node..."
    node dist/database/migrate.js verify
else
    echo "Error: Migration script not found"
    echo "错误：未找到迁移脚本"
    exit 1
fi

echo "Database verification completed!"
echo "数据库验证完成！"
