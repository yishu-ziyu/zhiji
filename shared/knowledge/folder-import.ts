/**
 * A5: map dragged/selected folder trees into projects.
 * Pure logic - no DOM. Browser layer fills File contents then calls these helpers.
 */

export type ImportFilePayload = {
  /** Path relative to the top-level folder, e.g. "a.md" or "sub/a.md". */
  relativePath: string;
  content: string;
};

export type FolderProjectImport = {
  /** Project name = top-level folder name. */
  projectName: string;
  files: ImportFilePayload[];
};

export type DropClassification = {
  /** A5: one project per top-level folder. */
  folderProjects: FolderProjectImport[];
  /** Loose files (no parent folder in the drop) → A1/A2/A3. */
  looseFiles: Array<{ name: string; content: string }>;
};

const SKIP_NAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  ".git",
  "node_modules",
]);

export function shouldSkipImportName(name: string): boolean {
  const base = name.split(/[/\\]/).pop() ?? name;
  if (!base || base === "." || base === "..") return true;
  if (base.startsWith(".")) return true;
  return SKIP_NAMES.has(base.toLowerCase());
}

/**
 * Normalize a path under a top-level folder into a safe relative path
 * (no absolute, no parent traversal).
 */
export function normalizeImportRelativePath(raw: string): string {
  const parts = raw
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..");
  if (parts.length === 0) {
    throw new Error("相对路径无效");
  }
  return parts.join("/");
}

/**
 * Group File-like records that carry webkitRelativePath
 * (folder picker / webkitdirectory).
 *
 * "Alpha/a.md" + "Alpha/sub/b.md" → project Alpha with a.md, sub/b.md
 * "Beta/only.md" → project Beta
 * bare "note.md" (empty relative path) → looseFiles
 */
export function classifyWebkitRelativeFiles(
  files: Array<{
    name: string;
    content: string;
    webkitRelativePath?: string;
  }>,
): DropClassification {
  const folderMap = new Map<string, ImportFilePayload[]>();
  const looseFiles: Array<{ name: string; content: string }> = [];

  for (const file of files) {
    if (shouldSkipImportName(file.name)) continue;
    const rel = (file.webkitRelativePath ?? "").replace(/\\/g, "/").trim();
    if (!rel || !rel.includes("/")) {
      looseFiles.push({ name: file.name, content: file.content });
      continue;
    }
    const segments = rel.split("/").filter(Boolean);
    if (segments.length < 2) {
      looseFiles.push({ name: file.name, content: file.content });
      continue;
    }
    const projectName = segments[0];
    if (shouldSkipImportName(projectName)) continue;
    const relativePath = normalizeImportRelativePath(segments.slice(1).join("/"));
    if (shouldSkipImportName(relativePath)) continue;
    const list = folderMap.get(projectName) ?? [];
    list.push({ relativePath, content: file.content });
    folderMap.set(projectName, list);
  }

  const folderProjects: FolderProjectImport[] = [...folderMap.entries()].map(
    ([projectName, projectFiles]) => ({
      projectName,
      files: projectFiles,
    }),
  );

  return { folderProjects, looseFiles };
}

/**
 * Group results from DataTransfer directory entries.
 * Each top-level directory name becomes a project; files already scoped under it.
 * Top-level loose files stay loose.
 */
export function classifyTopLevelDrop(input: {
  directories: Array<{ name: string; files: ImportFilePayload[] }>;
  looseFiles: Array<{ name: string; content: string }>;
}): DropClassification {
  const folderProjects: FolderProjectImport[] = [];
  for (const dir of input.directories) {
    const projectName = dir.name.trim();
    if (!projectName || shouldSkipImportName(projectName)) continue;
    const files = dir.files
      .filter((file) => !shouldSkipImportName(file.relativePath))
      .map((file) => ({
        relativePath: normalizeImportRelativePath(file.relativePath),
        content: file.content,
      }));
    // Single-level folder with only files still becomes one project (A5).
    folderProjects.push({ projectName, files });
  }
  const looseFiles = input.looseFiles.filter(
    (file) => !shouldSkipImportName(file.name),
  );
  return { folderProjects, looseFiles };
}
