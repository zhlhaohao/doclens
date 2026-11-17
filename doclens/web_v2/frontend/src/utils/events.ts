/** 跨组件 window 级事件契约（单一真相源）：事件名此前在 ≥3 文件手写字符串
 *  （手抄跨文件契约字面量，AP-38），改名/排查需全仓 grep。
 *  命名约定：window 总线事件统一 cortex: 前缀。 */

/** 工作目录切换失败通知：workdir-switch-dialog / watch-stream 派发，app.ts 监听。 */
export const WORKDIR_SWAP_FAILED_EVENT = "cortex:workdir-swap-failed";
