/** 数字员工 API 客户端（ADR-0062/0063）。 */
import { request } from "./client";

export interface Employee {
  id: string;
  name: string;
  description: string;
  prompt: string;
  tools_allow: string[];
  tools_deny: string[];
  skills_allow: string[];
  model_preset_id: string;
  review_model_preset_id: string | null;
  thinking_depth: "auto" | "off" | "low" | "medium" | "high";
  artifact_root: string;
  template_path: string | null;
  review_criteria: string;
  score_threshold: number;
  max_iterations: number;
  created_at: string;
  updated_at: string;
  /** 派生：模型预设已不存在（不可派活） */
  model_missing: boolean;
  review_model_missing: boolean;
}

export type EmployeeInput = Omit<Employee, "id" | "created_at" | "updated_at" | "model_missing" | "review_model_missing">;

export interface ToolCatalogItem {
  name: string;
  group: "builtin" | "kb" | "mcp";
  server: string | null;
  writable: boolean;
  forbidden: boolean;
}

export interface SkillCatalogItem {
  name: string;
  description: string;
}

export interface DispatchResult {
  session_id: string;
  employee_id: string;
  artifact_dir: string;
}

export interface RunInfo {
  session_id: string;
  started_at: string;
  iteration: number;
}

export async function listEmployees(): Promise<Employee[]> {
  const r = await request<{ employees: Employee[] }>("/api/employees");
  return r.employees;
}

export async function getEmployee(id: string): Promise<Employee> {
  return request<Employee>(`/api/employees/${encodeURIComponent(id)}`);
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  return request<Employee>("/api/employees", { method: "POST", json: input });
}

export async function updateEmployee(id: string, patch: Partial<EmployeeInput>): Promise<Employee> {
  return request<Employee>(`/api/employees/${encodeURIComponent(id)}`, { method: "PUT", json: patch });
}

/** 删除；有进行中派活时后端 409，抛出的 Error.message 为后端 detail。 */
export async function deleteEmployee(id: string): Promise<void> {
  await request<{ ok: true }>(`/api/employees/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getToolCatalog(): Promise<ToolCatalogItem[]> {
  const r = await request<{ tools: ToolCatalogItem[] }>("/api/employees/tools");
  return r.tools;
}

export async function getSkillCatalog(): Promise<SkillCatalogItem[]> {
  const r = await request<{ skills: SkillCatalogItem[] }>("/api/employees/skills");
  return r.skills;
}

export async function getRunning(id: string): Promise<RunInfo | null> {
  const res = await fetch(`/api/employees/${encodeURIComponent(id)}/running`, { credentials: "same-origin" });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`查询进行中派活失败（${res.status}）`);
  return (await res.json()) as RunInfo;
}

/** 会话里留档的派活事件（自定义 kind 条目；由 sessions detail 透出）。 */
export interface ReviewEvent {
  iteration: number;
  kind: "review" | "no_artifact" | "failed";
  score: number | null;
  threshold: number;
  passed: boolean;
  issues: string[];
  suggestions: string[];
  summary: string;
  error: string;
}

export type AssignmentOutcome = "passed" | "exhausted" | "review_failed" | "stopped" | "interrupted";

export interface AssignmentStartEvent {
  employee_id: string;
  employee_name: string;
  artifact_dir: string;
  threshold: number;
  max_iterations: number;
  task: string;
}

export interface AssignmentEndEvent {
  outcome: AssignmentOutcome;
  score: number | null;
  iterations: number;
  employee_id: string | null;
}

export async function dispatchEmployee(id: string, task: string): Promise<DispatchResult> {
  return request<DispatchResult>(`/api/employees/${encodeURIComponent(id)}/dispatch`, {
    method: "POST",
    json: { task },
  });
}
