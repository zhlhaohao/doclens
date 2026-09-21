#!/usr/bin/env bash
# 逐源窄域重测驱动 v2（修多服务竞争 bug）：
#   v1 教训——端口杀法只杀监听者，未绑定的其他组服务存活，多服务在同端口竞争，
#   跨组污染（google_drive 题打到 jira 服务）。v2 三重防线：
#   A. 按 CommandLine 匹配杀掉全部 doclens gui python（不限监听状态）
#   B. 起服务前验证端口真空 + 无残留进程（30s 轮询，不过则 loud-fail 跳组）
#   C. 横幅后核对 /api/status.workdir == 预期子目录，不符即杀服务跳组
# 结果落 benchmarks/results_persource/（v1 已归档 results_persource_invalid1/）。
set -u
ROOT=/c/Users/lianghao/github/cortex
CORPUS_WIN='C:\Users\lianghao\EnterpriseRAG-Bench-Data\all_documents'
PORT=7860
OUT="$ROOT/benchmarks/results_persource"
PY="$ROOT/.venv/Scripts/python.exe"
mkdir -p "$OUT"
export CORTEX_NO_BROWSER=1

kill_all_doclens_gui() {
  # 按 CommandLine 匹配杀全部 doclens gui python（含未绑定端口的僵尸）
  local pids
  pids=$(pwsh -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { \$_.CommandLine -match 'doclens' -and \$_.CommandLine -match 'gui' } | Select-Object -ExpandProperty ProcessId" 2>/dev/null | tr -d '\r')
  for p in $pids; do
    pwsh -NoProfile -Command "Stop-Process -Id $p -Force" 2>/dev/null || true
  done
}

port_free() {
  local n
  n=$(pwsh -NoProfile -Command "@(Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue).Count" 2>/dev/null | tr -d '\r')
  [ "${n:-1}" = "0" ]
}

no_gui_proc() {
  local n
  n=$(pwsh -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { \$_.CommandLine -match 'doclens' -and \$_.CommandLine -match 'gui' }).Count" 2>/dev/null | tr -d '\r')
  [ "${n:-1}" = "0" ]
}

for src in linear jira google_drive confluence fireflies gmail slack github hubspot; do
  qf="$ROOT/benchmarks/persource/$src.jsonl"
  [ -f "$qf" ] || { echo "[$src] 题集缺失，跳过"; continue; }
  n=$(grep -c . "$qf")
  want_win="${CORPUS_WIN}\\${src}"
  echo ""
  echo "===== [$src] $n 题 · workdir=$want_win ====="

  # A+B) 杀全量并验证真空
  kill_all_doclens_gui
  ok=0
  for i in $(seq 1 12); do
    if port_free && no_gui_proc; then ok=1; break; fi
    sleep 2
  done
  if [ "$ok" != 1 ]; then
    echo "[$src] !! 端口/进程未清空，跳过该组（防跨组污染）"
    continue
  fi
  echo "[$src] 端口与进程已真空"

  # 起服务（输出重定向到 per-source 文件——就绪横幅落在 ${src}_svc.out）
  svc_out="$OUT/${src}_svc.out"
  pwsh -NoProfile -File "$ROOT/start-app.ps1" gui -C "$want_win" \
    >"$svc_out" 2>"$OUT/${src}_svc.err" &
  svc_pid=$!

  # 等就绪横幅（首启含索引构建，25 分钟上限）
  ready=0
  for i in $(seq 1 300); do
    sleep 5
    if grep -aq "GUI 就绪\|探针失败" "$svc_out" 2>/dev/null; then
      ready=1; break
    fi
  done
  if [ "$ready" != 1 ] || grep -aq "探针失败" "$svc_out" 2>/dev/null; then
    echo "[$src] !! 服务未就绪/探针失败，跳过（看 ${src}_svc.err）"
    kill_all_doclens_gui; kill $svc_pid 2>/dev/null || true
    continue
  fi

  # C) workdir 核对：横幅只证明「有服务」，必须确认「是对的服务」
  wd=$(curl -s -m 10 "http://127.0.0.1:$PORT/api/status" | "$PY" -c "import json,sys; print(json.load(sys.stdin).get('workdir',''))" 2>/dev/null | tr -d '\r\n')
  if [ "${wd,,}" != "${want_win,,}" ]; then
    echo "[$src] !! workdir 不符：期望 $want_win 实际 ${wd:-空}，杀服跳组（防污染）"
    kill_all_doclens_gui; kill $svc_pid 2>/dev/null || true
    continue
  fi
  echo "[$src] 服务就绪且 workdir 已核对 ✓"

  # 跑题（stdin：空=全选源、空=全选类型、显式条数）
  cd "$ROOT" || exit 1
  printf '\n\n%d\n' "$n" | PYTHONIOENCODING=utf-8 "$PY" benchmarks/run_benchmark.py \
    --questions "$qf" \
    --base-url "http://127.0.0.1:$PORT" \
    --out-dir "$OUT" \
    --timeout 600
  echo "[$src] 完成（exit=$?）"
done

echo ""
echo "===== 全部组完成 ====="
ls -la "$OUT"/*.jsonl 2>/dev/null

# 收尾：杀掉最后一组的服务
kill_all_doclens_gui
echo "已清理全部 doclens gui 进程"
