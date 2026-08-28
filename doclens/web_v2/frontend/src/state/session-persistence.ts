/** 四 tab 最后选择的 store 接线层（写入侧集中订阅 + 恢复侧启动一次）。
 *
 * 架构：installSessionMemoryWriter() 常驻订阅 store 关键字段变化 →
 * saveSessionMemory()；applySessionRestore() 仅启动时执行一次，把
 * 记忆写回 store slices（view 之外），view 层只做幂等读取——login
 * 渲染分支卸载重挂 view 后重跑无害（store 单例跨 login 存活）。 */

import { store, actions } from "./store";
import {
  loadSessionMemory,
  saveSessionMemory,
  isValidReviewDate,
  type MainView,
} from "../utils/session-memory";

function isMainView(v: string): v is MainView {
  return v === "search" || v === "chat" || v === "files" || v === "diary";
}

/** 安装集中写入器；返回退订函数（app 挂/卸对称 + 测试用）。
 *  subscribeSelector 严格 !== 比较：组合字段必须派生原始字符串 key，
 *  返回新对象/数组的 selector 会在每次通知时误触发。 */
export function installSessionMemoryWriter(): () => void {
  const unsubs = [
    // settings/login 不写不清（保留上一个主视图）
    store.subscribeSelector(
      (s) => s.view,
      (v) => {
        if (isMainView(v)) saveSessionMemory({ view: v });
      },
    ),
    store.subscribeSelector(
      (s) => `${s.files.currentDir}|${s.files.selectedPaths.join("|")}`,
      () => {
        const f = store.getState().files;
        saveSessionMemory({
          files: { currentDir: f.currentDir, selectedPaths: f.selectedPaths },
        });
      },
    ),
    store.subscribeSelector(
      (s) => s.search.query,
      (q) => saveSessionMemory({ search: { query: q } }),
    ),
    store.subscribeSelector(
      (s) => s.chat.currentSession?.id ?? null,
      (id) => saveSessionMemory({ chat: { sessionId: id ?? "" } }),
    ),
    store.subscribeSelector(
      (s) => `${s.diary.tab}|${s.diary.reviewDate}`,
      () => {
        const d = store.getState().diary;
        saveSessionMemory({ diary: { tab: d.tab, reviewDate: d.reviewDate } });
      },
    ),
  ];
  return () => unsubs.forEach((u) => u());
}

let restored = false;

/** 启动恢复（一次）：把记忆写回 store slices，返回 { view } 供
 *  router.init 作 fallback。search 只恢复 query（state 保持 initial，
 *  用户提交才搜索）；diary 仅 review tab 恢复日期（record 留空由
 *  _init 现算昨天，防陈旧日期）。 */
export function applySessionRestore(): { view?: MainView } | null {
  if (restored) return null; // 模块级 once：login 重挂载/HMR 防重放
  restored = true;
  const mem = loadSessionMemory();
  if (mem.files) {
    actions.setFilesState({
      currentDir: mem.files.currentDir,
      selectedPaths: mem.files.selectedPaths,
    });
  }
  if (mem.search?.query) {
    actions.setSearchState({ query: mem.search.query });
  }
  if (mem.diary) {
    actions.setDiaryState(
      mem.diary.tab === "review" && isValidReviewDate(mem.diary.reviewDate)
        ? { tab: "review", reviewDate: mem.diary.reviewDate }
        : { tab: mem.diary.tab },
    );
  }
  return { view: mem.view };
}

/** 测试专用：清 once 标志。 */
export function _resetSessionRestoreForTest(): void {
  restored = false;
}
