#!/usr/bin/env bash
# Stop hook：改动前后端代码后自动重启 Cortex Web UI。
# 触发时机：Claude 每轮响应结束（Stop）。无代码改动时静默跳过。
#
# - 防抖：.claude/.last-app-restart 时间戳，只处理「自上次重启后改过」的代码，
#   避免纯对话的 Stop 也重启。
# - 前端改动先 npm run build（产物在 static/，供后端服务）；build 失败则不重启，
#   下次 Stop 重试。
# - CORTEX_NO_BROWSER=1 重启不弹浏览器（见 app.py launch_app）。
# - start-app.ps1 自带 _kill_port_process，重启会自动停掉旧 uvicorn。
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

STAMP=".claude/.last-app-restart"
FRONTEND="doclens/web_v2/frontend/src"
NOW="$(date +%s)"

# 首次：初始化时间戳但不重启（避免新会话首次 Stop 把所有文件都判为「新于 0」而瞎重启）
if [ ! -f "$STAMP" ]; then
  echo "$NOW" > "$STAMP"
  exit 0
fi

LAST="$(cat "$STAMP" 2>/dev/null || echo 0)"

# 前端 src 改动（ts/tsx/js/css/html）
FRONT_CHG=""
if [ -d "$FRONTEND" ]; then
  FRONT_CHG="$(find "$FRONTEND" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.css' -o -name '*.html' \) -newermt "@$LAST" 2>/dev/null | head -1)"
fi

# 后端 Python 改动（doclens/treesearch/planify，排除 __pycache__/.venv）
BACK_CHG=""
for d in doclens treesearch planify; do
  [ -d "$d" ] || continue
  HIT="$(find "$d" -path '*/__pycache__' -prune -o -path '*/.venv' -prune -o -type f -name '*.py' -newermt "@$LAST" -print 2>/dev/null | head -1)"
  if [ -n "$HIT" ]; then BACK_CHG="$HIT"; break; fi
done

# 无改动 → 跳过
if [ -z "$FRONT_CHG" ] && [ -z "$BACK_CHG" ]; then
  exit 0
fi

# 前端改动 → 先 build
if [ -n "$FRONT_CHG" ]; then
  echo "[restart-hook] 前端改动，npm run build..."
  (cd doclens/web_v2/frontend && npm run build) >/dev/null 2>&1 || {
    echo "[restart-hook] build 失败，未重启（下次 Stop 重试）"
    exit 0
  }
fi

# build 成功 → 更新时间戳（避免异步重启期间被重复触发）
echo "$NOW" > "$STAMP"

# 重启（后台脱离；CORTEX_NO_BROWSER 不弹浏览器）
# 复用上次 gui 启动的工作目录（start-app.ps1 写入 .claude/.last-app-workdir），
# 避免 hook 重启掉回默认 test_work_dir 顶掉手动 -C 指定的目录。
WORKDIR_ARGS=()
WORKDIR_STAMP=".claude/.last-app-workdir"
if [ -f "$WORKDIR_STAMP" ]; then
  WD="$(tr -d '\r\n' < "$WORKDIR_STAMP" 2>/dev/null || true)"
  if [ -n "$WD" ] && [ -d "$WD" ]; then
    WORKDIR_ARGS=(-C "$WD")
    echo "[restart-hook] 复用上次工作目录: $WD"
  fi
fi
echo "[restart-hook] 检测到代码改动，重启应用（不弹浏览器）..."
CORTEX_NO_BROWSER=1 nohup pwsh -File ./start-app.ps1 gui ${WORKDIR_ARGS[@]+"${WORKDIR_ARGS[@]}"} >/dev/null 2>&1 &
disown 2>/dev/null || true
echo "[restart-hook] 已触发重启"
