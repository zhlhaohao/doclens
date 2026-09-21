#!/usr/bin/env bash
# v4 收尾补跑：v2 幽灵时期连接失败的 5 题（jira 全组 3 + fireflies 2）。
# 沿用 v3 方案：独立端口 + 横幅端口核对 + workdir 核对。跑完清理。
set -u
ROOT=/c/Users/lianghao/github/cortex
CORPUS_WIN='C:\Users\lianghao\EnterpriseRAG-Bench-Data\all_documents'
OUT="$ROOT/benchmarks/results_persource"
PY="$ROOT/.venv/Scripts/python.exe"
export CORTEX_NO_BROWSER=1

kill_all_doclens_gui() {
  local pids
  pids=$(pwsh -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { \$_.CommandLine -match 'doclens' -and \$_.CommandLine -match 'gui' } | Select-Object -ExpandProperty ProcessId" 2>/dev/null | tr -d '\r')
  for p in $pids; do
    pwsh -NoProfile -Command "Stop-Process -Id $p -Force" 2>/dev/null || true
  done
}

idx=0
for src in jira fireflies_fix2; do
  qf="$ROOT/benchmarks/persource/$src.jsonl"
  n=$(grep -c . "$qf")
  port=$((7874 + idx)); mcp=$((7894 + idx)); idx=$((idx + 1))
  real=${src%%_fix2}
  want_win="${CORPUS_WIN}\\${real}"
  echo ""
  echo "===== [$src] $n 题 · port=$port · workdir=$want_win ====="
  kill_all_doclens_gui
  sleep 3
  svc_out="$OUT/${src}_v4_svc.out"
  CORTEX_MCP_PORT=$mcp pwsh -NoProfile -File "$ROOT/start-app.ps1" gui -C "$want_win" --port $port \
    >"$svc_out" 2>"$OUT/${src}_v4_svc.err" &
  svc_pid=$!
  ready=0
  for i in $(seq 1 180); do
    sleep 5
    if grep -aq "GUI 就绪\|探针失败" "$svc_out" 2>/dev/null; then ready=1; break; fi
  done
  if [ "$ready" != 1 ] || grep -aq "探针失败" "$svc_out" 2>/dev/null \
     || ! grep -aq "localhost:$port" "$svc_out" 2>/dev/null; then
    echo "[$src] !! 未就绪/端口不符，跳过"
    kill_all_doclens_gui; kill $svc_pid 2>/dev/null || true
    continue
  fi
  wd=$(curl -s -m 15 "http://127.0.0.1:$port/api/status" | "$PY" -c "import json,sys; print(json.load(sys.stdin).get('workdir',''))" 2>/dev/null | tr -d '\r\n')
  if [ "${wd,,}" != "${want_win,,}" ]; then
    echo "[$src] !! workdir 不符（${wd:-空}），跳组"
    kill_all_doclens_gui; kill $svc_pid 2>/dev/null || true
    continue
  fi
  echo "[$src] 端口 $port 就绪且 workdir 已核对 ✓"
  cd "$ROOT" || exit 1
  printf '\n\n%d\n' "$n" | PYTHONIOENCODING=utf-8 "$PY" benchmarks/run_benchmark.py \
    --questions "$qf" --base-url "http://127.0.0.1:$port" --out-dir "$OUT" --timeout 600
  echo "[$src] 完成（exit=$?）"
  kill_all_doclens_gui
done

rm -f "$ROOT/.claude/.last-app-workdir"
echo "===== v4 收尾完成，已清理 ====="
