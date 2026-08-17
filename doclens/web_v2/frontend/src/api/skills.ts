import { request } from "./client";

/** 工具箱技能（context_menu: true 白名单）条目。 */
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
