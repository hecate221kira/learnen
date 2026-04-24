#!/bin/bash
# Database rollback script - Rollback all migrations
# 数据库回滚脚本 - 回滚所有迁移

set -e

echo "WARNING: This will rollback all database migrations!"
echo "警告：这将回滚所有数据库迁移！"
echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
echo "按 Ctrl+C 取消，或等待 5 秒继续..."
sleep 5

# Check if required environment variables are set
if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo "Error: Required database environment variables are not set"
    echo "错误：未设置必需的数据库环境变量"
    echo "Required: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
    exit 1
fi

# Run rollback using ts-node or node
if [ -f "src/database/migrate.ts" ]; then
    echo "Running rollback with ts-node..."
    npx ts-node src/database/migrate.ts down
elif [ -f "dist/database/migrate.js" ]; then
    echo "Running rollback with node..."
    node dist/database/migrate.js down
else
    echo "Error: Migration script not found"
    echo "错误：未找到迁移脚本"
    exit 1
fi

echo "Database rollback completed!"
echo "数据库回滚完成！"
