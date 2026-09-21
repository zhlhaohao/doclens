#!/usr/bin/env bash
# 逐源窄域重测驱动 v3（终局：每组独立端口）。
#   v2 教训——7860 上存在时隐时现的幽灵监听者（Stop hook/残留实例/TIME_WAIT），
#   同端口多服务在 Windows 上连接分发不可控，探针与 workdir 核对均被干扰。
#   v3 结构性修复：每组服务用独立端口（7870+idx，MCP 7890+idx），
#   bench 与核对都指向该端口，与 7860 上的一切活动彻底隔离。
# 只补跑缺口组：confluence（含 3 条已删污染行全组重跑）/ gmail / slack / github。
# 结果追加落 benchmarks/results_persource/（新 jsonl，按时间自然后到覆盖）。
set -u
ROOT=/c/Users/lianghao/github/cortex
CORPUS_WIN='C:\Users\lianghao\EnterpriseRAG-Bench-Data\all_documents'
OUT="$ROOT/benchmarks/results_persource"
PY="$ROOT/.venv/Scripts/python.exe"
mkdir -p "$OUT"
export CORTEX_NO_BROWSER=1

kill_all_doclens_gui() {
  local pids
  pids=$(pwsh -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { \$_.CommandLine -match 'doclens' -and \$_.CommandLine -match 'gui' } | Select-Object -ExpandProperty ProcessId" 2>/dev/null | tr -d '\r')
  for p in $pids; do
    pwsh -NoProfile -Command "Stop-Process -Id $p -Force" 2>/dev/null || true
  done
}

idx=0
for src in confluence gmail slack github; do
  qf="$ROOT/benchmarks/persource/$src.jsonl"
  [ -f "$qf" ] || { echo "[$src] 题集缺失，跳过"; continue; }
  n=$(grep -c . "$qf")
  port=$((7870 + idx))
  mcp=$((7890 + idx))
  idx=$((idx + 1))
  want_win="${CORPUS_WIN}\\${src}"
  echo ""
  echo "===== [$src] $n 题 · port=$port · workdir=$want_win ====="

  # 卫生清扫（尽力杀全部 gui 实例，含幽灵；独立端口下非必需但无害）
  kill_all_doclens_gui
  sleep 3

  # 独立端口起服务；MCP 端口同步错开（start-app 读 env CORTEX_MCP_PORT 为基）
  svc_out="$OUT/${src}_v3_svc.out"
  CORTEX_MCP_PORT=$mcp pwsh -NoProfile -File "$ROOT/start-app.ps1" gui -C "$want_win" --port $port \
    >"$svc_out" 2>"$OUT/${src}_v3_svc.err" &
  svc_pid=$!

  # 等就绪横幅（索引已存在，应分钟级；上限 15 分钟）
  ready=0
  for i in $(seq 1 180); do
    sleep 5
    if grep -aq "GUI 就绪\|探针失败" "$svc_out" 2>/dev/null; then
      ready=1; break
    fi
  done
  if [ "$ready" != 1 ] || grep -aq "探针失败" "$svc_out" 2>/dev/null; then
    echo "[$src] !! 服务未就绪/探针失败，跳过（看 ${src}_v3_svc.err）"
    kill_all_doclens_gui; kill $svc_pid 2>/dev/null || true
    continue
  fi

  # 双核对：横幅必须含本组端口（防打到别的实例）+ workdir 必须等于本组目录
  if ! grep -aq "localhost:$port" "$svc_out" 2>/dev/null; then
    echo "[$src] !! 横幅端口不含 $port，跳过（防错实例）"
    kill_all_doclens_gui; kill $svc_pid 2>/dev/null || true
    continue
  fi
  wd=$(curl -s -m 15 "http://127.0.0.1:$port/api/status" | "$PY" -c "import json,sys; print(json.load(sys.stdin).get('workdir',''))" 2>/dev/null | tr -d '\r\n')
  if [ "${wd,,}" != "${want_win,,}" ]; then
    echo "[$src] !! workdir 不符：期望 $want_win 实际 ${wd:-空}，跳组"
    kill_all_doclens_gui; kill $svc_pid 2>/dev/null || true
    continue
  fi
  echo "[$src] 独立端口 $port 服务就绪且 workdir 已核对 ✓"

  cd "$ROOT" || exit 1
  printf '\n\n%d\n' "$n" | PYTHONIOENCODING=utf-8 "$PY" benchmarks/run_benchmark.py \
    --questions "$qf" \
    --base-url "http://127.0.0.1:$port" \
    --out-dir "$OUT" \
    --timeout 600
  echo "[$src] 完成（exit=$?）"

  kill_all_doclens_gui
done

echo ""
echo "===== 缺口组补跑完成 ====="
# 清 workdir stamp：防未来 Stop hook 以语料目录重启开发实例（无 stamp 时回落
# global CORTEX_WORKDIR，恢复开发常态）
rm -f "$ROOT/.claude/.last-app-workdir"
echo "已清理 workdir stamp 与全部 doclens gui 进程"
ls -la "$OUT"/*.jsonl 2>/dev/null | tail -6
