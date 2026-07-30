# -*- coding: utf-8 -*-
"""PST 附件落盘存储 —— 把邮件附件从 sidecar 临时目录持久化到数据目录。

供 pst_parser 在解析阶段调用（``store_for_email`` 移动 + 重名去重），
预览端点用 ``resolve`` 反查文件。目录布局：

    <db_parent>/pst_attachments/<doc_hash(pst相对路径)>/<entry_id>/<文件名>

生命周期与 ImageStore 对齐：PST 重索引时该 PST 的目录先清后建（幂等）；
PST 文件删除 → purge_doc 级联；force 全量重建 → purge_all。
"""
import logging
import os
import shutil
from dataclasses import dataclass
from pathlib import Path

from .image_store import doc_hash_for

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StoredAttachment:
    """一个已落盘附件的记录。"""

    name: str       # 原始文件名（MAPI 长文件名）
    size: int
    filename: str   # 落盘后的文件名（去重后，下载端点凭它反查）


class PstAttachmentStore:
    """PST 附件落盘存储（无运行时可变状态，仅持有根目录）。

    索引阶段与预览端点各自独立实例化，只要 ``root`` 指向同一目录即可。
    """

    def __init__(self, root: Path):
        self._root = Path(root)

    @property
    def root(self) -> Path:
        return self._root

    def _pst_dir(self, pst_rel_path: str) -> Path:
        return self._root / doc_hash_for(pst_rel_path)

    def _email_dir(self, pst_rel_path: str, entry_id: str) -> Path:
        return self._pst_dir(pst_rel_path) / str(entry_id)

    def email_dir_for(self, pst_rel_path: str, entry_id: str) -> Path:
        """公开版：取某封邮件的附件目录（不要求存在）。"""
        return self._email_dir(pst_rel_path, entry_id)

    @staticmethod
    def _dedupe_filename(name: str, taken: set[str]) -> str:
        """同一封邮件内重名附件去重：a.doc → a_2.doc。"""
        if name not in taken:
            return name
        stem, dot, ext = name.rpartition(".")
        base, suffix = (stem, "." + ext) if dot else (name, "")
        n = 2
        while f"{base}_{n}{suffix}" in taken:
            n += 1
        return f"{base}_{n}{suffix}"

    def store_for_email(
        self,
        pst_rel_path: str,
        entry_id: str,
        files: list[tuple[str, str]],
    ) -> list["StoredAttachment | None"]:
        """把一封邮件的附件从临时目录移动到持久目录。

        幂等：先清空该邮件的目录再落盘（重索引无残留）。

        Args:
            pst_rel_path: PST 相对 search_path 的 POSIX 路径（与 doc_hash_for 同源）
            entry_id: 邮件 entry_id（字符串形式）
            files: [(tmp_path, original_name)]，仅含 sidecar 实际提取出的附件

        Returns:
            与 files 等长对齐的结果列表；移动失败的位置为 None。
        """
        email_dir = self._email_dir(pst_rel_path, entry_id)
        if email_dir.exists():
            shutil.rmtree(email_dir, ignore_errors=True)
        if not files:
            return []
        email_dir.mkdir(parents=True, exist_ok=True)

        out: list[StoredAttachment | None] = []
        taken: set[str] = set()
        for tmp_path, orig_name in files:
            safe_name = _sanitize_filename(orig_name)
            final_name = self._dedupe_filename(safe_name, taken)
            dest = email_dir / final_name
            try:
                shutil.move(tmp_path, dest)
            except OSError as e:
                logger.warning("Failed to persist attachment %s: %s", orig_name, e)
                out.append(None)
                continue
            taken.add(final_name)
            try:
                size = dest.stat().st_size
            except OSError:
                size = 0
            out.append(StoredAttachment(name=orig_name, size=size, filename=final_name))
        return out

    def resolve(
        self, pst_rel_path: str, entry_id: str, filename: str
    ) -> Path | None:
        """端点用：按 PST 路径 + entry_id + 落盘文件名反查文件。

        filename 必须不含路径分隔符（防越权），且文件必须真实存在。
        """
        if not filename or os.path.basename(filename) != filename:
            return None
        path = self._email_dir(pst_rel_path, entry_id) / filename
        if not path.is_file():
            return None
        return path

    def purge_email(self, pst_rel_path: str, entry_id: str) -> None:
        """删除单封邮件的附件目录（派生文档被移除时级联）。"""
        email_dir = self._email_dir(pst_rel_path, entry_id)
        if email_dir.exists():
            shutil.rmtree(email_dir, ignore_errors=True)

    def purge_doc(self, pst_rel_path: str) -> None:
        """删除整个 PST 的附件目录（PST 重索引或文件删除时级联）。"""
        pst_dir = self._pst_dir(pst_rel_path)
        if pst_dir.exists():
            shutil.rmtree(pst_dir, ignore_errors=True)

    def purge_all(self) -> None:
        """清空整个附件根目录（force 全量重建）。"""
        if self._root.exists():
            shutil.rmtree(self._root, ignore_errors=True)
        self._root.mkdir(parents=True, exist_ok=True)


def _sanitize_filename(name: str) -> str:
    """与 sidecar sanitizeFilename 同规则：Windows 非法字符 → '_'，限长 80。"""
    for ch in '/\\:*?"<>|':
        name = name.replace(ch, "_")
    name = name.strip()
    if len(name) > 80:
        stem, dot, ext = name.rpartition(".")
        if dot and len(ext) <= 10:
            name = name[: 80 - len(ext) - 1] + "." + ext
        else:
            name = name[:80]
    return name or "unnamed"
