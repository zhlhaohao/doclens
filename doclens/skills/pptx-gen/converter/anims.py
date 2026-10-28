"""动画注入：OOXML p:timing（元素动画）与 p:transition（页切换）模板。

python-pptx 1.0.x 无公开动画 API——本模块手工构造 timing XML 挂到
slide 的 <p:sld> 下（p:cSld 之后）。模板基于 OOXML preset 体系
（presetID/presetClass/presetSubtype），取值来自 ECMA-376 Part 1
§19.5.9 (presetID) 与 PowerPoint 互换惯例；每个词都按「最小可工作」
形态构造：单场景、按需 after/click 触发、0.3s 递增延迟。

白名单外词汇由 renderer 降级 fade（本模块只服务白名单）。
"""

from __future__ import annotations

from pptx.oxml.ns import nsdecls, qn
from lxml import etree

# ---------------------------------------------------------------------------
# 词汇表：token → (presetClass, presetID, 支持 direction)
# presetClass: 1=entrance 2=emphasis 3=exit
# ---------------------------------------------------------------------------

TOKENS: dict[str, tuple[int, int, bool]] = {
    # 入场 (presetClass=1)
    "enter.appear": (1, 1, False),
    "enter.fade": (1, 10, False),
    "enter.fly-in": (1, 2, True),
    "enter.zoom": (1, 23, False),
    "enter.wipe": (1, 22, True),
    # 退场 (presetClass=3)
    "exit.fade": (3, 10, False),
    "exit.fly-out": (3, 2, True),
    # 强调 (presetClass=2)
    "emphasize.pulse": (2, 26, False),
    "emphasize.grow": (2, 6, False),
}

# direction → presetSubtype（OOXML 方向位）
DIR_SUBTYPE = {
    "left": 8, "right": 2, "up": 4, "down": 1,
}

TRANSITIONS: dict[str, str] = {
    "none": "",
    "fade": '<p:fade {ns}/>',
    "push": '<p:push {ns} dir="u"/>',
    "wipe": '<p:wipe {ns} dir="r"/>',
    "zoom": '<p:zoom {ns} dir="in"/>',
}


def is_valid_token(token: str) -> bool:
    return token in TOKENS


def apply_transition(slide, name: str) -> None:
    """页切换动画：直接插 <p:transition> 到 p:sld（cSld 之后）。"""
    if name not in TRANSITIONS or name == "none":
        return
    tmpl = TRANSITIONS[name]
    el = etree.fromstring(tmpl.format(ns=nsdecls("p")))
    sld = slide._element  # noqa: SLF001 —— python-pptx 无公开 API，约定注入点
    # 移除旧的再插（顺序：cSld 之后）
    for old in sld.findall(qn("p:transition")):
        sld.remove(old)
    csld = sld.find(qn("p:cSld"))
    csld.addnext(el)


def _cTn(tid: int, **attrs: str) -> str:
    a = " ".join(f'{k.replace("_", "-")}="{v}"' for k, v in attrs.items())
    return f'<p:cTn id="{tid}" {a}>'


class TimingBuilder:
    """给单页按序挂多个形状的动画（同一 preset 词 + 各自方向/触发/延迟）。"""

    def __init__(self) -> None:
        self.entries: list[dict] = []  # {shape_id, token, direction, trigger, delay_ms}

    def add(self, shape_id: int, token: str, direction: str = "",
            trigger: str = "after", delay_ms: int = 0) -> None:
        self.entries.append(dict(shape_id=shape_id, token=token, direction=direction,
                                 trigger=trigger, delay_ms=delay_ms))

    # -- XML 组装 ----------------------------------------------------------

    def _build(self) -> str:
        if not self.entries:
            return ""
        # 计数器：cTn id 从 2 起（1 留给根）
        self._next_id = 2

        def nid() -> int:
            v = self._next_id
            self._next_id += 1
            return v

        body: list[str] = []
        for idx, e in enumerate(self.entries):
            preset_class, preset_id, has_dir = TOKENS[e["token"]]
            subtype = DIR_SUBTYPE.get(e["direction"], 0) if has_dir else 0
            delay = e["delay_ms"]
            cond = (
                f'<p:cond delay="{delay}"/>'
                if e["trigger"] == "after" or idx == 0
                else f'<p:cond evt="onClick" delay="0"/><p:cond delay="{delay}"/>'
            )
            node_par = nid()
            node_inner = nid()
            node_eff = nid()
            body.append(f"""
<p:par>
  <p:cTn id="{node_par}" presetID="{preset_id}" presetClass="{
                'entr' if preset_class == 1 else 'emph' if preset_class == 2 else 'exit'
            }" presetSubtype="{subtype}" fill="hold" nodeType="{
                'afterEffect' if e['trigger'] == 'after' and idx > 0 else 'clickEffect' if e['trigger'] == 'click' else 'withEffect' if idx > 0 else 'afterEffect'
            }" dur="500">
    <p:stCondLst><p:cond delay="{'0' if e['trigger'] == 'click' else str(delay)}"/></p:stCondLst>
    <p:childTnLst>
      <p:par>
        <p:cTn id="{node_inner}" fill="hold">
          <p:stCondLst>{cond}</p:stCondLst>
          <p:childTnLst>
            <p:par>
              <p:cTn id="{node_eff}" presetID="{preset_id}" presetClass="{
                'entr' if preset_class == 1 else 'emph' if preset_class == 2 else 'exit'
              }" presetSubtype="{subtype}" fill="hold" grpId="0" nodeType="clickEffect">
                <p:stCondLst><p:cond delay="0"/></p:stCondLst>
                <p:childTnLst>
                  <p:set>
                    <p:cBhvr>
                      <p:cTn id="{nid()}" dur="1" fill="hold">
                        <p:stCondLst><p:cond delay="0"/></p:stCondLst>
                      </p:cTn>
                      <p:tgtEl><p:spTgt spid="{e['shape_id']}"/></p:tgtEl>
                      <p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>
                    </p:cBhvr>
                    <p:to><p:strVal val="visible"/></p:to>
                  </p:set>
                  {self._effect_body(nid, e, preset_class, preset_id, subtype)}
                </p:childTnLst>
              </p:cTn>
            </p:par>
          </p:childTnLst>
        </p:cTn>
      </p:par>
    </p:childTnLst>
  </p:cTn>
</p:par>""")
        return f"""<p:timing {nsdecls('p')}>
  <p:tnLst>
    <p:par>
      <p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot">
        <p:childTnLst>
          <p:seq concurrent="1" nextAc="seek">
            <p:cTn id="{nid()}" dur="indefinite" nodeType="mainSeq">
              <p:childTnLst>{''.join(body)}</p:childTnLst>
            </p:cTn>
            <p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>
            <p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>
          </p:seq>
        </p:childTnLst>
      </p:cTn>
    </p:par>
  </p:tnLst>
</p:timing>"""

    def _effect_body(self, nid, e: dict, preset_class: int,
                     preset_id: int, subtype: int) -> str:
        """按 preset 词生成 anim 效果节点（anim/animEffect 组合）。"""
        token = e["token"]
        tgt = f'<p:tgtEl><p:spTgt spid="{e["shape_id"]}"/></p:tgtEl>'
        if token == "enter.appear":
            return ""
        if token in ("enter.fade", "exit.fade"):
            return f"""<p:animEffect transition="in" filter="fade">
  <p:cBhvr><p:cTn id="{nid()}" dur="500"/><p:tgtEl><p:spTgt spid="{e['shape_id']}"/></p:tgtEl></p:cBhvr>
</p:animEffect>"""
        if token in ("enter.fly-in", "exit.fly-out"):
            # 从方向飞入：anim ppt_x/ppt_y + fade
            d = e["direction"] or "left"
            if d in ("left", "right"):
                attr, frm = "ppt_x", ("0-#ppt_w/2" if d == "left" else "1+#ppt_w/2")
                attr2 = None
            else:
                attr, frm = "ppt_y", ("0-#ppt_h/2" if d == "up" else "1+#ppt_h/2")
                attr2 = None
            to = "#ppt_x" if attr == "ppt_x" else "#ppt_y"
            return f"""<p:anim calcmode="lin" valueType="num">
  <p:cBhvr additive="base"><p:cTn id="{nid()}" dur="500" fill="hold"/>{tgt}
    <p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr>
  <p:tavLst><p:tav tm="0"><p:val><p:strVal val="{frm}"/></p:val></p:tav>
    <p:tav tm="100000"><p:val><p:strVal val="{to}"/></p:val></p:tav></p:tavLst>
</p:anim>"""
        if token == "enter.zoom":
            return f"""<p:animEffect transition="in" filter="fade">
  <p:cBhvr><p:cTn id="{nid()}" dur="500"/>{tgt}</p:cBhvr>
</p:animEffect>
<p:animScale><p:cBhvr><p:cTn id="{nid()}" dur="500" fill="hold"/>{tgt}</p:cBhvr>
  <p:from x="5000" y="5000"/><p:to x="100000" y="100000"/></p:animScale>"""
        if token == "enter.wipe":
            d = {"left": "fromLeft", "right": "fromRight", "up": "fromTop", "down": "fromBottom"}.get(
                e["direction"] or "right", "fromRight")
            return f"""<p:animEffect transition="in" filter="wipe({d})">
  <p:cBhvr><p:cTn id="{nid()}" dur="500"/>{tgt}</p:cBhvr>
</p:animEffect>"""
        if token == "emphasize.pulse":
            return f"""<p:animScale><p:cBhvr><p:cTn id="{nid()}" dur="500" autoRev="1" fill="hold"/>{tgt}</p:cBhvr>
  <p:from x="100000" y="100000"/><p:to x="110000" y="110000"/></p:animScale>"""
        if token == "emphasize.grow":
            return f"""<p:animScale><p:cBhvr><p:cTn id="{nid()}" dur="500" fill="hold"/>{tgt}</p:cBhvr>
  <p:from x="100000" y="100000"/><p:to x="130000" y="130000"/></p:animScale>"""
        return ""  # pragma: no cover

    def apply(self, slide) -> None:
        xml = self._build()
        if not xml:
            return
        timing = etree.fromstring(xml)
        sld = slide._element  # noqa: SLF001
        for old in sld.findall(qn("p:timing")):
            sld.remove(old)
        # timing 必须在 clrMapOvr 之后（无则 cSld 之后）
        anchor = sld.find(qn("p:clrMapOvr"))
        if anchor is None:
            anchor = sld.find(qn("p:cSld"))
        anchor.addnext(timing)
