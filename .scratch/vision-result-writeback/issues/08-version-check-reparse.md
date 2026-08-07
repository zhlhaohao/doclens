# 08 — 版本校验与重解读（prompt/模型变更）

**What to build:** `read_back` 校验 payload 中的 model_tag + prompt_version——与当前配置不符时返回 None，使该图重新入队让 Vision Worker 用新 prompt/模型重解读并更新元数据。与现有 PROMPT_VERSION 机制、`vision_requeue_model_changed` 协调（避免两套版本逻辑冲突）。集成测：换 prompt/模型后，旧元数据图自动重新解读、元数据被更新。

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `read_back` 对 model_tag 或 prompt_version 不符的图返回 None
- [ ] 版本不符的图重新入队、Worker 重解读后元数据被更新为新版本
- [ ] 与现有 PROMPT_VERSION / `vision_requeue_model_changed` 协调一致，无重复或冲突
- [ ] 版本一致时走正常读回闭环（不重解读）
