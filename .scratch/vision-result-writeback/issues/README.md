# 工单索引 — 图像 vision 解读结果写回图像文件元数据

> 来源：grill-with-docs → to-spec → **to-tickets**（build chain）。
> 关联：spec `docs/specs/vision-result-writeback-to-image-metadata.md`、ADR-0009、CONTEXT 术语（图像元数据写回 / 内容指纹 / 写回-读回闭环 / 格式可达性）。

## 工单列表（blockers first）

| # | 标题 | Blocked by |
|---|---|---|
| 01 | 元数据写入库选型探针（spike） | — |
| 02 | image_metadata deep module（JPEG）+ 单元测试 | 01 |
| 03 | file_hash 注入内容指纹口径（JPEG） | 02 |
| 04 | 读回闭环（JPEG）：force 重建不重花 API | 02, 03 |
| 05 | PNG 支持（模块扩展 + 闭环） | 04 |
| 06 | WebP 支持（模块扩展 + 闭环） | 04 |
| 07 | 格式范围收缩：gif/bmp/tiff 不再解读 | 02 |
| 08 | 版本校验与重解读（prompt/模型变更） | 04 |
| 09 | 写回降级与可观测 | 04 |

## 依赖图

```
01 → 02 → 03 → 04 ─┬→ 05
                   ├→ 06
                   ├→ 08
                   └→ 09
          02 ───────→ 07
```

## Frontier（可立即抓取的工单）

- 当前 frontier：**01**（无 blocker）。
- 01 完成后 frontier：02。02 完成后：03 与 07 并行。03 完成后：04。04 完成后：05/06/08/09 并行。

## 工作方式

用 `/implement` 一次一个工单、每个工单用全新 context，工单间清场。frontier 上的工单可并行（多 agent）。

> 注：本项目未配置 mattpocock issue tracker，工单以本地文件形式发布于此（未打 tracker 的 `ready-for-agent` 标签，但每个文件内 `Status: ready-for-agent`）。
