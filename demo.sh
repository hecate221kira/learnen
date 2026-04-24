#!/bin/bash

# 儿童英语学习平台 - 功能演示脚本

BASE_URL="http://localhost:3000"
echo "========================================="
echo "儿童英语学习平台 - 功能演示"
echo "========================================="
echo ""

# 1. 健康检查
echo "1. 健康检查"
echo "-------------------------------------------"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""
echo ""

# 2. 用户注册
echo "2. 用户注册"
echo "-------------------------------------------"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_user","password":"Demo123456"}')
echo "$REGISTER_RESPONSE" | python3 -m json.tool
TOKEN=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")
echo ""
echo ""

# 3. 用户登录
echo "3. 用户登录"
echo "-------------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_user","password":"Demo123456"}')
echo "$LOGIN_RESPONSE" | python3 -m json.tool
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")
echo ""
echo ""

# 4. 翻译单词（需要有效的 Google Translate API Key）
echo "4. 翻译单词 (apple)"
echo "-------------------------------------------"
echo "注意：需要配置有效的 Google Translate API Key"
curl -s -X POST "$BASE_URL/api/words/translate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"word":"apple"}' | python3 -m json.tool
echo ""
echo ""

# 5. 获取到期复习单词
echo "5. 获取到期复习单词"
echo "-------------------------------------------"
curl -s -X GET "$BASE_URL/api/reviews/due?limit=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""
echo ""

# 6. 生成测验题目
echo "6. 生成测验题目"
echo "-------------------------------------------"
curl -s -X GET "$BASE_URL/api/quiz/generate?limit=3" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""
echo ""

echo "========================================="
echo "演示完成！"
echo "========================================="
echo ""
echo "服务器运行在: $BASE_URL"
echo "Token: $TOKEN"
echo ""
echo "你可以使用以下命令测试其他功能："
echo "  - 保存单词: POST /api/words/save"
echo "  - 完成复习: POST /api/reviews/complete"
echo "  - 提交测验答案: POST /api/quiz/answer"
