"""即梦文生图核心客户端（单一真相源）。

职责链：组装 Ark 请求 → 调用 ``/api/v3/images/generations``（同步）→
下载 PNG 落盘知识库 → prompt 写回图像元数据（可搜索、force 重建读回）→
可选 describe=True 入视觉解析队列（图生图场景 prompt 不完整时）。

领域口径见 CONTEXT.md「即梦文生图」等词条（2026-10-28 决议）：
- 落盘目录调用者决定（output_dir），未指定兜底 ``图片/AI/``
- 文件名 = prompt slug + 时间戳；格式固定 png
- 返回本地路径，不返回临时 URL（约 24h 过期）/ base64
- model_tag 独立命名空间 ``jimeng``：read_back 永不过期，不与 vision
  队列的 requeue（按 vision_model_tag 比对）互踩
"""
from __future__ import annotations

import logging
import re
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# 火山方舟（北京区）图片生成端点。
ARK_API_BASE = "https://ark.cn-beijing.volces.com/api/v3"
GENERATIONS_PATH = "/images/generations"

# 兜底落盘目录（相对知识库工作目录）。
DEFAULT_OUTPUT_DIR = "图片/AI"

# 生成图元数据 model_tag（独立命名空间：不参与 vision 队列版本过期判定）。
JIMENG_MODEL_TAG = "jimeng"
JIMENG_PROMPT_VERSION = "1"

# prompt_version 字段（写回 payload 携带；read_back 校验用）。
# 下载超时（秒）：临时 URL 拉取。
_DOWNLOAD_TIMEOUT = 60.0


class JimengError(Exception):
    """即梦生成失败的统一异常（CLI/MCP 壳层转用户可读文本）。"""


def _slugify(prompt: str, max_len: int = 30) -> str:
    """prompt → 文件名安全 slug：保留中日韩文字与字母数字，其余折为 -。"""
    # 保留：CJK 统一表意文字、字母、数字；其余（空格/标点/emoji/路径非法字符）折 -
    cleaned = re.sub(r"[^\w\u4e00-\u9fff]+", "-", prompt.strip(), flags=re.UNICODE)
    cleaned = cleaned.strip("-")
    if not cleaned:
        cleaned = "jimeng"
    return cleaned[:max_len].rstrip("-") or "jimeng"


def _build_request_body(
    prompt: str,
    model: str,
    size: Optional[str],
    seed: Optional[int],
    watermark: bool,
    ref_images_b64: Optional[List[str]],
) -> Dict[str, Any]:
    """组装 Ark /images/generations 请求体（url 响应格式，同步接口）。"""
    body: Dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "response_format": "url",
        "watermark": watermark,
    }
    if size:
        body["size"] = size
    if seed is not None:
        body["seed"] = seed
    if ref_images_b64:
        # 即梦同源框架：image 输入 = 图生图 / 多图融合（单工具复用）
        body["image"] = ref_images_b64
    return body


def _validate_size(size: Optional[str]) -> None:
    """Seedream 4.0 size 语义校验：档位（1K/2K/4K/adaptive）或像素值。

    像素下限 1280x720（921600 像素）、上限 4096x4096；不合法提前本地报错
    （否则 Ark 返回 400 InvalidParameter，报错远端才出）。
    """
    if not size:
        return
    s = size.strip().lower()
    if s in ("1k", "2k", "4k", "adaptive"):
        return
    m = re.match(r"^(\d+)\s*x\s*(\d+)$", s)
    if not m:
        raise JimengError(
            f"size 不合法: {size!r}（应为 1K/2K/4K 档位、adaptive 或 宽x高 像素值）"
        )
    w, h = int(m.group(1)), int(m.group(2))
    if w * h < 921_600:
        raise JimengError(
            f"size {size} 面积过小：Seedream 4.0 最小 1280x720"
            "（921600 像素）；小图请用 1K 档位并在 prompt 里描述构图"
        )
    if w > 4096 or h > 4096:
        raise JimengError(f"size {size} 超上限：单边最大 4096")


def call_ark_generations(
    api_key: str,
    prompt: str,
    model: str,
    *,
    size: Optional[str] = None,
    seed: Optional[int] = None,
    watermark: bool = False,
    ref_images_b64: Optional[List[str]] = None,
    timeout: float = 120.0,
) -> List[str]:
    """调 Ark 同步生成接口，返回临时图片 URL 列表。失败抛 JimengError。"""
    import json
    import urllib.error

    _validate_size(size)
    url = ARK_API_BASE + GENERATIONS_PATH
    payload = _build_request_body(
        prompt, model, size, seed, watermark, ref_images_b64
    )
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", errors="replace")[:500]
        except Exception:  # noqa: BLE001
            pass
        raise JimengError(f"Ark API HTTP {e.code}: {detail or e.reason}") from e
    except urllib.error.URLError as e:
        raise JimengError(f"Ark API 连接失败: {e.reason}") from e

    try:
        result = json.loads(raw)
    except ValueError as e:
        raise JimengError(f"Ark API 响应非 JSON: {raw[:300]}") from e

    if result.get("error"):
        err = result["error"]
        raise JimengError(
            f"Ark API 错误: {err.get('code')} {err.get('message')}"
        )

    urls: List[str] = []
    for item in result.get("data") or []:
        u = item.get("url")
        if u:
            urls.append(u)
    if not urls:
        raise JimengError(f"Ark API 未返回图片 URL: {raw[:300]}")
    return urls


def _download(url: str, dest: Path) -> None:
    """下载临时 URL 到 dest（二进制）。失败抛 JimengError。"""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "doclens-jimeng"})
        with urllib.request.urlopen(req, timeout=_DOWNLOAD_TIMEOUT) as resp:
            dest.write_bytes(resp.read())
    except Exception as e:  # noqa: BLE001
        raise JimengError(f"下载生成图失败: {e}") from e
    if not dest.exists() or dest.stat().st_size == 0:
        raise JimengError(f"下载生成图异常：{dest} 为空")


def _write_prompt_metadata(image_path: Path, prompt: str, model: str) -> None:
    """把 prompt 写进图像元数据（复用写回-读回闭环机制）。

    - model_tag 固定 ``jimeng``（独立命名空间）：read_back 无版本过期，
      force 重建可直接读回，不花视觉 API
    - 写成 markdown 形态：AI 生成图（prompt 即自描述）
    - 失败不抛（与 vision_worker 同口径：写回是尽力而为）
    """
    try:
        from treesearch.parsers import image_metadata

        md = f"AI 生成图。Prompt: {prompt}\n\n模型: {model}"
        ok = image_metadata.write_back(
            str(image_path),
            md,
            model_tag=JIMENG_MODEL_TAG,
            prompt_version=JIMENG_PROMPT_VERSION,
        )
        if not ok:
            logger.warning("[jimeng] prompt 元数据写回失败: %s", image_path)
    except Exception as e:  # noqa: BLE001
        logger.warning("[jimeng] prompt 元数据写回异常: %s", e)


def generate_and_save(
    *,
    api_key: str,
    prompt: str,
    workdir: Path,
    output_dir: Optional[str] = None,
    model: str = "doubao-seedream-4-0",
    size: Optional[str] = None,
    n: int = 1,
    seed: Optional[int] = None,
    watermark: bool = False,
    ref_images: Optional[List[str]] = None,
    describe: bool = False,
    fts: Optional[Any] = None,
    timeout: float = 120.0,
) -> Dict[str, Any]:
    """完整生成管线（CLI / MCP server 共用入口）。

    Args:
        prompt: 生成提示词（必填）
        workdir: 知识库工作目录（output_dir 相对它的根；也是 describe 入队的库）
        output_dir: 落盘子目录（相对 workdir；未指定兜底 ``图片/AI``）
        n: 生成张数（Ark 单请求张数上限内）
        ref_images: 参考图路径列表（workdir 内相对路径或绝对路径；图生图/多图融合）
        describe: True 时入视觉解析队列（默认 False——prompt 已写元数据可搜）
        fts: TreeSearch 实例（describe=True 时入队用；None 时跳过入队）
        timeout: Ark 请求超时（秒）

    Returns:
        ``{"paths": [本地绝对路径], "model": model, "output_dir": 相对目录}``

    Raises:
        JimengError: 配置缺失 / 参考图不可读 / API 失败 / 下载失败
    """
    if not api_key:
        raise JimengError(
            "未配置 JIMENG_API_KEY（在全局配置 .env 中设置，火山方舟 API Key）"
        )

    # 落盘目录解析：相对 workdir；绝对路径直接用（允许出 workdir？——
    # 调用者（agent）给的目录默认信任，与门禁对 bash 写路径的口径一致）
    rel_dir = (output_dir or "").strip() or DEFAULT_OUTPUT_DIR
    out_root = Path(rel_dir)
    if not out_root.is_absolute():
        out_root = workdir / rel_dir
    out_root.mkdir(parents=True, exist_ok=True)

    # 参考图 → base64（Ark image 参数）
    ref_b64: Optional[List[str]] = None
    if ref_images:
        import base64

        ref_b64 = []
        for rp in ref_images:
            p = Path(rp)
            if not p.is_absolute():
                p = workdir / rp
            if not p.is_file():
                raise JimengError(f"参考图不存在: {rp}")
            ref_b64.append(base64.b64encode(p.read_bytes()).decode("ascii"))

    urls = call_ark_generations(
        api_key,
        prompt,
        model,
        size=size,
        seed=seed,
        watermark=watermark,
        ref_images_b64=ref_b64,
        timeout=timeout,
    )
    # 张数：Ark 按 size/sequential 参数控制；单请求多张时 data 数组多条。
    # 若返回数少于 n，按返回处理（不做多请求补齐——agent 可自行重调）。

    slug = _slugify(prompt)
    ts = time.strftime("%Y%m%d-%H%M%S")
    saved: List[str] = []
    for i, u in enumerate(urls):
        suffix = f"-{i + 1}" if len(urls) > 1 else ""
        dest = out_root / f"{slug}-{ts}{suffix}.png"
        _download(u, dest)
        _write_prompt_metadata(dest, prompt, model)
        saved.append(str(dest.resolve()))
        logger.info("[jimeng] 生成图已落盘: %s", dest)

    result: Dict[str, Any] = {
        "paths": saved,
        "model": model,
        "output_dir": rel_dir,
    }

    # describe=True：入视觉解析队列（图生图场景 prompt 不完整描述画面时）
    if describe and fts is not None:
        try:
            for abs_path in saved:
                rel = Path(abs_path).relative_to(workdir).as_posix()
                fts.vision_enqueue(abs_path, rel)
        except Exception as e:  # noqa: BLE001
            logger.warning("[jimeng] describe 入队失败（不影响生成结果）: %s", e)

    return result
