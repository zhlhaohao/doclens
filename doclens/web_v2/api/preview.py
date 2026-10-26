"""GET /api/preview —— 预览主分派与文本路径（P1-3 拆分后保留的枢纽）。

预览域拆分形态（2026-10-20）：
- 本文件：GET /preview 格式分派 + 普通文本路径 + 全域共享的路径/权限工具
- preview_synth.py：DB 合成管线（docx/xlsx/pptx/epub/图像/PST）
- preview_assets.py：字节流四端点（pdf/raw/asset/download）
- preview_mutations.py：写路径（PUT 保存 / rotate / upload + hash 反查）

路径解析相对于 IndexManager.search_path，防止越权访问。
"""
import os
from pathlib import Path

from fastapi import APIRouter, Depends, Query

from doclens.index_manager import IndexManager
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.api import preview_synth
from doclens.web_v2.api.files_browse import (
    is_absolute_browse_path,
    normalize_browse_path,
)
from doclens.web_v2.api.preview_common import (
    BINARY_PREVIEW_EXTS,
    ERR_BINARY_NOT_PREVIEWABLE,
    ERR_FILE_NOT_FOUND,
    compute_writable,
    resolve_path,
    resolve_path_optional,
    resolve_rel_best_effort,
)
from doclens.web_v2.deps import get_index_manager
from doclens.web_v2.models.preview import PreviewResponse

router = APIRouter()

# 二进制嗅探字节数（git is-binary 判据：前导块含 NUL 即二进制）
_BINARY_SNIFF_BYTES = 8192

# ADR-0049 外部图像直读扩展名：与 treesearch IMAGE_EXTENSIONS 同口径
# （png/jpg/jpeg/webp/gif/bmp/tiff/avif…由 raw 端点实际服务字节）。
from treesearch.parsers.image_parser import IMAGE_EXTENSIONS as _OUTSIDE_IMAGE_EXTS  # noqa: E402


def looks_binary(full: Path) -> bool:
    """文本兜底路径的二进制嗅探：前 8KB 含 NUL 字节即判定二进制。

    BINARY_PREVIEW_EXTS 只覆盖**已知解析器**的类型；未知扩展（apk/zip/
    exe/dll/db…）会漏进文本兜底被 read_text(errors="replace") 喷成乱码
    （2026-09-20 实测）。嗅探按内容判定，与扩展名无关，兜住全部未知
    二进制。UTF-16 文本含 NUL 会被误杀——此类文件现状渲染同样是乱码，
    可接受。
    """
    try:
        with open(full, "rb") as f:
            return b"\x00" in f.read(_BINARY_SNIFF_BYTES)
    except OSError:
        return False  # 读失败留给 read_text 的既有错误处理



_LANGUAGE_MAP = {
    ".py": "python", ".md": "markdown", ".txt": "text",
    ".js": "javascript", ".ts": "typescript", ".tsx": "tsx",
    ".html": "html", ".css": "css", ".json": "json",
    ".go": "go", ".rs": "rust", ".java": "java",
    ".c": "c", ".cpp": "cpp",
}






# 兼容别名（AP-22 公共化）
_looks_binary = looks_binary

def _pdf_preview_meta(idx: IndexManager, path: str) -> PreviewResponse:
    """PDF 预览元数据（ADR-0031 原生预览）：language=pdf、无 content。

    附 page_starts（索引有则带、无则 None——未索引/旧索引均返回 None，
    前端跳页静默降级）。路径经 path_map 反查归一（AI 只给文件名场景）。
    """
    from treesearch.fts import FTS5Index

    base = Path(idx.search_path)
    # AP-20：统一走 resolve_rel_best_effort（原此处手抄一份反查）——
    # 文件可能已移走，但仍需正确 rel 查 DB
    resolved = resolve_rel_best_effort(base, path, idx)

    abs_path = os.path.abspath(os.path.join(idx.search_path, resolved))
    page_starts = None
    fts = FTS5Index(db_path=idx.index_path)
    try:
        doc = fts.load_document_by_source_path(abs_path)
        # 防御性双查：部分历史索引可能用相对路径存
        if doc is None:
            doc = fts.load_document_by_source_path(resolved)
    finally:
        fts.close()
    if doc is not None:
        page_starts = doc.page_starts

    return PreviewResponse(
        path=resolved,
        language="pdf",
        content="",
        line_range=None,
        writable=False,  # PDF 不可编辑（BINARY_PREVIEW_EXTS 写回闸门同款语义）
        synthesized=False,  # pdf 是磁盘字节直读（pdf.js 渲染），非 DB 合成
        page_starts=page_starts,
    )


#: ADR-0049：workdir 外二进制合成预览的专属错误码（前端按此渲染
#: 「设为工作目录后可预览」提示页）。线上契约值，勿改。
ERR_OUTSIDE_WORKDIR_PREVIEW = "OUTSIDE_WORKDIR_PREVIEW"

#: ADR-0049：外部图像直读的扩展名（与 raw 端点 IMAGE_EXTENSIONS 对齐口径，
#: 由 preview_assets 侧实际服务；这里只做格式分派）。


def _preview_outside_workdir(path: str) -> PreviewResponse:
    """ADR-0049 整机浏览：workdir 外文件的预览分派。

    - 文本（非 BINARY_PREVIEW_EXTS、非 PST）：磁盘直读 + 二进制嗅探 +
      服务端分词，writable 恒 False（外部只读）；
    - 图像（png/jpg/jpeg/webp/gif/bmp/tiff）：**原始字节直读**——图像
      预览本体（原图渲染）不依赖索引，依赖索引的只是 vision 解读文本。
      合成单行 md（![原图](/api/preview/raw?path=…)），与 workdir 内
      图像预览同形态（md-viewer 渲染），仅缺解读章节；
    - PDF：轻量标记（language=pdf、无 content、page_starts=None——外部
      无索引页表，跳页静默降级），字节由 /api/preview/pdf 直读；
    - 其余二进制（docx/pptx/xlsx/epub/PST，DB 合成依赖索引）：
      422 OUTSIDE_WORKDIR_PREVIEW，前端提示「设为工作目录后可预览」。
    """
    norm = normalize_browse_path(path)
    lower = norm.lower()
    full = Path(norm)
    if lower.endswith(".pst"):
        raise CortexAPIError(
            422, ERR_OUTSIDE_WORKDIR_PREVIEW,
            "PST 预览依赖索引，请将该文件所在目录设为工作目录后重试",
        )
    if lower.endswith(".pdf"):
        if not (full.exists() and full.is_file()):
            raise CortexAPIError(404, ERR_FILE_NOT_FOUND, f"文件不存在: {path}")
        return PreviewResponse(
            path=norm,
            language="pdf",
            content="",
            line_range=None,
            writable=False,
            synthesized=False,
            page_starts=None,
        )
    if lower.endswith(tuple(_OUTSIDE_IMAGE_EXTS)):
        # 图像原始字节直读（raw 端点支持绝对路径）：单行 md 内嵌原图
        if not (full.exists() and full.is_file()):
            raise CortexAPIError(404, ERR_FILE_NOT_FOUND, f"文件不存在: {path}")
        from urllib.parse import quote

        raw_url = f"/api/preview/raw?path={quote(norm, safe='')}"
        return PreviewResponse(
            path=norm,
            language="markdown",
            content=f"![原图]({raw_url})\n\n> 工作目录外图像：仅显示原图（视觉解读需先设为工作目录）。\n",
            line_range=None,
            writable=False,
            synthesized=False,
        )
    if lower.endswith(tuple(BINARY_PREVIEW_EXTS)):
        raise CortexAPIError(
            422, ERR_OUTSIDE_WORKDIR_PREVIEW,
            "该格式的预览依赖索引，请将所在目录设为工作目录后重试",
        )
    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, ERR_FILE_NOT_FOUND, f"文件不存在: {path}")
    if looks_binary(full):
        raise CortexAPIError(
            415, ERR_BINARY_NOT_PREVIEWABLE, "二进制文件不支持预览，请下载后查看"
        )
    try:
        text = full.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        raise CortexAPIError(500, "INTERNAL_ERROR", f"读取失败: {e}") from e

    from doclens.web_v2.syntax_tokens import tokenize_code
    tokens = tokenize_code(text, full.name)

    return PreviewResponse(
        path=norm,
        language=_LANGUAGE_MAP.get(full.suffix.lower(), "text"),
        content=text,
        line_range=None,
        writable=False,  # 外部浏览恒只读（ADR-0049）
        synthesized=False,
        tokens=tokens,
        size_bytes=full.stat().st_size,
    )


@router.get("/preview", response_model=PreviewResponse)
def preview(
    path: str = Query(..., description="相对路径"),
    start_line: int = Query(default=0, ge=0),
    end_line: int = Query(default=0, ge=0),
    idx: IndexManager = Depends(get_index_manager),
):
    """预览主分派（P2-1：同步 def，FastAPI 自动进 threadpool）。

    函数体全同步（read_text / FTS5 查询 / Pygments 分词）——async def 声明
    会把这些阻塞 I/O 压在事件循环上：一个大 md 的读盘+分词期间，搜索/
    SSE/聊天流全部冻结。同步 def 由 Starlette 丢 anyio threadpool（默认
    40 容量），事件循环立即归还。rotate 端点自始就是此形态（先例）。
    """
    base = Path(idx.search_path)
    # ADR-0049 整机浏览：绝对路径 = workdir 外只读预览。文本/PDF 直读磁盘；
    # DB 合成类（docx/pptx/xlsx/epub/图像/PST，依赖索引库）给专属错误码，
    # 前端提示「设为工作目录后可预览」。
    if is_absolute_browse_path(path):
        return _preview_outside_workdir(path)
    # PST 派生路径（"<pst>#<entry_id>"，非真实文件）：直接从 DB 合成 md，
    # 并附附件清单（含下载 URL，ADR-0005）
    if "#" in path and path.split("#", 1)[0].lower().endswith(".pst"):
        resp = preview_synth.synthesize_binary_preview(idx, path)
        atts = preview_synth.pst_email_attachments(idx, path)
        if atts is not None:
            resp = resp.model_copy(update={"attachments": atts})
        return resp
    # PST 物理文件：GB 级二进制，绝不能 read_text（会把事件循环拖死）——
    # 合成邮件目录页（总数 + 前 N 封主题列表）
    if path.lower().endswith(".pst"):
        return preview_synth.synthesize_pst_overview(idx, path)
    # PDF：原生预览（ADR-0031）——轻量标记响应（language=pdf、无 content），
    # 字节由 GET /api/preview/pdf 服务；合成 md 链路对 pdf 退役
    if path.lower().endswith(".pdf"):
        return _pdf_preview_meta(idx, path)
    # 二进制文档：走 DB 合成 md 路径（不能依赖磁盘存在性——可能已索引但文件移走；
    # 也不能直接 _resolve_path 因为它对不存在文件抛 FILE_NOT_FOUND，绕过 NOT_INDEXED 语义）
    if path.lower().endswith(tuple(BINARY_PREVIEW_EXTS)):
        # AP-20：统一走 resolve_path_optional（原此处手抄一份 safe_resolve +
        # path_map 反查）。命中即用反查出的相对路径（AI 只给文件名时 hash 才
        # 对得上）；都不命中仍走合成——合成内部查 DB，未索引返回 NOT_INDEXED。
        resolved = resolve_path_optional(base, path, idx)
        if resolved is not None:
            return preview_synth.synthesize_binary_preview(idx, resolved[1])
        return preview_synth.synthesize_binary_preview(idx, path)

    full, resolved_rel = resolve_path(base, path, idx)

    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, ERR_FILE_NOT_FOUND, f"文件不存在: {path}")

    # 二进制嗅探（按内容，与扩展名无关）：未知二进制不支持预览——不把
    # 字节乱码当文本渲染，引导下载查看（前端通用错误 toast 呈现）
    if looks_binary(full):
        raise CortexAPIError(
            415, ERR_BINARY_NOT_PREVIEWABLE, "二进制文件不支持预览，请下载后查看"
        )

    try:
        text = full.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        raise CortexAPIError(500, "INTERNAL_ERROR", f"读取失败: {e}") from e

    lines = text.split("\n")
    if start_line > 0 or end_line > 0:
        s = max(0, start_line - 1)
        e = end_line if end_line > 0 else len(lines)
        content = "\n".join(lines[s:e])
        line_range = (s + 1, e)
    else:
        content = text
        line_range = None

    # 服务端语法分词（ADR-0032）：整文件分词保证跨行词法（多行字符串/
    # 块注释）正确，再按与 content 相同的口径切片；范围切片同样高亮
    from doclens.web_v2.syntax_tokens import tokenize_code
    tokens_all = tokenize_code(text, full.name)
    if tokens_all is not None:
        tokens = tokens_all[s:e] if line_range else tokens_all
        # 防御：行数失配（异常 lexer）时整体放弃，不渲染错位高亮
        if len(tokens) != len(content.split("\n")):
            tokens = None
    else:
        tokens = None

    return PreviewResponse(
        path=resolved_rel,
        language=_LANGUAGE_MAP.get(full.suffix.lower(), "text"),
        content=content,
        line_range=line_range,
        writable=compute_writable(full, base),
        synthesized=False,
        tokens=tokens,
        size_bytes=full.stat().st_size,
    )
