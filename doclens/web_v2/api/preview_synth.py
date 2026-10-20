"""DB 合成预览管线（P1-3 拆分自 api/preview.py）。

纯数据变换 + FTS5 读取，无 FastAPI 路由——二进制文档（docx/xlsx/pptx/
epub/图像/PST 派生邮件）的预览内容都从这里合成。独立成模块后可脱离
路由入口直接单测（分页抽取族的 BUG-E1/E3 回归即落在此层）。

消费方：api/preview.py 主分派（GET /preview 的合成分支）。
"""
import os
import re

from doclens.index_manager import IndexManager
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.models.preview import PageMarker, PreviewResponse
from doclens.web_v2.preview_synthesizer import render_tree_to_md

# PST 目录页列出的邮件主题上限（超出只显示总数）
_PST_OVERVIEW_LIST_LIMIT = 200

# MAPI 主题可能带 \x01 等控制字符（go-pst 原样返回），展示前清除
_SUBJECT_CONTROL_CHARS = re.compile(r"[\x00-\x1f]")

_RE_XLSX_ROW_SUFFIX = re.compile(r"\s*\(\d+\s*rows?\)\s*$")


def pst_email_attachments(idx: IndexManager, derived_path: str):
    """取 PST 派生邮件（<pst_rel>#<entry_id>）的附件清单，附下载 URL。

    Returns:
        list[PstAttachmentInfo]；pst_email_meta 无记录（旧索引）返回 None。
    """
    from urllib.parse import quote

    from doclens.web_v2.models.pst import PstAttachmentInfo
    from treesearch.fts import FTS5Index

    pst_rel, sep, entry_id = derived_path.partition("#")
    if not sep:
        return None
    abs_pst = os.path.abspath(os.path.join(idx.search_path, pst_rel))
    fts = FTS5Index(db_path=idx.index_path)
    try:
        atts = fts.get_email_attachments_by_entry(abs_pst, entry_id)
    finally:
        fts.close()
    if atts is None:
        return None

    out = []
    for a in atts:
        stored = bool(a.get("stored")) and bool(a.get("filename"))
        url = None
        if stored:
            url = (
                f"/api/pst/attachment?path={quote(pst_rel, safe='')}"
                f"&entry={quote(entry_id, safe='')}"
                f"&file={quote(a['filename'], safe='')}"
            )
        out.append(PstAttachmentInfo(
            name=a.get("name") or "unnamed",
            size=a.get("size") or 0,
            stored=stored,
            download_url=url,
        ))
    return out


def _clean_subject(name: str) -> str:
    cleaned = _SUBJECT_CONTROL_CHARS.sub("", name or "").strip()
    return cleaned or "(无主题)"


def synthesize_pst_overview(idx: IndexManager, rel_path: str) -> PreviewResponse:
    """PST 物理文件的预览：合成邮件目录页（总数 + 前 N 封主题）。

    注：前端三宿主已在视图层拦截 .pst 换 pst-email-list 分页表格，
    本函数是 API 兜底（直连 /api/preview 的调用方仍可用）。
    """
    from treesearch.fts import FTS5Index

    abs_path = os.path.abspath(os.path.join(idx.search_path, rel_path))
    prefix = abs_path + "#"
    fts = FTS5Index(db_path=idx.index_path)
    try:
        total = fts.count_docs_with_source_prefix(prefix)
        names = fts.list_doc_names_by_source_prefix(prefix, _PST_OVERVIEW_LIST_LIMIT)
    finally:
        fts.close()

    if total == 0:
        raise CortexAPIError(
            status=404,
            code="NOT_INDEXED",
            detail=f"文件未索引，无法预览：{rel_path}。请先执行 cortex index。",
        )

    name = os.path.basename(rel_path)
    lines = [
        f"# {name}",
        "",
        f"Outlook 邮件数据文件，共 **{total}** 封邮件已索引。",
        "",
        "每封邮件是独立文档（路径形如 `<文件名>#<邮件ID>`），"
        "可直接搜索发件人、主题、正文与白名单附件内容。",
        "",
    ]
    if names:
        shown = len(names)
        heading = f"## 邮件主题（前 {shown} 封）" if total > shown else "## 邮件主题"
        lines.append(heading)
        lines.append("")
        lines.extend(f"- {_clean_subject(n)}" for n in names)

    return PreviewResponse(
        path=rel_path,
        language="markdown",
        content="\n".join(lines),
        line_range=None,
        writable=False,
        synthesized=True,
    )


def synthesize_binary_preview(idx: IndexManager, rel_path: str) -> PreviewResponse:
    """从 DB 读 structure_json → 合成 md → 返回 language=markdown。"""
    from treesearch.fts import FTS5Index

    abs_path = os.path.abspath(os.path.join(idx.search_path, rel_path))
    fts = FTS5Index(db_path=idx.index_path)
    try:
        doc = fts.load_document_by_source_path(abs_path)
        # 防御性双查：部分历史索引可能用相对路径存
        if doc is None:
            doc = fts.load_document_by_source_path(rel_path)
    finally:
        fts.close()

    if doc is None:
        raise CortexAPIError(
            status=404,
            code="NOT_INDEXED",
            detail=f"文件未索引，无法预览：{rel_path}。请先执行 cortex index。",
        )

    md_content, line_map = render_tree_to_md(doc.structure, doc.source_type)
    pages, cleaned_md = extract_pages(doc.structure, doc.source_type, md_content, line_map)
    # 图像文件：顶部嵌入原图（经 /api/preview/raw 服务源文件），下方为视觉解析结果
    if doc.source_type == "image":
        from urllib.parse import quote

        raw_url = f"/api/preview/raw?path={quote(rel_path, safe='')}"
        cleaned_md = f"![原图]({raw_url})\n\n{cleaned_md}"
    return PreviewResponse(
        path=rel_path,
        language="markdown",
        content=cleaned_md,
        line_range=None,
        writable=False,  # 合成预览不可写
        synthesized=True,
        pages=pages,
        line_map={str(k): v for k, v in line_map.items()},
    )


# PDF [PAGE N] 标记处理已随 ADR-0031 原生预览退役（页表见 page_starts）


def extract_pages(
    structure: list,
    source_type: str,
    md_content: str,
    line_map: dict | None = None,
):
    """从合成 md + structure 抽取分页信息。

    pdf 不在此列（ADR-0031：PDF 走原生预览，不再合成 md）。

    Args:
        structure: treesearch Document.structure（root 节点列表）
        source_type: Document.source_type（"pptx" / "excel" / ...）
        md_content: render_tree_to_md 的输出
        line_map: render_tree_to_md 的 {node.line_start: md 实际行号}；
          epub 分支依赖它换算分页边界（原始 line_start 体系与 md 行号不一致）

    Returns:
        (pages, cleaned_md)：
        - pages: list[PageMarker] 或 None（不支持的类型或空 structure）
        - cleaned_md: 原样返回 md_content
    """
    if source_type == "pptx":
        return _extract_pptx_pages(structure), md_content
    if source_type == "excel":
        return _extract_excel_pages(structure), md_content
    if source_type == "epub":
        return _extract_epub_pages(structure, line_map or {}), md_content
    return None, md_content


def _extract_epub_pages(structure: list, line_map: dict):
    """EPUB：按章级节点产 pages，line_start 用 md 实际行号。

    epub 经 anydoc→md_to_tree 的树形态：根(书名) → 册壳 → 章(depth-2) → 节。
    章是天然的阅读/分页单位（实测《德川家康》460 章/14.5 万行）。
    - node.line_start 是原始解析体系行号，须经 line_map 换算成 md 实际行号
      （前端 _splitByPages 按它切 md content）
    - 首页强制 line_start=1（书名/册壳 heading 并入第一页，防切丢开头）
    - md 行号不增的空章跳过（并入前页，防零跨度页）
    - 扁平树兜底（BUG-E1 修复）：单章本无册层时 md_to_tree 产出
      「书名 + N 章」同级根列表（无 depth-2）——退化为按根级章节点分页，
      书名根并入首页。
    """
    pages = []
    prev_line = 0
    roots = [structure] if isinstance(structure, dict) else (structure or [])
    for root in roots:
        for vol in root.get("nodes") or []:
            for ch in vol.get("nodes") or []:
                title = (ch.get("title") or "").strip()
                ls = ch.get("line_start") or 1
                md_line = line_map.get(ls) or ls
                if pages and md_line <= prev_line:
                    continue
                line_start = 1 if not pages else md_line
                pages.append(PageMarker(
                    label=title or f"章节 {len(pages) + 1}",
                    line_start=line_start,
                ))
                prev_line = md_line
    if not pages:
        # 扁平树兜底：根级即章（书名根并入首页）
        for root in roots:
            title = (root.get("title") or "").strip()
            ls = root.get("line_start") or 1
            md_line = line_map.get(ls) or ls
            if pages and md_line <= prev_line:
                continue
            line_start = 1 if not pages else md_line
            pages.append(PageMarker(
                label=title or f"章节 {len(pages) + 1}",
                line_start=line_start,
            ))
            prev_line = md_line
    return pages or None


def _extract_pptx_pages(structure: list):
    """PPTX: 返回 pages 或 None。content 由 extract_pages 原样返回。"""
    root = structure[0] if structure else None
    slides = (root.get("nodes", []) if root else []) or []
    if not slides:
        return None

    pages = []
    for i, slide in enumerate(slides):
        title = (slide.get("title") or "").strip()
        label = f"幻灯片 {i + 1}" + (f" · {title}" if title else "")
        line_start = slide.get("line_start") or 1
        pages.append(PageMarker(label=label, line_start=line_start))
    return pages


def _extract_excel_pages(structure: list):
    """Excel: 返回 pages 或 None。content 由 extract_pages 原样返回。"""
    if not structure:
        return None

    pages = []
    for i, sheet in enumerate(structure):
        # excel_parser 把 title 存为 "{sheet_name} ({row_count} rows)"；
        # 卡片标签只需要 sheet 名，剥掉行数后缀。
        title = _RE_XLSX_ROW_SUFFIX.sub("", (sheet.get("title") or "").strip())
        label = f"工作表 {i + 1}" + (f" · {title}" if title else "")
        line_start = sheet.get("line_start") or 1
        pages.append(PageMarker(label=label, line_start=line_start))
    return pages
