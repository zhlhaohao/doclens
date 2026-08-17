import { request } from "./client";

/** 工具箱技能（context_menu: true 白名单）条目。 */
export interface SkillInfo {
  name: string;
  description: string;
  /** 前端图标注册表名字（icon.ts 已注册） */
  icon: string;
}

/** 拉取技能工具箱列表。 */
export async function fetchSkills(): Promise<SkillInfo[]> {
  const data = await request<{ skills: SkillInfo[] }>("/api/skills");
  return data.skills ?? [];
}
