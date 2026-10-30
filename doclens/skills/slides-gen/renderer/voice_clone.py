"""声音克隆：知识库内音频文件 → MiniMax 上传 + 克隆 → voice_id。

接口链（调研自 MiniMax 文档）：
  1. POST /v1/files/upload?GroupId=…（multipart/form-data, purpose=voice_clone）→ file_id
  2. POST /v1/voice_clone?GroupId=…（file_id + 自定 voice_id）→ 克隆完成
  3. 之后 narrate --voice <voice_id> 直接用

关键事实：
  - 音频要求：mp3/m4a/wav，30 秒~5 分钟，<20MB
  - voice_id 规则：≥8 字符、含字母数字、字母开头
  - 计费：克隆免费，第一次用它合成时才计费
  - 保活：**7 天内不用会被删**；任何一次 T2A 合成即永久保活
  - 克隆音色清单存技能数据目录（不进知识库），narrate --list-voices 一并显示
"""

from __future__ import annotations

import json
import pathlib
import uuid
from dataclasses import dataclass

from .narrate import _load_conf

# 克隆音色清单：跟着技能走（每台机器自己的声音），不放知识库
_VOICES_FILE = pathlib.Path(__file__).resolve().parent.parent / "assets" / "cloned-voices.json"

AUDIO_EXTS = {".mp3", ".m4a", ".wav"}


@dataclass
class CloneResult:
    voice_id: str
    file_id: str = ""
    preview_ok: bool = False


def _load_registry() -> dict:
    if _VOICES_FILE.exists():
        try:
            return json.loads(_VOICES_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {"voices": {}}


def _save_registry(reg: dict) -> None:
    _VOICES_FILE.parent.mkdir(parents=True, exist_ok=True)
    _VOICES_FILE.write_text(json.dumps(reg, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")


def cloned_voices() -> list[dict]:
    """已克隆音色清单（narrate --list-voices 用）。"""
    reg = _load_registry()
    return [{"id": k, "desc": f"克隆·{v.get('label', '')} · {v.get('created', '')[:10]}"}
            for k, v in reg["voices"].items()]


def remove_voice(voice_id: str) -> bool:
    reg = _load_registry()
    if voice_id in reg["voices"]:
        del reg["voices"][voice_id]
        _save_registry(reg)
        return True
    return False


def _validate_audio(path: pathlib.Path) -> tuple[bool, str]:
    if not path.exists():
        return False, f"文件不存在：{path}"
    if path.suffix.lower() not in AUDIO_EXTS:
        return False, f"格式需为 mp3/m4a/wav，当前 {path.suffix}"
    size = path.stat().st_size
    if size > 20 * 1024 * 1024:
        return False, f"超过 20MB（当前 {size / 1024 / 1024:.1f}MB）"
    if size < 10 * 1024:
        return False, f"文件太小（{size} 字节），时长应 ≥30 秒"
    return True, ""


def _upload(conf: dict, path: pathlib.Path) -> str:
    """multipart 上传 → file_id。"""
    import urllib.request
    import uuid as _u

    boundary = _u.uuid4().hex
    url = f"{conf['base']}/v1/files/upload?GroupId={conf['group']}"
    with path.open("rb") as f:
        file_bytes = f.read()

    parts = []
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nvoice_clone\r\n'.encode())
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
        f'filename="{path.name}"\r\n'
        f'Content-Type: application/octet-stream\r\n\r\n'.encode())
    parts.append(file_bytes)
    parts.append(f'\r\n--{boundary}--\r\n'.encode())

    req = urllib.request.Request(
        url, data=b"".join(parts),
        headers={"Authorization": f"Bearer {conf['key']}",
                 "Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST")
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.loads(r.read().decode("utf-8"))
    fid = (data.get("file") or {}).get("file_id", "")
    if not fid:
        base = data.get("base_resp", {})
        raise RuntimeError(f"上传失败：{base.get('status_code')} {base.get('status_msg')}")
    return fid


def _clone(conf: dict, file_id: str, voice_id: str, preview_text: str) -> dict:
    """执行克隆（preview_text 会生成试听，也算一次保活校验）。"""
    import urllib.request

    url = f"{conf['base']}/v1/voice_clone?GroupId={conf['group']}"
    # 不带 preview 参数：preview 走 speech-01-turbo，部分 key 未开通（实测 2013
    # model not allowed）。试听改由 narrate --pages 1 单页真合成代替——那才是
    # 真实用途，还顺带完成 7 天保活。
    payload = {
        "file_id": int(file_id),
        "voice_id": voice_id,
        "noise_reduction": False,
        "need_volume_normalization": False,
        "accuracy": 0.7,
    }
    _ = preview_text  # 保留参数兼容，不再传给接口
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {conf['key']}"}, method="POST")
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


def clone(audio_path: pathlib.Path, label: str = "",
          voice_id: str = "", preview_text: str = "") -> tuple[CloneResult, list[str]]:
    """完整克隆链：校验 → 上传 → 克隆 → 登记。返回 (result, warnings)。"""
    import datetime

    warns: list[str] = []
    conf = _load_conf()
    if conf is None:
        from .narrate import NarrateConfigError
        raise NarrateConfigError(
            "未配置 MiniMax 语音（MINIMAX_API_KEY / MINIMAX_GROUP_ID）")

    ok, err = _validate_audio(audio_path)
    if not ok:
        raise RuntimeError(f"音频校验失败：{err}")

    if not voice_id:
        voice_id = "sg" + uuid.uuid4().hex[:10]     # 规则：字母开头、含数字、≥8 字符
    if not (len(voice_id) >= 8 and voice_id[0].isalpha()
            and any(c.isdigit() for c in voice_id)):
        raise RuntimeError(
            f"voice_id 需 ≥8 字符、字母开头、含数字（当前 {voice_id!r}）")

    file_id = _upload(conf, audio_path)
    resp = _clone(conf, file_id, voice_id, preview_text or "你好，这是我的声音，很高兴认识你。")
    base = resp.get("base_resp", {})
    if base.get("status_code", -1) != 0:
        raise RuntimeError(f"克隆失败：{base.get('status_code')} {base.get('status_msg')}")

    # 登记（含保活提醒）
    reg = _load_registry()
    reg["voices"][voice_id] = {
        "label": label or audio_path.stem,
        "source": str(audio_path),
        "file_id": str(file_id),
        "created": datetime.datetime.now().isoformat(timespec="seconds"),
        "keepalive_deadline": (datetime.datetime.now()
                               + datetime.timedelta(days=7)).isoformat(timespec="seconds"),
    }
    _save_registry(reg)

    demo_audio = (resp.get("demo_audio") or "")[:64]
    return CloneResult(voice_id=voice_id, file_id=str(file_id),
                       preview_ok=bool(demo_audio)), warns


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    ap = argparse.ArgumentParser(prog="slides-gen-voice-clone",
                                 description="音频文件 → MiniMax 声音克隆 → voice_id")
    ap.add_argument("audio", type=pathlib.Path, help="音频文件（mp3/m4a/wav，30s-5min，<20MB）")
    ap.add_argument("--label", default="", help="音色备注名（如「我的声音」）")
    ap.add_argument("--voice-id", default="", help="自定义 voice_id（缺省自动生成）")
    ap.add_argument("--preview-text", default="", help="克隆时同步生成的试听文本")
    args = ap.parse_args(argv)

    try:
        res, warns = clone(args.audio, label=args.label, voice_id=args.voice_id,
                           preview_text=args.preview_text)
    except Exception as e:  # noqa: BLE001
        print(f"错误：{e}", file=sys.stderr)
        return 1
    print(f"OK 克隆完成 voice_id={res.voice_id}"
          + (f"（试听已生成）" if res.preview_ok else ""))
    print(f"使用：narrate deck.md --voice {res.voice_id}")
    print("注意：7 天内至少用它合成一次，否则音色会被删除（合成即永久保活）。")
    for w in warns:
        print(f"  · {w}")
    return 0


if __name__ == "__main__":
    import sys as _s
    _s.exit(main())
