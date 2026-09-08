import { request } from "./client";

/** 工具箱技能（context_menu 有效值为 true 的白名单）条目。 */
export interface SkillInfo {
  name: string;
  description: string;
  /** 前端图标注册表名字（icon.ts 已注册） */
  icon: string;
  /** true = 技能可处理目录（勾选项中的目录保留进清单，如 knowledge-base 目录范围问答） */
  accept_dirs?: boolean;
}

/** 拉取技能工具箱列表。 */
export async function fetchSkills(): Promise<SkillInfo[]> {
  const data = await request<{ skills: SkillInfo[] }>("/api/skills");
  return data.skills ?? [];
}

// ===== 管理面（设置页技能 tab，ADR-0015）=====

/** 管理列表条目：磁盘技能 or 已删除内置技能（灰置可恢复）。 */
export interface SkillManageItem {
  name: string;
  description: string;
  icon: string;
  /** true = 随发行版分发的内置技能（删=标记可恢复）；false = GitHub 安装的外部技能（删=真删） */
  builtin: boolean;
  enabled: boolean;
  context_menu: boolean;
  accept_dirs: boolean;
  deleted: boolean;
  source_url: string | null;
}

export async function listSkillsManage(): Promise<SkillManageItem[]> {
  const data = await request<{ skills: SkillManageItem[] }>("/api/skills/manage");
  return data.skills ?? [];
}

/** 稀疏更新可变状态；未传字段不动。返回更新后的条目。 */
export async function patchSkill(
  name: string,
  updates: Partial<Pick<SkillManageItem, "enabled" | "context_menu" | "accept_dirs">>,
): Promise<SkillManageItem> {
  return request<SkillManageItem>(`/api/skills/${encodeURIComponent(name)}`, {
    method: "PATCH",
    json: updates,
  });
}

export interface SkillInstallPreview {
  source_url: string;
  skills: { name: string; description: string }[];
  /** 与内置技能同名的技能（将被拒绝安装） */
  conflicts: string[];
}

/** GitHub 安装预览（确认弹窗数据源；不写盘）。 */
export async function previewSkillInstall(url: string): Promise<SkillInstallPreview> {
  return request<SkillInstallPreview>("/api/skills/install/preview", {
    method: "POST",
    json: { url },
  });
}

/** GitHub 安装执行。返回安装的技能名列表。 */
export async function installSkill(url: string): Promise<string[]> {
  const data = await request<{ installed: string[] }>("/api/skills/install", {
    method: "POST",
    json: { url },
  });
  return data.installed ?? [];
}

/** 删除技能：内置=标记 deleted（可恢复）；外部=真删目录。 */
export async function deleteSkill(name: string): Promise<void> {
  await request(`/api/skills/${encodeURIComponent(name)}`, { method: "DELETE" });
}

/** 恢复已删除的内置技能。 */
export async function restoreSkill(name: string): Promise<SkillManageItem> {
  return request<SkillManageItem>(`/api/skills/${encodeURIComponent(name)}/restore`, {
    method: "POST",
  });
}
