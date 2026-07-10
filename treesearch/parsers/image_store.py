# -*- coding: utf-8 -*-
"""图片落盘存储 —— 把富文档里提取出的图片写成磁盘文件并维护元信息。

供 docx / pptx parser 在解析阶段调用：落盘 + 文档内按 blob sha256 去重，
返回每个图片引用的 markdown 内联语法。预览端点用 ``resolve`` 反查文件。
"""
import hashlib
import json
import logging
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

logger = logging.getLogger(__name__)

# 扩展名 → MIME（缺省 application/octet-stream）
_EXT_TO_MEDIA: dict[str, str] = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "webp": "image/webp",
    "tiff": "image/tiff",
    "tif": "image/tiff",
    "svg": "image/svg+xml",
    "emf": "image/emf",
    "wmf": "image/wmf",
    "ico": "image/x-icon",
}

_META_FILENAME = "_meta.json"


@dataclass(frozen=True)
class ImagePart:
    """待落盘的一张图片。

    Attributes:
        blob: 图片二进制。
        ext: 扩展名（不含点，如 "png"）。
        source_ref: 溯源键，docx 用 rId，pptx 用 "slide{idx}:{shape_id}"。
    """
    blob: bytes
    ext: str
    source_ref: str


@dataclass(frozen=True)
class ImageRef:
    """落盘后返回的图片引用。"""
    seq: int
    inline_md: str


def doc_hash_for(rel_path: str) -> str:
    """rel_path → 12 位 sha256，用作图片子目录名。"""
    return hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:12]


def _normalize_ext(ext: str) -> str:
    return (ext or "").lower().lstrip(".")


def _inline_md(seq: int, rel_path: str) -> str:
    url = f"/api/preview/asset?path={quote(rel_path, safe='')}&id={seq}"
    return f"![图片 {seq}]({url})"


class ImageStore:
    """图片落盘存储（无运行时可变状态，仅持有 images_root）。

    所有方法基于磁盘文件操作，可被索引阶段与预览端点各自独立实例化，
    只要 ``images_root`` 指向同一目录即可。
    """

    def __init__(self, images_root: Path):
        self._root = Path(images_root)

    @property
    def root(self) -> Path:
        return self._root

    def _doc_dir(self, doc_hash: str) -> Path:
        return self._root / doc_hash

    def extract_for_doc(
        self,
        rel_path: str,
        parts: list[ImagePart],
    ) -> dict[str, ImageRef]:
        """把一个文档的图片落盘 + 去重。

        幂等：每次调用先清空该文档的图目录，再重新提取（保证重索引时无旧图残留）。
        文档内按 ``sha256(blob)`` 去重，同图只落一份，多个 source_ref 指向同一 seq。
        """
        if not parts:
            return {}
        dh = doc_hash_for(rel_path)
        doc_dir = self._doc_dir(dh)
        if doc_dir.exists():
            shutil.rmtree(doc_dir, ignore_errors=True)
        doc_dir.mkdir(parents=True, exist_ok=True)

        meta: dict[str, dict] = {}
        refs: dict[str, ImageRef] = {}
        blob_to_seq: dict[str, int] = {}
        seq = 0
        for part in parts:
            sha = hashlib.sha256(part.blob).hexdigest()
            if sha in blob_to_seq:
                s = blob_to_seq[sha]
            else:
                seq += 1
                s = seq
                blob_to_seq[sha] = s
                ext = _normalize_ext(part.ext) or "png"
                fname = f"{s}.{ext}"
                try:
                    (doc_dir / fname).write_bytes(part.blob)
                except OSError as e:
                    logger.warning("Failed to write image %s: %s", fname, e)
                    continue
                meta[str(s)] = {
                    "sha256": sha,
                    "media_type": _EXT_TO_MEDIA.get(ext, "application/octet-stream"),
                    "filename": fname,
                }
            refs[part.source_ref] = ImageRef(seq=s, inline_md=_inline_md(s, rel_path))

        self._write_meta(doc_dir, meta)
        return refs

    def resolve(self, doc_hash: str, seq: int) -> tuple[Path, str] | None:
        """端点用：按 doc_hash + seq 返回 (文件路径, media_type)，缺失返回 None。"""
        doc_dir = self._doc_dir(doc_hash)
        meta = self._load_meta(doc_dir)
        entry = meta.get(str(seq))
        if not entry:
            return None
        path = doc_dir / entry["filename"]
        if not path.exists():
            return None
        return path, entry.get("media_type", "application/octet-stream")

    def purge_doc(self, rel_path: str) -> None:
        """删除单个文档的图目录（用于源文件被删除的清理）。"""
        doc_dir = self._doc_dir(doc_hash_for(rel_path))
        if doc_dir.exists():
            shutil.rmtree(doc_dir, ignore_errors=True)

    def purge_all(self) -> None:
        """清空整个 images_root（用于 force 全量重建）。"""
        if self._root.exists():
            shutil.rmtree(self._root, ignore_errors=True)
        self._root.mkdir(parents=True, exist_ok=True)

    def _load_meta(self, doc_dir: Path) -> dict:
        mp = doc_dir / _META_FILENAME
        if not mp.exists():
            return {}
        try:
            return json.loads(mp.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            logger.warning("image meta corrupted, ignoring: %s", mp)
            return {}

    def _write_meta(self, doc_dir: Path, meta: dict) -> None:
        """原子写 _meta.json：临时文件 + os.replace。"""
        mp = doc_dir / _META_FILENAME
        tmp = mp.with_suffix(".tmp")
        tmp.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, mp)
