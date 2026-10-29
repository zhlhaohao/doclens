"""视觉验收：DOM 几何自检（确定性）+ 视觉模型审美评审（语义）。

确定性检查负责「机器可判定」的硬伤——元素重叠、内容溢出、越界、字号过小；
视觉模型负责「审美」判断——对齐失衡、留白怪异、对比度、信息密度观感。

输出统一为 issues 列表：每条带 type / severity / where / detail / fix，
可直接作为修改指令交给 agent。
"""

from __future__ import annotations

import base64
import json
import os
import re
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# 浏览器内几何自检脚本
# ---------------------------------------------------------------------------

GEOM_JS = r"""
(args) => {
  const pad = args.pad || 0;
  const slide = document.querySelector('.slide.is-active');
  if (!slide) return { issues: [], metrics: {} };
  const sr = slide.getBoundingClientRect();
  const inner = { left: sr.left + pad, top: sr.top + pad,
                  right: sr.right - pad, bottom: sr.bottom - pad };
  const issues = [];
  const SEL = 'p,h1,h2,h3,h4,li,table,pre,blockquote,figure,img,.chart,.img-missing';

  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const label = (el) => {
    const t = (el.innerText || el.getAttribute('alt') || '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 40) || el.tagName.toLowerCase();
  };
  const path = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    return s;
  };

  // 1) 越界：内容跑出安全边距（blank 版式坐标即全页语义，豁免）
  const isBlank = slide.classList.contains('layout-blank');
  const candidates = Array.from(slide.querySelectorAll(SEL)).filter(visible);
  if (!isBlank) candidates.forEach(el => {
    const r = el.getBoundingClientRect();
    const over = Math.max(0, inner.left - r.left, r.right - inner.right,
                          inner.top - r.top, r.bottom - inner.bottom);
    if (over > 6) {
      issues.push({ type: 'out_of_bounds', severity: over > 24 ? 'high' : 'medium',
        where: path(el), detail: `元素越出安全边距 ${over.toFixed(0)}px：「${label(el)}」`,
        fix: '精简该元素文字，或改用更宽松的版式（如 two-col / 缩小图片占位）' });
    }
  });

  // 2a) autofit 已缩到下限仍溢出 → 内容确实超载，必须拆页
  const fit = parseFloat(slide.getAttribute('data-fit') || '1');
  if (fit <= 0.63 && slide.getAttribute('data-fit-overflow') === '1') {
    issues.push({ type: 'overloaded', severity: 'high', where: 'slide',
      detail: '内容超出单页承载（已把字号压到最小仍溢出），必须拆页',
      fix: '把这张拆成两页：一页放主论点，另一页放明细；或删掉 1/3 内容' });
  }

  // 2) 溢出：内容被容器裁切（bbox 比较；.col/.slot-content 有 overflow:hidden）
  Array.from(slide.querySelectorAll('.slot-content,.col,.slide-inner')).forEach(el => {
    if (!visible(el)) return;
    const er = el.getBoundingClientRect();
    let overV = 0;
    const walk = (node) => {
      Array.from(node.children).forEach(ch => {
        // SVG 内部元素的 bbox 不代表布局溢出（坐标轴文字可能临时越出 viewBox），跳过
        if (ch.ownerSVGElement || ch.tagName.toLowerCase() === 'svg') return;
        const cs2 = getComputedStyle(ch);
        if (cs2.display === 'none') return;
        const cr = ch.getBoundingClientRect();
        if (cr.width < 1 && cr.height < 1) return;
        overV = Math.max(overV, cr.bottom - er.bottom, er.top - cr.top);
        if (ch.children.length) walk(ch);
      });
    };
    walk(el);
    if (overV > 12) {
      issues.push({ type: 'overflow', severity: 'high', where: path(el),
        detail: `内容溢出容器 ${overV.toFixed(0)}px（已缩到可读下限仍装不下）：「${label(el)}」`,
        fix: '内容超载：精简 20-30% 文字，或拆成两页；表格列数压到 3-4 列、行数 7 行内' });
    }
  });

  // 3) 重叠：不同块的包围盒相交
  const blocks = candidates.filter(el => !el.closest('td,th'));
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i], b = blocks[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox <= 2 || oy <= 2) continue;
      const inter = ox * oy;
      const smaller = Math.min(ra.width * ra.height, rb.width * rb.height) || 1;
      if (inter / smaller > 0.28) {
        issues.push({ type: 'overlap', severity: 'high', where: `${path(a)} × ${path(b)}`,
          detail: `两个元素重叠 ${(inter / smaller * 100).toFixed(0)}%：「${label(a)}」与「${label(b)}」`,
          fix: '检查版式选择（图文混排用 image-left/right，不要塞进同一栏）' });
      }
    }
  }

  // 3b) 强调色预算：单页 accent 出现次数 ≤3、着色面积 ≤8%
  (function accentBudget() {
    const cs0 = getComputedStyle(slide);
    const accentHex = (cs0.getPropertyValue('--c-accent') || '').trim().toLowerCase();
    const norm = (c) => {
      if (!c) return '';
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return c.trim().toLowerCase();
      return '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('');
    };
    const target = norm(accentHex);
    if (!target) return;
    const hits = [];
    slide.querySelectorAll('*').forEach(el => {
      if (!visible(el)) return;
      const st = getComputedStyle(el);
      const fg = norm(st.color);
      const bgc = norm(st.backgroundColor);
      const isMark = el.tagName === 'MARK';
      const ownsText = (el.innerText || '').trim().length > 0;
      if ((fg === target && ownsText) || bgc === target || isMark) {
        // 只记最外层命中元素，避免父子重复计数
        if (!hits.some(h => h.contains(el))) hits.push(el);
      }
    });
    if (!hits.length) return;
    const area = hits.reduce((sum, el) => {
      const r = el.getBoundingClientRect();
      return sum + r.width * r.height;
    }, 0);
    const sr2 = slide.getBoundingClientRect();
    const ratio = area / (sr2.width * sr2.height);
    if (hits.length > 3) {
      issues.push({ type: 'accent_overuse', severity: 'medium', where: 'slide',
        detail: `强调色出现 ${hits.length} 处，超过 3 处上限（强调过多等于没有强调）`,
        fix: '只保留最关键的一处强调，其余改为加粗或普通字重' });
    }
    if (ratio > 0.08) {
      issues.push({ type: 'accent_area', severity: 'medium', where: 'slide',
        detail: `强调色着色面积占 ${(ratio * 100).toFixed(1)}%，超过 8% 上限`,
        fix: '缩小强调元素（改短高亮片段、别整块铺色），或去掉装饰性用色' });
    }
  })();

  // 4) 字号过小：正文/表格 <16px 在投影上读不清（high），<18px 提醒（medium）
  const texts = Array.from(slide.querySelectorAll('p,li,td,th,h1,h2,h3,h4')).filter(visible);
  let worstFs = 99, worstLabel = '';
  texts.forEach(el => {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < worstFs) { worstFs = fs; worstLabel = label(el); }
  });
  if (worstFs < 16) {
    issues.push({ type: 'tiny_text', severity: 'high', where: 'slide',
      detail: `页内最小字号 ${worstFs.toFixed(1)}px，投影/缩放后不可读：「${worstLabel}」`,
      fix: '内容超载 → 拆页；不要靠缩小字号硬塞。表格行数控制在 7 行内、列数 ≤ 4' });
  } else if (worstFs < 16.5) {
    issues.push({ type: 'tiny_text', severity: 'medium', where: 'slide',
      detail: `页内最小字号 ${worstFs.toFixed(1)}px 偏小，投影时吃力：「${worstLabel}」`,
      fix: '精简该区文字量或拆页，让最小字号回到 18px 以上' });
  }

  // 5) 图片拉伸变形
  Array.from(slide.querySelectorAll('img')).filter(visible).forEach(img => {
    if (!img.naturalWidth) return;
    const r = img.getBoundingClientRect();
    const nat = img.naturalWidth / img.naturalHeight;
    const disp = r.width / r.height;
    const fit = getComputedStyle(img).objectFit;
    if (fit === 'fill' && Math.abs(nat - disp) / nat > 0.15) {
      issues.push({ type: 'image_distorted', severity: 'medium', where: path(img),
        detail: `图片被拉伸变形（原始比 ${nat.toFixed(2)} vs 显示比 ${disp.toFixed(2)}）`,
        fix: '把块指令的 fit 改为 contain 或 cover' });
    }
  });

  // 6) 信息密度：本页可见字符数
  const chars = (slide.innerText || '').replace(/\s/g, '').length;
  const metrics = { chars, slide: { w: sr.width, h: sr.height } };
  if (chars > 420) {
    issues.push({ type: 'too_dense', severity: chars > 620 ? 'high' : 'medium',
      where: 'slide', detail: `本页文字 ${chars} 字，超出单页舒适阅读量`,
      fix: '每页聚焦一个论点；把长列表拆成两页，或把细节移入 notes' });
  }
  if (chars > 0 && chars < 12 && slide.querySelector('img') === null &&
      slide.querySelector('.chart') === null && !slide.querySelector('blockquote')) {
    issues.push({ type: 'too_sparse', severity: 'low', where: 'slide',
      detail: `本页仅 ${chars} 字且无图无表，视觉上会显空`,
      fix: '补充要点、数据或配图' });
  }

  return { issues, metrics };
}
"""

# ---------------------------------------------------------------------------
# 视觉模型评审
# ---------------------------------------------------------------------------

VISION_PROMPT = """你是资深演示文稿视觉审校。下面是一页 PPT 幻灯片的截图（1280×720 或同等比例）。

请只依据**画面本身**判断，重点找这些硬伤与审美问题：
1. 文字与文字、文字与图片、文字与图表是否重叠遮挡
2. 文字是否溢出容器、被裁切、或贴到画面边缘（安全边距不足）
3. 元素对齐是否错乱（该居中的没居中、该等宽的没等宽、栏宽失衡）
4. 留白是否失衡（某侧拥挤、某侧大片空白）
5. 文字与背景对比度是否足够（尤其浅色主题的浅灰字、深色主题的暗字）
6. 图片是否变形、被裁掉关键内容、或尺寸与相邻文字不协调
7. 字号层级是否清晰（标题、正文、注释层次分明）
8. 整体是否像一份专业演示稿（配色协调、装饰克制、信息密度合理）

另外按五个维度给整体印象（只影响描述，不影响 pass 判定）：
- 统一：本页视觉语言是否与整册一致（颜色用法、圆角、装饰克制）
- 层级：标题/正文/注释的主次是否一眼分明
- 细节：对齐、间距、孤字、标点
- 传达：这一页是否只有一个清晰结论
- 节奏：本页信息密度相对前后页是否合适

严格输出一个 JSON 对象，不要任何解释文字、不要 markdown 代码块：
{"pass": true|false, "score": 0-100, "issues": [{"type": "overlap|overflow|misalign|whitespace|contrast|image|hierarchy|density|style", "severity": "high|medium|low", "where": "画面位置，如『左侧栏第二段』", "detail": "问题描述", "fix": "可执行的具体修改建议"}]}

判定的专业前提（避免误判）：
- 内容页「左对齐 + 右侧留白」是专业演示稿的合法版式语言，只有在右侧空白超过版面 55% 且无任何视觉元素时才计为 whitespace 问题，严重度最高 medium。
- 封面 / 章节页 / 结尾页内容居中或左对齐均可，只要标题层级清晰、落款信息可读，不算失衡。
- 单页 4~8 条要点、每页一个论点是合理密度；不要把「信息量适中」判成 too sparse，也不要把正常的段落留白判成空。
- 主题强调色（赭橙等）在整册中重复出现即构成视觉系统，不要因为「某页只出现几次」就判为突兀。
- 不要复述主题色本身（如「橙色项目符号」）作为问题，除非它造成可读性障碍。

判定标准（务必严格遵守，避免过度判定）：
- 只有「会导致信息丢失或无法阅读」的缺陷才给 high：文字被裁切/遮挡、图文重叠、关键内容不可见、对比度低到读不出。
- 观感类问题（留白分布、层级强弱、对齐微差、装饰风格）一律给 medium 或 low，不要给 high。
- score 反映整体完成度：能正常阅读且结构清楚即 ≥ 75；有明显可读性缺陷才低于 75。
- 没有问题就返回 issues 为空数组。
"""


# 视觉评分下限：低于该分视为不通过（medium/low 类观感问题不单独阻断，
# 否则视觉模型对「留白/层级」的判断抖动会让修复循环永不收敛）
SCORE_FLOOR = 70


DECK_CRITIQUE_PROMPT = """你是资深演示设计总监。下面是**同一份演示文稿的全部页面**，按顺序排列（每张是一页）。

请从**整册**角度做五维点评，每维 0-10 分，并指出最需要改的一处：
- 统一 (consistency)：配色、字体、圆角、装饰、间距体系是否是一套
- 层级 (hierarchy)：全册标题与正文的字号/字重关系是否稳定分明
- 细节 (detail)：对齐、留白、孤字、标点等做工
- 传达 (message)：每页是否只讲一个结论，全册连读是否是一段完整叙事
- 节奏 (pacing)：详略交替、版式变化、章节过渡是否有呼吸感

严格输出 JSON，不要任何解释文字、不要 markdown 代码块：
{"scores": {"consistency": 0-10, "hierarchy": 0-10, "detail": 0-10, "message": 0-10, "pacing": 0-10},
 "weakest": "最弱维度英文名",
 "top_fixes": ["整册层面最该改的 1-3 条，每条一句话、可执行"]}
"""


@dataclass
class Issue:
    type: str
    severity: str
    where: str
    detail: str
    fix: str = ""
    source: str = "geom"       # geom | vision

    @property
    def blocking(self) -> bool:
        return self.severity == "high"


@dataclass
class PageReport:
    page: int
    screenshot: str = ""
    score: int = -1          # -1 = 未评估（视觉模型未启用）
    pass_: bool = True
    issues: list[Issue] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    vision_raw: str = ""
    dims: dict[str, int] = field(default_factory=dict)   # 单页五维印象（可选）

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["pass"] = d.pop("pass_")
        return d


# ---------------------------------------------------------------------------
# 视觉模型调用（自足实现：优先 doclens 配置，回退 env / .env）
# ---------------------------------------------------------------------------

def _load_vision_conf() -> dict[str, str] | None:
    try:  # 首选：doclens 既有配置（含协议/模型/密钥）
        from doclens.config import CortexConfig  # type: ignore
        cfg = CortexConfig.load()
        key = getattr(cfg, "vision_api_key", None)
        if key:
            return {
                "protocol": getattr(cfg, "vision_protocol", "openai_compat") or "openai_compat",
                "base_url": getattr(cfg, "vision_base_url", "") or "",
                "model": getattr(cfg, "vision_model", "") or "",
                "api_key": key,
            }
    except Exception:  # noqa: BLE001 —— 脱离 doclens 运行时回退到 env
        pass

    env = dict(os.environ)
    if not env.get("VISION_API_KEY"):
        for p in (Path.home() / ".cortex" / ".env", Path.home() / ".doclens" / ".env"):
            if p.exists():
                for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
                break
    if not env.get("VISION_API_KEY"):
        return None
    return {
        "protocol": env.get("VISION_PROTOCOL", "openai_compat"),
        "base_url": env.get("VISION_BASE_URL", ""),
        "model": env.get("VISION_MODEL", ""),
        "api_key": env["VISION_API_KEY"],
    }


def _post_json(url: str, payload: dict, headers: dict, timeout: int = 120) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def ask_vision(png: bytes, conf: dict[str, str], timeout: int = 120,
               prompt: str = "") -> str:
    b64 = base64.b64encode(png).decode("ascii")
    model = conf["model"]
    key = conf["api_key"]
    if conf["protocol"] == "anthropic":
        base = conf["base_url"].rstrip("/")
        url = base + "/v1/messages" if base.endswith("/anthropic") else base + "/messages"
        payload = {
            "model": model, "max_tokens": 1200,
            "messages": [{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64",
                                             "media_type": "image/png", "data": b64}},
                {"type": "text", "text": prompt or VISION_PROMPT},
            ]}],
        }
        data = _post_json(url, payload, {"x-api-key": key,
                                         "anthropic-version": "2023-06-01"}, timeout)
        parts = data.get("content", [])
        return "".join(p.get("text", "") for p in parts if p.get("type") == "text")
    # OpenAI 兼容
    base = (conf["base_url"] or "https://api.openai.com/v1").rstrip("/")
    url = base + "/chat/completions"
    payload = {
        "model": model, "max_tokens": 1200, "temperature": 0.2,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt or VISION_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]}],
    }
    data = _post_json(url, payload, {"Authorization": f"Bearer {key}"}, timeout)
    return data["choices"][0]["message"]["content"]


def _parse_verdict(raw: str) -> dict:
    """从模型输出里抠出 JSON（容忍代码块、前后废话、尾逗号）。"""
    if not raw:
        return {}
    txt = raw.strip()
    txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt, flags=re.S)
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        fixed = re.sub(r",\s*([}\]])", r"\1", m.group(0))
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            return {}


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def qa_deck(html_path: Path, outdir: Path, *, pages: list[int] | None = None,
            use_vision: bool = True, canvas: tuple[int, int] = (1280, 720),
            pad: int = 72) -> dict[str, Any]:
    from playwright.sync_api import sync_playwright

    outdir.mkdir(parents=True, exist_ok=True)
    conf = _load_vision_conf() if use_vision else None
    degraded_reason = ""
    if use_vision and conf is None:
        use_vision = False
        degraded_reason = "未配置视觉模型（VISION_API_KEY 为空）"
    elif not use_vision:
        degraded_reason = "调用方显式关闭（--no-vision）"

    url = html_path.resolve().as_uri() + "?qa=1"
    reports: list[PageReport] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": canvas[0], "height": canvas[1]},
                                device_scale_factor=2)
        page.goto(url)
        page.wait_for_function("document.body.getAttribute('data-qa-ready') === '1'",
                               timeout=30000)
        total = page.evaluate("window.deck ? window.deck.count : 0")
        targets = pages or list(range(1, total + 1))

        for n in targets:
            if n < 1 or n > total:
                continue
            page.evaluate(f"window.deck.go({n})")
            page.wait_for_timeout(120)
            shot_path = outdir / f"p{n:02d}.png"
            page.locator("#stage").screenshot(path=str(shot_path))
            geom = page.evaluate(GEOM_JS, {"pad": pad})

            rep = PageReport(page=n, screenshot=str(shot_path))
            for it in geom.get("issues", []):
                rep.issues.append(Issue(**{**it, "source": "geom"}))
            rep.metrics = geom.get("metrics", {})

            if use_vision and conf:
                try:
                    raw = ask_vision(shot_path.read_bytes(), conf)
                    rep.vision_raw = raw
                    v = _parse_verdict(raw)
                    if v:
                        rep.score = int(v.get("score", 100))
                        for it in v.get("issues", []) or []:
                            rep.issues.append(Issue(
                                type=str(it.get("type", "style")),
                                severity=str(it.get("severity", "medium")),
                                where=str(it.get("where", "")),
                                detail=str(it.get("detail", "")),
                                fix=str(it.get("fix", "")),
                                source="vision"))
                        # 不采信模型自报的 pass 字段（常与 score/issues 矛盾）；
                        # 通过与否统一由下方「无 high + score >= SCORE_FLOOR」判定
                    else:
                        rep.issues.append(Issue(
                            type="qa_error", severity="low", where="vision",
                            detail="视觉模型输出无法解析为 JSON", source="vision"))
                except Exception as e:  # noqa: BLE001
                    rep.issues.append(Issue(
                        type="qa_error", severity="low", where="vision",
                        detail=f"视觉调用失败：{e}", source="vision"))

            if any(i.blocking for i in rep.issues):
                rep.pass_ = False
            if rep.score >= 0 and rep.score < SCORE_FLOOR:
                rep.pass_ = False
            reports.append(rep)

        # 整册五维评审：把所有页截图拼成一张长图交给视觉模型
        deck_critique: dict[str, Any] = {}
        if use_vision and conf and len(reports) > 1:
            try:
                deck_critique = _deck_critique(reports, conf)
            except Exception as e:  # noqa: BLE001
                deck_critique = {"error": f"整册评审失败：{e}"}

        browser.close()

    failed = [r.page for r in reports if not r.pass_]
    result = {
        "html": str(html_path),
        "critique": deck_critique,
        "total": len(reports),
        "passed": len(reports) - len(failed),
        "failed_pages": failed,
        "all_pass": not failed,
        "vision": bool(use_vision),
        "degraded_reason": degraded_reason,
        "pages": [r.to_dict() for r in reports],
    }
    (outdir / "report.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    (outdir / "report.md").write_text(render_report_md(result), encoding="utf-8")
    return result


def _deck_critique(reports: list[PageReport], conf: dict[str, str]) -> dict[str, Any]:
    """把逐页截图纵向拼成长图，请视觉模型做整册五维点评。"""
    from PIL import Image

    imgs = []
    for r in reports:
        p = Path(r.screenshot)
        if p.exists():
            imgs.append(Image.open(p).convert("RGB"))
    if not imgs:
        return {"error": "无截图可拼"}
    # 缩到宽 720 再纵向拼接，控制请求体积
    w = 720
    scaled = [im.resize((w, int(im.height * w / im.width))) for im in imgs]
    gap = 12
    total_h = sum(im.height for im in scaled) + gap * (len(scaled) - 1)
    sheet = Image.new("RGB", (w, total_h), (24, 26, 30))
    y = 0
    for im in scaled:
        sheet.paste(im, (0, y))
        y += im.height + gap
    import io

    buf = io.BytesIO()
    sheet.save(buf, format="PNG", optimize=True)
    raw = ask_vision(buf.getvalue(), conf, prompt=DECK_CRITIQUE_PROMPT, timeout=180)
    data = _parse_verdict(raw)
    data["_raw"] = raw[:2000]
    return data


def render_report_md(result: dict[str, Any]) -> str:
    lines = ["# 视觉验收报告", ""]
    lines.append(f"- 产物：`{result['html']}`")
    if result.get("vision"):
        lines.append(f"- 通过：{result['passed']} / {result['total']} 页（视觉模型：启用）")
    elif "显式关闭" in (result.get("degraded_reason") or ""):
        lines.append(f"- 几何检查：{result['passed']} / {result['total']} 页通过")
        lines.append("")
        lines.append("> 内容稿模式（`--no-vision`）：只做了确定性几何检查，"
                     "未做审美评审。定稿时跑 `build` 才出完整结论。")
    else:
        reason = result.get("degraded_reason") or "视觉模型不可用"
        lines.append(f"- **几何检查**：{result['passed']} / {result['total']} 页通过")
        lines.append("")
        lines.append("> ⚠ **视觉验收未执行** —— " + reason)
        lines.append("> ")
        lines.append("> **已检查**（确定性规则）：元素重叠、内容裁切、越出安全边距、"
                     "最小字号、信息密度、强调色预算、图片变形")
        lines.append("> ")
        lines.append("> **未检查**（需审美判断）：留白是否失衡、层次是否清晰、"
                     "对比度是否足够、配色是否协调、整体是否专业")
        lines.append("> ")
        lines.append("> 配置视觉模型后重跑 `qa` 才能得到完整结论。")
    if result["failed_pages"]:
        lines.append(f"- **未通过页**：{', '.join('P%d' % p for p in result['failed_pages'])}")
    crit = result.get("critique") or {}
    scores = crit.get("scores") or {}
    if scores:
        names = {"consistency": "统一", "hierarchy": "层级", "detail": "细节",
                 "message": "传达", "pacing": "节奏"}
        lines.append("## 五维自评（整册）")
        lines.append("")
        for k, label in names.items():
            v = scores.get(k, "-")
            lines.append(f"- **{label}** {v} / 10")
        if crit.get("weakest"):
            lines.append(f"- 最弱：**{names.get(crit['weakest'], crit['weakest'])}**")
        fixes = crit.get("top_fixes") or []
        if fixes:
            lines.append("")
            lines.append("整册层面最该改的：")
            for f in fixes:
                lines.append(f"1. {f}")
        lines.append("")

    lines.append("")
    for pg in result["pages"]:
        mark = "PASS" if pg["pass"] else "FAIL"
        score_txt = f"score {pg['score']}" if pg["score"] >= 0 else "score —（未评估）"
        lines.append(f"## P{pg['page']} — {mark}"
                     f"（{score_txt}"
                     f"，几何问题 {sum(1 for i in pg['issues'] if i['source'] == 'geom')}"
                     f"，视觉问题 {sum(1 for i in pg['issues'] if i['source'] == 'vision')}）")
        if not pg["issues"]:
            lines.append("\n无问题。\n")
            continue
        lines.append("")
        for it in sorted(pg["issues"], key=lambda x: {"high": 0, "medium": 1, "low": 2}
                         .get(x["severity"], 3)):
            lines.append(f"- **[{it['severity']}/{it['type']}]** {it['where']}：{it['detail']}")
            if it.get("fix"):
                lines.append(f"  - 修复建议：{it['fix']}")
        lines.append("")
    return "\n".join(lines)
