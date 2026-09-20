"""chat 注入消息对的识别标记（单一真相源）。

注入消息对（``<system-reminder>`` 包裹的 user + 紧随 ``"Noted."`` 的
assistant）的标记前缀被三处消费：chat.py（从 history 提取持久化）、
_chat_raw.py（raw_messages 落库时跳过——漏跳会与 skill_context 回放
双重重建，前缀分叉）、_chat_slash.py（斜杠 hint 的构造与去重检测）。
标记格式调整必须全量同步，故集中定义于此（head-context 的
CONTEXT_MARKER 已是 planify 公共常量，不在此重复）。
"""

#: skill body 注入消息的标记前缀（runner _inject_loaded_skill_bodies 产出）
LOADED_SKILL_MARKER = '<loaded-skill name="'

#: 斜杠调用 hint 注入消息的标记前缀（chat.py 发送前注入）
SLASH_HINT_MARKER = '<slash-skill-hint name="'
