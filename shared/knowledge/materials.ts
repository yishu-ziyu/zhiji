import fs from "node:fs";
import path from "node:path";

export type MaterialKind =
  | "markdown"
  | "text"
  | "html"
  | "image"
  | "audio"
  | "binary"
  | "other";

/** How the overview / materials panel should present a file (A7/A8/M2). */
export type MaterialPreviewMode = "text" | "image" | "audio" | "unsupported";

export type MaterialFile = {
  id: string;
  projectId: string;
  name: string;
  relativePath: string;
  kind: MaterialKind;
  updatedAt: string;
  /** Byte size when known (list/detail). */
  sizeBytes?: number;
  /** B-1: linked KnowledgeCard id (citable object). */
  citationCardId?: string;
  /** B-1: display title for citation (not only disk basename). */
  citationTitle?: string;
};

export type MaterialReadResult = {
  meta: MaterialFile;
  /** Text body only; never binary dump for image/binary. */
  content: string;
  previewMode: MaterialPreviewMode;
  mimeType: string;
  /** User-facing type phrase (M2: 音频/图片/文档…). */
  typeLabel: string;
  /** data: URL for image/audio preview when bytes are available. */
  dataUrl?: string;
  sizeBytes?: number;
  sizeLabel?: string;
  /** Human-readable unsupported hint (A7). */
  unsupportedMessage?: string;
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

const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".ico",
]);

const AUDIO_EXT = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".opus",
]);

const BINARY_EXT = new Set([
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".rar",
  ".7z",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".exe",
  ".dll",
  ".bin",
  ".wasm",
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
]);

const TEXT_EXT = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".html",
  ".htm",
  ".css",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".csv",
  ".xml",
  ".yml",
  ".yaml",
  ".toml",
  ".ini",
  ".log",
  ".svg", // svg also image; classified as image first
]);

export function extensionOf(name: string): string {
  const base = path.basename(name).toLowerCase();
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot);
}

export function kindFromName(name: string): MaterialKind {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".txt")) return "text";
  const ext = extensionOf(lower);
  if (IMAGE_EXT.has(ext)) return "image";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (BINARY_EXT.has(ext)) return "binary";
  if (TEXT_EXT.has(ext)) return "text";
  return "other";
}

export function mimeFromName(name: string): string {
  const ext = extensionOf(name);
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".bmp":
      return "image/bmp";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".ogg":
    case ".opus":
      return "audio/ogg";
    case ".flac":
      return "audio/flac";
    case ".pdf":
      return "application/pdf";
    case ".md":
    case ".markdown":
      return "text/markdown";
    case ".txt":
      return "text/plain";
    case ".html":
    case ".htm":
      return "text/html";
    case ".json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}

/** User-facing type phrase for list/detail (M2). Never lead with binary/other. */
export function typeLabelFromName(name: string): string {
  const kind = kindFromName(name);
  switch (kind) {
    case "markdown":
    case "text":
    case "html":
      return "文档";
    case "image":
      return "图片";
    case "audio":
      return "音频";
    case "binary":
      return "文件";
    default:
      return "其他";
  }
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "未知大小";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function isTextPreviewKind(kind: MaterialKind): boolean {
  return kind === "markdown" || kind === "text" || kind === "html";
}

/** Detect UTF-8 mojibake / control-heavy dumps that must not fill the overview. */
export function looksLikeBinaryText(text: string): boolean {
  if (!text) return false;
  if (text.includes("\u0000")) return true;
  // Replacement chars from binary→utf8 (common after file.text() on PNG).
  const sample = text.slice(0, 4096);
  const replacement = (sample.match(/\uFFFD/g) || []).length;
  if (replacement >= 3) return true;
  // PNG / ZIP / PDF magic when partially preserved
  if (
    sample.startsWith("\uFFFDPNG") ||
    sample.startsWith("PNG\r\n") ||
    sample.includes("IHDR") && sample.includes("IDAT") && sample.length > 200
  ) {
    // PNG-like with binary noise
    if (replacement > 0 || /[\x00-\x08\x0e-\x1f]/.test(sample.slice(0, 200))) {
      return true;
    }
  }
  let control = 0;
  const n = Math.min(sample.length, 2048);
  for (let i = 0; i < n; i += 1) {
    const c = sample.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13) continue;
    if (c < 32) control += 1;
  }
  return n > 0 && control / n > 0.08;
}

export function unsupportedPreviewMessage(
  fileName: string,
  typeLabel: string,
): string {
  return `无法预览此文件\n文件名：${fileName}\n类型：${typeLabel}`;
}

/**
 * Safe card / inspector summary for materials (A7/A8/M2).
 * Never return multi-KB binary dumps into overview.
 */
export function materialCardSummary(
  fileName: string,
  content: string,
): string {
  const kind = kindFromName(fileName);
  const typeLabel = typeLabelFromName(fileName);
  const base = path.basename(fileName) || fileName;
  if (kind === "audio") {
    return `${typeLabel} · ${base}`;
  }
  if (kind === "image" || kind === "binary") {
    return unsupportedPreviewMessage(base, typeLabel);
  }
  if (looksLikeBinaryText(content)) {
    return unsupportedPreviewMessage(base, typeLabel);
  }
  // Keep card searchable without flooding UI.
  if (content.length > 4000) {
    return `${content.slice(0, 4000)}\n…（已截断）`;
  }
  return content;
}

function looksLikeImageBuffer(buf: Buffer, name: string): boolean {
  if (kindFromName(name) === "image") return true;
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return true;
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return true;
  }
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46
  ) {
    return true;
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return true;
  }
  return false;
}

function bufferLooksBinary(buf: Buffer): boolean {
  if (buf.includes(0)) return true;
  const n = Math.min(buf.length, 2048);
  if (n === 0) return false;
  let control = 0;
  for (let i = 0; i < n; i += 1) {
    const b = buf[i];
    if (b === 9 || b === 10 || b === 13) continue;
    if (b < 32) control += 1;
  }
  return control / n > 0.08;
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
      sizeBytes: stat.size,
    });
  }
}

/** Newest first (M2 recency). */
export function listProjectMaterials(projectId: string): MaterialFile[] {
  const dir = projectMaterialsDir(projectId);
  if (!fs.existsSync(dir)) return [];
  const files: MaterialFile[] = [];
  walkMaterials(projectId, dir, dir, files);
  return files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function materialMeta(
  projectId: string,
  relativePath: string,
  updatedAt: string,
  sizeBytes?: number,
): MaterialFile {
  return {
    id: relativePath,
    projectId,
    name: path.basename(relativePath),
    relativePath,
    kind: kindFromName(relativePath),
    updatedAt,
    sizeBytes,
  };
}

export function readProjectMaterial(
  projectId: string,
  fileId: string,
): MaterialReadResult | null {
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
  const meta = materialMeta(
    projectId,
    relativePath,
    stat.mtime.toISOString(),
    stat.size,
  );
  const buf = fs.readFileSync(resolvedFull);
  const mimeType = mimeFromName(relativePath);
  const typeLabel = typeLabelFromName(relativePath);
  const fileName = meta.name;
  const sizeBytes = stat.size;
  const sizeLabel = formatByteSize(sizeBytes);

  // A7: image → preview when bytes look like a real image; never UTF-8 dump.
  if (meta.kind === "image" || looksLikeImageBuffer(buf, relativePath)) {
    const imageMeta = { ...meta, kind: "image" as const };
    // file.text()→utf8 write corrupts PNG: file often starts with EF BF BD (U+FFFD).
    const corruptedUtf8Store =
      buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbf && buf[2] === 0xbd;
    if (corruptedUtf8Store) {
      return {
        meta: imageMeta,
        content: "",
        previewMode: "unsupported",
        mimeType,
        typeLabel,
        sizeBytes,
        sizeLabel,
        unsupportedMessage: unsupportedPreviewMessage(fileName, typeLabel),
      };
    }
    return {
      meta: imageMeta,
      content: "",
      previewMode: "image",
      mimeType,
      typeLabel,
      sizeBytes,
      sizeLabel,
      dataUrl: `data:${mimeType};base64,${buf.toString("base64")}`,
    };
  }

  // M2: audio → playable data URL + meta (not "unsupported text" wall).
  if (meta.kind === "audio") {
    return {
      meta: { ...meta, kind: "audio" },
      content: "",
      previewMode: "audio",
      mimeType,
      typeLabel,
      sizeBytes,
      sizeLabel,
      dataUrl: `data:${mimeType};base64,${buf.toString("base64")}`,
    };
  }

  // A7: non-image non-audio binary
  if (meta.kind === "binary" || bufferLooksBinary(buf)) {
    return {
      meta: { ...meta, kind: meta.kind === "other" ? "binary" : meta.kind },
      content: "",
      previewMode: "unsupported",
      mimeType,
      typeLabel,
      sizeBytes,
      sizeLabel,
      unsupportedMessage: unsupportedPreviewMessage(fileName, typeLabel),
    };
  }

  // A8: text / markdown / html / other-as-text
  const content = buf.toString("utf8");
  if (looksLikeBinaryText(content)) {
    return {
      meta,
      content: "",
      previewMode: "unsupported",
      mimeType,
      typeLabel,
      sizeBytes,
      sizeLabel,
      unsupportedMessage: unsupportedPreviewMessage(fileName, typeLabel),
    };
  }
  return {
    meta,
    content,
    previewMode: "text",
    mimeType,
    typeLabel,
    sizeBytes,
    sizeLabel,
  };
}

/**
 * Write one local file into the project materials store under files/{projectId}/.
 * name may be a nested relative path (A5 folder import).
 * encoding base64 preserves binary (images) without UTF-8 corruption.
 */
export function writeProjectMaterial(
  projectId: string,
  name: string,
  content: string,
  options?: { encoding?: "utf8" | "base64" },
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
  if (options?.encoding === "base64") {
    fs.writeFileSync(resolvedFull, Buffer.from(content, "base64"));
  } else {
    fs.writeFileSync(resolvedFull, content, "utf8");
  }
  const stat = fs.statSync(resolvedFull);
  return materialMeta(
    projectId,
    relativePath,
    stat.mtime.toISOString(),
    stat.size,
  );
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
