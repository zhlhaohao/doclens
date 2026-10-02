/** 未提交改动视图 API（CONTEXT.md 2026-10-01 决议）。 */
import { request } from "./client";

export type ChangeKind = "added" | "modified" | "deleted";
export type Staging = "untracked" | "staged" | "unstaged" | "both";

export interface GitChange {
  path: string;
  kind: ChangeKind;
  staging: Staging;
  size: number;
  old_size: number | null;
  is_binary: boolean;
}

export interface GitChangesResponse {
  changes: GitChange[];
  total: number;
}

export interface GitDiffResponse {
  path: string;
  kind: ChangeKind;
  is_binary: boolean;
  diff: string;
  binary_info: {
    old_size: number | null;
    new_size: number;
    old_sha: string | null;
    new_sha: string | null;
  } | null;
}

export const gitApi = {
  changes: () => request<GitChangesResponse>("/api/git/changes"),
  diff: (path: string) =>
    request<GitDiffResponse>(`/api/git/diff?path=${encodeURIComponent(path)}`),
};
