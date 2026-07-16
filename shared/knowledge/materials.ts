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

export function listProjectMaterials(projectId: string): MaterialFile[] {
  const dir = projectMaterialsDir(projectId);
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: MaterialFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const stat = fs.statSync(full);
    files.push({
      id: entry.name,
      projectId,
      name: entry.name,
      relativePath: entry.name,
      kind: kindFromName(entry.name),
      updatedAt: stat.mtime.toISOString(),
    });
  }
  return files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function readProjectMaterial(
  projectId: string,
  fileId: string,
): { meta: MaterialFile; content: string } | null {
  if (!fileId || fileId.includes("..") || fileId.includes("/") || fileId.includes("\\")) {
    return null;
  }
  const dir = projectMaterialsDir(projectId);
  const full = path.join(dir, fileId);
  if (!full.startsWith(dir) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return null;
  }
  const stat = fs.statSync(full);
  const content = fs.readFileSync(full, "utf8");
  return {
    meta: {
      id: fileId,
      projectId,
      name: fileId,
      relativePath: fileId,
      kind: kindFromName(fileId),
      updatedAt: stat.mtime.toISOString(),
    },
    content,
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
