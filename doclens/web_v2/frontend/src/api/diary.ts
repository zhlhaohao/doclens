import { request, ApiError } from "./client";
import type { DiaryEntry, DiaryFragment } from "../state/types";

export interface TodayResponse {
  today: string;
  entry: DiaryEntry;
}

export interface FragmentResponse {
  fragment: DiaryFragment;
}

export interface CalendarResponse {
  month: string;
  dates: string[];
}

export interface DeleteFragmentResponse {
  deleted: boolean;
}

const qs = (p: string) => `/api/diary${p}`;

export const diaryApi = {
  /** 服务器本地今天 + 当日小节（记录页数据源） */
  today: () => request<TodayResponse>(qs("/today")),

  /** 某日小节（回顾页；empty 时 fragments/content 为空） */
  entry: (date: string) =>
    request<DiaryEntry>(qs(`/entry?date=${encodeURIComponent(date)}`)),

  /** 该月有内容的日期列表（日历打点） */
  calendar: (month: string) =>
    request<CalendarResponse>(qs(`/calendar?month=${encodeURIComponent(month)}`)),

  /** 追加文字片段（归属服务器本地今天） */
  addText: (text: string) =>
    request<FragmentResponse>(qs("/fragments"), { method: "POST", json: { text } }),

  /** 上传照片（可带备注；后端压缩为 1600px/q80 WebP） */
  uploadPhoto: (file: File, caption: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("caption", caption);
    return request<FragmentResponse>(qs("/photos"), { method: "POST", body: fd });
  },

  /** 删除一条片段（仅片段态的日期可删） */
  removeFragment: (date: string, fid: string) =>
    request<DeleteFragmentResponse>(
      qs(`/fragments/${encodeURIComponent(fid)}?date=${encodeURIComponent(date)}`),
      { method: "DELETE" },
    ),

  /** 编辑文字片段正文（保留时间戳与 fid；照片片段不支持） */
  editFragment: (date: string, fid: string, text: string) =>
    request<FragmentResponse>(
      qs(`/fragments/${encodeURIComponent(fid)}?date=${encodeURIComponent(date)}`),
      { method: "PUT", json: { text } },
    ),
};

export { ApiError };
