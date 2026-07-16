/**
 * A5 UI copy helpers only.
 * Directory walk / classify live in:
 * - app/track/knowledge/read-drop-entries.ts (G3A)
 * - shared/knowledge/folder-import.ts (G3A)
 */

export function dropOverlayHint(opts: { hasProject: boolean }): string {
  if (opts.hasProject) {
    return "松开：文件加入当前项目 · 文件夹各建为新项目";
  }
  return "松开：文件夹各建为项目 · 单文件则先命名项目";
}
