#!/bin/bash
# Git Bash 脚本 - 网络搜索 CLI

# 用法: ./web_search.sh "搜索查询" [选项]
# 示例: ./web_search.sh "今天最新的科技新闻" -m glm-5-turbo

# API Key (请替换为实际的密钥)
ZAI_API_KEY="${ZAI_API_KEY:-your_api_key_here}"

# 运行搜索
ZAI_API_KEY="$ZAI_API_KEY" .venv/Scripts/python.exe web_search.py "$@"
