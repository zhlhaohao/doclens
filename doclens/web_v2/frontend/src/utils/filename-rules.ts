/** 文件名规则（单一真相源）：mkdir / new-file / rename 三个输入框对话框共用。
 *  后端对齐：与 workdir 写入侧的非法字符/Windows 保留名判定同口径。 */

/** 文件名非法字符（Windows 侧全集）。 */
export const FILENAME_ILLEGAL_RE = /[\\/:*?"<>|]/;

/** Windows 保留设备名（不区分大小写）。 */
export const FILENAME_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** 通用文件名校验：返回错误文案；合法返回 null。 */
export function validateFilename(name: string): string | null {
  if (FILENAME_ILLEGAL_RE.test(name)) return '含非法字符 / \\ : * ? " < > |';
  if (FILENAME_RESERVED_RE.test(name)) return "Windows 保留名";
  return null;
}
