import type { FileEntry } from "../api/files";

/**
 * Display badge for a known file type.
 *  - `letter`: 1-character uppercase label shown inside the badge (e.g., "P")
 *  - `bg`:     CSS color string for the badge background
 *  - `fg`:     CSS color string for the letter foreground
 */
export interface FileTypeBadge {
  letter: string;
  bg: string;
  fg: string;
}

/**
 * Known file types — Office-style colors + first-letter label.
 * Keys are lowercase extensions (no leading dot).
 */
const KNOWN_TYPES: Record<string, FileTypeBadge> = {
  pdf:  { letter: "P", bg: "#DC2626", fg: "#FFFFFF" },  // red
  doc:  { letter: "D", bg: "#2563EB", fg: "#FFFFFF" },  // blue
  docx: { letter: "D", bg: "#2563EB", fg: "#FFFFFF" },
  xls:  { letter: "X", bg: "#16A34A", fg: "#FFFFFF" },  // green
  xlsx: { letter: "X", bg: "#16A34A", fg: "#FFFFFF" },
  csv:  { letter: "C", bg: "#16A34A", fg: "#FFFFFF" },
  ppt:  { letter: "P", bg: "#EA580C", fg: "#FFFFFF" },  // orange
  pptx: { letter: "P", bg: "#EA580C", fg: "#FFFFFF" },
  md:   { letter: "M", bg: "#6366F1", fg: "#FFFFFF" },  // indigo
  txt:  { letter: "T", bg: "#6B7280", fg: "#FFFFFF" },  // gray
};

/**
 * Extract the file extension (without leading dot, lowercased).
 *
 *  - "report.xlsx"     → "xlsx"
 *  - "data.TAR.GZ"     → "gz"        // last extension only
 *  - "README"          → ""          // no extension
 *  - ".gitignore"      → ""          // hidden file → treat as no extension
 *  - "archive."        → ""          // trailing dot, empty after
 *  - ""                → ""
 */
export function getExtension(name: string): string {
  if (!name) return "";
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return "";                          // no dot, or dotfile
  if (lastDot === name.length - 1) return "";           // trailing dot, empty after
  return name.slice(lastDot + 1).toLowerCase();
}

/**
 * Return a badge for a known file type, or null if the type is not recognized
 * (or the entry is a directory).
 *
 *  - directory             → null  (caller renders 📁)
 *  - "report.pdf"          → { letter: "P", bg: "#DC2626", fg: "#FFFFFF" }
 *  - "archive.zip" / "script.py" / "README" → null  (caller renders 📄)
 */
export function getFileTypeBadge(name: string, isDir: boolean): FileTypeBadge | null {
  if (isDir) return null;
  const ext = getExtension(name);
  return KNOWN_TYPES[ext] ?? null;
}

/**
 * Return the text shown in the "类型" column.
 *
 *  - directory                → "文件夹"
 *  - "report.xlsx"            → "xlsx"
 *  - "README" (no extension)  → ""
 */
export function getTypeLabel(entry: FileEntry): string {
  if (entry.is_dir) return "文件夹";
  return getExtension(entry.name);
}
