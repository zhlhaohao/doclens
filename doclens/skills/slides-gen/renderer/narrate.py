"""口播合成：deck.md 的 notes → MiniMax T2A → 逐页 mp3。

设计：
- 数据源 = 每页 notes（口播备注纪律：40-260 字/页，正好 15-60 秒）
- 预设音色开箱即用；克隆音色 voice_id 同参数直用（后续 narrate-clone 接入）
- 产物 <名>-audio/p01.mp3…，渲染器外链引用（默认不内嵌，控制 HTML 体积）
- 失败语义与技能一致：警告 + 跳过该页，不中断；一页都没成过才报错

配置（全局 .env，与 VISION_* 同级）：
  MINIMAX_API_KEY=xxx
  MINIMAX_GROUP_ID=xxx        # 控制台「账户-基本信息」19 位数字
  MINIMAX_TTS_MODEL=speech-2.6-hd   # 可选，缺省
  MINIMAX_TTS_BASE=https://api.minimaxi.com  # 可选，缺省国内端点
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import urllib.request
from dataclasses import dataclass, field

PRESET_VOICES = {
    # 常用预设（完整 300+ 见 MiniMax 控制台）
    "presenter_male": "男·播音",
    "presenter_female": "女·播音",
    "male-qn-qingse": "男·青涩",
    "female-tianmei": "女·甜妹",
    "female-chengshu": "女·成熟",
    "audiobook_male_1": "男·有声书",
    "audiobook_female_1": "女·有声书",
}

DEFAULT_MODEL = "speech-2.6-hd"
DEFAULT_BASE = "https://api.minimaxi.com"


class NarrateConfigError(RuntimeError):
    missing: list = []


@dataclass
class NarrateResult:
    out_dir: str = ""
    pages: list[dict] = field(default_factory=list)   # {page, mp3, bytes, secs?}


def _load_conf() -> dict[str, str] | None:
    env = dict(os.environ)
    if not env.get("MINIMAX_API_KEY"):
        for p in (pathlib.Path.home() / ".cortex" / ".env",
                  pathlib.Path.home() / ".doclens" / ".env"):
            if p.exists():
                for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
                break
    if not env.get("MINIMAX_API_KEY") or not env.get("MINIMAX_GROUP_ID"):
        # 给出缺什么的明确提示（而不是笼统 None）
        missing = []
        if not env.get("MINIMAX_API_KEY"):
            missing.append("MINIMAX_API_KEY")
        if not env.get("MINIMAX_GROUP_ID"):
            missing.append("MINIMAX_GROUP_ID")
        NarrateConfigError.missing = missing
        return None
    return {
        "key": env["MINIMAX_API_KEY"],
        "group": env["MINIMAX_GROUP_ID"],
        "model": env.get("MINIMAX_TTS_MODEL", DEFAULT_MODEL),
        "base": env.get("MINIMAX_TTS_BASE", DEFAULT_BASE).rstrip("/"),
    }


def _t2a(conf: dict, text: str, voice: str, speed: float,
         out: pathlib.Path) -> tuple[bool, str]:
    """调 t2a_v2 合成一段；返回 (ok, err_msg)。"""
    url = f"{conf['base']}/v1/t2a_v2?GroupId={conf['group']}"
    payload = {
        "model": conf["model"],
        "text": text,
        "stream": False,
        "output_format": "hex",
        "voice_setting": {
            "voice_id": voice,
            "speed": speed,
            "vol": 1.0,
            "pitch": 0,
        },
        "audio_setting": {
            "sample_rate": 32000,
            "bitrate": 128000,
            "format": "mp3",
            "channel": 1,
        },
    }
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {conf['key']}"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        return False, f"请求失败：{e}"

    base = data.get("base_resp", {})
    if base.get("status_code", -1) != 0:
        return False, f"API {base.get('status_code')}: {base.get('status_msg')}"
    hex_audio = data.get("data", {}).get("audio") or ""
    if not hex_audio:
        return False, "响应无 audio 字段"
    try:
        out.write_bytes(bytes.fromhex(hex_audio))
    except ValueError:
        return False, "audio 非 hex"
    return True, ""


_MD_NOISE = re.compile(r"[*_`#>\[\]()!]")


def clean_notes(text: str) -> str:
    """notes 里的 markdown 标记不读音：去标记、压缩空白。"""
    t = _MD_NOISE.sub(" ", text)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def narrate(md_path: pathlib.Path, voice: str = "presenter_male",
            speed: float = 1.0, pages: list[int] | None = None,
            out_dir: pathlib.Path | None = None) -> tuple[NarrateResult, list[str]]:
    """合成整份 deck 的口播。返回 (result, warnings)。"""
    from .parser import parse_markdown

    warns: list[str] = []
    conf = _load_conf()
    if conf is None:
        raise NarrateConfigError(
            "未配置 MiniMax 语音，缺：" + "、".join(NarrateConfigError.missing)
            + "。GroupId 在 MiniMax 控制台「账户-基本信息的 GroupID」（19 位数字）；"
              "两项都写进全局 .env 即可。")

    class _S:
        def add(self, m): warns.append(m)
    deck = parse_markdown(md_path.read_text(encoding="utf-8"), _S())

    odir = out_dir or md_path.with_suffix("").with_name(
        md_path.stem + "-audio")
    odir.mkdir(parents=True, exist_ok=True)

    res = NarrateResult(out_dir=str(odir))
    for i, slide in enumerate(deck.slides, 1):
        if pages and i not in pages:
            continue
        note = clean_notes(slide.notes or "")
        if not note:
            warns.append(f"P{i} 无 notes，跳过（口播以 notes 为源）")
            continue
        mp3 = odir / f"p{i:02d}.mp3"
        ok, err = _t2a(conf, note, voice, speed, mp3)
        if ok:
            res.pages.append({"page": i, "mp3": str(mp3),
                              "bytes": mp3.stat().st_size})
        else:
            warns.append(f"P{i} 合成失败：{err}")
            if mp3.exists():
                mp3.unlink()
    if not res.pages:
        raise RuntimeError(f"一页都没合成成功：{'; '.join(warns[:3])}")
    return res, warns


def voices() -> list[dict[str, str]]:
    return [{"id": k, "desc": v} for k, v in PRESET_VOICES.items()]


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    ap = argparse.ArgumentParser(prog="slides-gen-narrate",
                                 description="deck.md 的 notes → MiniMax T2A → 逐页 mp3")
    ap.add_argument("input", type=pathlib.Path, help="deck md")
    ap.add_argument("--voice", default="presenter_male",
                    help=f"音色 id（预设：{', '.join(PRESET_VOICES)}；或克隆音色 id）")
    ap.add_argument("--speed", type=float, default=1.0, help="语速 0.5-2.0")
    ap.add_argument("--pages", default="", help="只合成指定页，如 1,3-5")
    ap.add_argument("--list-voices", action="store_true", help="列预设音色")
    args = ap.parse_args(argv)

    if args.list_voices:
        for v in voices():
            print(f"{v['id']:<22} {v['desc']}")
        try:
            from .voice_clone import cloned_voices
            for v in cloned_voices():
                print(f"{v['id']:<22} {v['desc']}")
        except Exception:  # noqa: BLE001
            pass
        return 0

    def _pp(s: str) -> list[int]:
        out: list[int] = []
        for part in s.split(","):
            if not part.strip():
                continue
            if "-" in part:
                a, b = part.split("-", 1)
                out.extend(range(int(a), int(b) + 1))
            else:
                out.append(int(part))
        return sorted(set(out))

    try:
        res, warns = narrate(args.input, voice=args.voice, speed=args.speed,
                             pages=_pp(args.pages))
    except Exception as e:  # noqa: BLE001
        print(f"错误：{e}", file=sys.stderr)
        return 1
    total = sum(p["bytes"] for p in res.pages)
    print(f"OK {len(res.pages)} 页 → {res.out_dir}（{total / 1024:.0f} KB，"
          f"音色 {args.voice}）")
    for p in res.pages:
        print(f"  p{p['page']:02d}.mp3  {p['bytes'] / 1024:.0f} KB")
    for w in warns:
        print(f"  · {w}")
    return 0


if __name__ == "__main__":
    import sys as _s
    _s.exit(main())
