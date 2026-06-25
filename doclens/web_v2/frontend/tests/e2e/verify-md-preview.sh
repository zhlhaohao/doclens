#!/usr/bin/env bash
# verify-md-preview.sh —— 用 playwright-cli 验证 markdown 预览 + 行号定位
#
# 依赖：
#   - GUI 服务运行在 http://localhost:7860
#   - 索引里至少有一个 .md 文件
#   - npx playwright-cli 可用
#
# 运行：bash tests/e2e/verify-md-preview.sh
# 退出码：0 = 通过，1 = 失败

set -euo pipefail

URL="${CORTEX_URL:-http://localhost:7860/}"
QUERY="${CORTEX_SEARCH_QUERY:-工作记录}"
CLI="npx playwright-cli"

echo "[1/8] 关闭旧浏览器（如有）"
$CLI close 2>/dev/null || true

echo "[2/8] 打开浏览器 → $URL"
$CLI open "$URL" >/dev/null
# 等首页 + 历史列表完全渲染
sleep 2

echo "[3/8] 通过 role 选择器定位输入框并填入：$QUERY"
# 用 getByRole 而不是易变的 ref
$CLI fill "getByRole('textbox', { name: '输入搜索关键词' })" "$QUERY" >/dev/null
# 等 Lit 反应式解除 button disabled
sleep 1

echo "[4/8] 点击搜索按钮"
$CLI click "getByRole('button', { name: '搜索' })" >/dev/null

echo "[5/8] 等待搜索结果渲染（轮询 focus-header）"
SNAPSHOT_FILE=".playwright-cli/verify-snap-$(date +%s).yml"
FOCUS_OK=0
for i in $(seq 1 20); do
  $CLI --raw snapshot > "$SNAPSHOT_FILE" 2>/dev/null || true
  if grep -q '"← 返回"' "$SNAPSHOT_FILE" 2>/dev/null; then
    echo "    渲染完成（等待 $i 次轮询）"
    FOCUS_OK=1
    break
  fi
  sleep 1
done
if [ "$FOCUS_OK" -ne 1 ]; then
  echo "FAIL: 搜索未触发或超时（20s 内未见 focus-header）"
  $CLI close 2>/dev/null || true
  exit 1
fi

echo "[6/8] 找到第一张 .md 卡片并点击"
# 卡片结构：result-card 元素内含 .md 文本。用 hasText 选择器。
# playwright-cli 支持 CSS 选择器，但需要 >> 穿透 shadow。这里用 run-code 直接操作。
CLICK_FILE=".playwright-cli/verify-click.js"
cat > "$CLICK_FILE" <<'EOF'
async (page) => {
  // result-card 在 search-view shadow root 内，shadow piercing 用 >>> 或 page.locator 通配
  // 实测：page.locator('result-card') 默认不穿透 shadow；需要用 >> 链
  const card = page.locator('search-view >> result-card', { hasText: '.md' }).first();
  const count = await card.count();
  if (count === 0) throw new Error('NO_MD_CARD');
  await card.click();
  return 'CLICKED';
}
EOF
CLICK_RES=$($CLI run-code --filename="$CLICK_FILE" --json 2>&1 | tail -3)
if echo "$CLICK_RES" | grep -q 'NO_MD_CARD\|error'; then
  echo "FAIL: 没找到 .md 卡片"
  echo "  $CLICK_RES"
  $CLI close 2>/dev/null || true
  exit 1
fi
echo "    $CLICK_RES"
sleep 1

echo "[7/8] 探测 preview-pane → md-viewer shadow DOM"
PROBE_FILE=".playwright-cli/verify-probe.js"
cat > "$PROBE_FILE" <<'EOF'
async (page) => {
  return await page.evaluate(() => {
    const ca = document.querySelector('cortex-app');
    const sv = ca && ca.shadowRoot && ca.shadowRoot.querySelector('search-view');
    const pp = sv && sv.shadowRoot && sv.shadowRoot.querySelector('preview-pane');
    if (!pp) return { error: 'NO_PREVIEW_PANE' };
    const mdv = pp.shadowRoot && pp.shadowRoot.querySelector('md-viewer');
    if (!mdv) return { error: 'NO_MD_VIEWER', language: pp.language };
    const root = mdv.shadowRoot;
    const flashed = root && root.querySelector('.highlight-flash');
    const marked = root ? Array.from(root.querySelectorAll('[data-source-line]')) : [];
    return {
      ok: true,
      mdvLine: mdv.line,
      mdvContentLen: (mdv.content || '').length,
      hasFlashed: !!flashed,
      flashedLine: flashed ? flashed.getAttribute('data-source-line') : null,
      totalMarkedBlocks: marked.length,
    };
  });
}
EOF
# run-code --json 输出完整 JSON 到 stdout
RAW_JSON=$($CLI run-code --filename="$PROBE_FILE" --json 2>/dev/null)
# 把整段 JSON 写入临时文件，让 node 读取（避免 shell 转义噩梦）
echo "$RAW_JSON" > .playwright-cli/verify-raw.json
echo "    raw: $(head -c 200 .playwright-cli/verify-raw.json)"

echo "[8/8] 断言结果"
node -e '
  const fs = require("fs");
  const raw = fs.readFileSync(".playwright-cli/verify-raw.json", "utf8").trim();
  let outer;
  try { outer = JSON.parse(raw); } catch (e) { console.log("FAIL: parse outer:", e.message); process.exit(1); }
  let r = outer.result;
  let v;
  try {
    while (typeof r === "string") r = JSON.parse(r);
    v = r;
  } catch (e) { console.log("FAIL: parse inner:", e.message); process.exit(1); }
  console.log("    数据:", JSON.stringify(v));
  if (v.error) { console.log("FAIL:", v.error); process.exit(1); }
  const pass = v.ok && v.mdvContentLen > 0 && v.hasFlashed && v.totalMarkedBlocks >= 3;
  if (pass) {
    console.log("");
    console.log("================ PASS ================");
    process.exit(0);
  } else {
    console.log("FAIL: 断言不通过");
    console.log("  ok:", v.ok, "mdvContentLen:", v.mdvContentLen, "hasFlashed:", v.hasFlashed, "totalMarkedBlocks:", v.totalMarkedBlocks);
    process.exit(1);
  }
'
EXIT_CODE=$?
$CLI close 2>/dev/null || true
exit $EXIT_CODE
