import fs from "node:fs";
import path from "node:path";

export type MaterialKind = "markdown" | "text" | "html" | "other";

export type MaterialFile = {
  id: string;
  projectId: string;
  name: string;
  relativePath: string;
  kind: MaterialKind;
  updatedAt: string;
};

function dataRoot(): string {
  return (
    process.env.KNOWLEDGE_DATA_DIR ||
    path.join(process.cwd(), "data", "knowledge")
  );
}

export function projectMaterialsDir(projectId: string): string {
  return path.join(dataRoot(), "files", projectId);
}

export function kindFromName(name: string): MaterialKind {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".txt")) return "text";
  return "other";
}

/** Allow nested paths under the project dir (A5); reject traversal. */
export function sanitizeMaterialRelativePath(name: string): string {
  const parts = name
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.replace(/[\u0000-\u001f<>:"|?*]/g, "_").trim())
    .filter((part) => part && part !== "." && part !== "..");
  if (parts.length === 0) {
    throw new Error("文件名无效");
  }
  return parts.join("/");
}

/** Strip path segments and control characters; keep a single basename. */
export function sanitizeMaterialFileName(name: string): string {
  const base = path.basename(name.trim()).replace(/[\u0000-\u001f<>:"|?*]/g, "_");
  if (!base || base === "." || base === "..") {
    throw new Error("文件名无效");
  }
  if (base.includes("/") || base.includes("\\")) {
    throw new Error("文件名无效");
  }
  return base;
}

function walkMaterials(
  projectId: string,
  root: string,
  current: string,
  out: MaterialFile[],
): void {
  if (!fs.existsSync(current)) return;
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walkMaterials(projectId, root, full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath = path.relative(root, full).split(path.sep).join("/");
    const stat = fs.statSync(full);
    out.push({
      id: relativePath,
      projectId,
      name: path.basename(entry.name),
      relativePath,
      kind: kindFromName(entry.name),
      updatedAt: stat.mtime.toISOString(),
    });
  }
}

export function listProjectMaterials(projectId: string): MaterialFile[] {
  const dir = projectMaterialsDir(projectId);
  if (!fs.existsSync(dir)) return [];
  const files: MaterialFile[] = [];
  walkMaterials(projectId, dir, dir, files);
  return files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function readProjectMaterial(
  projectId: string,
  fileId: string,
): { meta: MaterialFile; content: string } | null {
  if (!fileId || fileId.includes("..")) {
    return null;
  }
  let relativePath: string;
  try {
    relativePath = sanitizeMaterialRelativePath(fileId);
  } catch {
    return null;
  }
  const dir = projectMaterialsDir(projectId);
  const full = path.join(dir, ...relativePath.split("/"));
  const resolvedDir = path.resolve(dir);
  const resolvedFull = path.resolve(full);
  if (
    resolvedFull !== resolvedDir &&
    !resolvedFull.startsWith(resolvedDir + path.sep)
  ) {
    return null;
  }
  if (!fs.existsSync(resolvedFull) || !fs.statSync(resolvedFull).isFile()) {
    return null;
  }
  const stat = fs.statSync(resolvedFull);
  const content = fs.readFileSync(resolvedFull, "utf8");
  return {
    meta: {
      id: relativePath,
      projectId,
      name: path.basename(relativePath),
      relativePath,
      kind: kindFromName(relativePath),
      updatedAt: stat.mtime.toISOString(),
    },
    content,
  };
}

/**
 * Write one local file into the project materials store under files/{projectId}/.
 * name may be a nested relative path (A5 folder import).
 */
export function writeProjectMaterial(
  projectId: string,
  name: string,
  content: string,
): MaterialFile {
  if (!projectId.trim()) throw new Error("项目不存在");
  if (typeof content !== "string") throw new Error("文件内容无效");
  const relativePath = sanitizeMaterialRelativePath(name);
  const dir = projectMaterialsDir(projectId);
  const full = path.join(dir, ...relativePath.split("/"));
  const resolvedDir = path.resolve(dir);
  const resolvedFull = path.resolve(full);
  if (
    resolvedFull !== resolvedDir &&
    !resolvedFull.startsWith(resolvedDir + path.sep)
  ) {
    throw new Error("文件名无效");
  }
  fs.mkdirSync(path.dirname(resolvedFull), { recursive: true });
  fs.writeFileSync(resolvedFull, content, "utf8");
  const stat = fs.statSync(resolvedFull);
  return {
    id: relativePath,
    projectId,
    name: path.basename(relativePath),
    relativePath,
    kind: kindFromName(relativePath),
    updatedAt: stat.mtime.toISOString(),
  };
}

/** Very small markdown → safe HTML (headings, lists, code, paragraphs). */
export function renderMarkdownLite(source: string): string {
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let inCode = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        closeList();
        out.push("<pre><code>");
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(`${line}\n`);
      continue;
    }
    if (/^### /.test(line)) {
      closeList();
      out.push(`<h3>${line.slice(4)}</h3>`);
      continue;
    }
    if (/^## /.test(line)) {
      closeList();
      out.push(`<h2>${line.slice(3)}</h2>`);
      continue;
    }
    if (/^# /.test(line)) {
      closeList();
      out.push(`<h1>${line.slice(2)}</h1>`);
      continue;
    }
    if (/^[-*] /.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${line.slice(2)}</li>`);
      continue;
    }
    closeList();
    if (line.trim() === "") {
      out.push("");
      continue;
    }
    const withBold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out.push(`<p>${withBold}</p>`);
  }
  closeList();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}
