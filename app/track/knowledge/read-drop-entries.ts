/**
 * Browser-only: walk DataTransferItemList via webkitGetAsEntry.
 * Returns top-level directories (each → A5 project) and loose files (A1–A3).
 */

import type { ImportFilePayload } from "@/shared/knowledge/folder-import";
import { shouldSkipImportName } from "@/shared/knowledge/folder-import";

export type DropReadResult = {
  directories: Array<{ name: string; files: ImportFilePayload[] }>;
  looseFiles: Array<{ name: string; content: string; file?: File }>;
};

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
  file?: (
    success: (file: File) => void,
    error?: (err: DOMException) => void,
  ) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (err: DOMException) => void,
    ) => void;
  };
};

function readAllDirectoryEntries(reader: {
  readEntries: (
    success: (entries: FileSystemEntryLike[]) => void,
    error?: (err: DOMException) => void,
  ) => void;
}): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntryLike[] = [];
    const pump = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(all);
            return;
          }
          all.push(...batch);
          pump();
        },
        (err) => reject(err),
      );
    };
    pump();
  });
}

function entryFile(entry: FileSystemEntryLike): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!entry.file) {
      reject(new Error("无法读取文件条目"));
      return;
    }
    entry.file(resolve, reject);
  });
}

async function walkDirectory(
  entry: FileSystemEntryLike,
  prefix: string,
): Promise<ImportFilePayload[]> {
  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader();
  const children = await readAllDirectoryEntries(reader);
  const out: ImportFilePayload[] = [];
  for (const child of children) {
    if (shouldSkipImportName(child.name)) continue;
    const rel = prefix ? `${prefix}/${child.name}` : child.name;
    if (child.isFile) {
      const file = await entryFile(child);
      const content = await file.text();
      out.push({ relativePath: rel, content });
    } else if (child.isDirectory) {
      out.push(...(await walkDirectory(child, rel)));
    }
  }
  return out;
}

/** Prefer entry API so dragged folders expand; null if unsupported. */
export async function readDataTransferItems(
  items: DataTransferItemList | null | undefined,
): Promise<DropReadResult | null> {
  if (!items || items.length === 0) return null;

  const directories: Array<{ name: string; files: ImportFilePayload[] }> = [];
  const looseFiles: Array<{ name: string; content: string; file?: File }> = [];
  let sawEntryApi = false;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind !== "file") continue;
    const withEntry = item as DataTransferItem & {
      webkitGetAsEntry?: () => FileSystemEntryLike | null;
      getAsEntry?: () => FileSystemEntryLike | null;
    };
    const getEntry =
      withEntry.webkitGetAsEntry?.bind(item) ??
      withEntry.getAsEntry?.bind(item);
    if (!getEntry) continue;
    const entry = getEntry();
    if (!entry) continue;
    sawEntryApi = true;

    if (entry.isDirectory) {
      if (shouldSkipImportName(entry.name)) continue;
      const files = await walkDirectory(entry, "");
      directories.push({ name: entry.name, files });
      continue;
    }

    if (entry.isFile) {
      const file = item.getAsFile() ?? (await entryFile(entry));
      if (shouldSkipImportName(file.name)) continue;
      const content = await file.text();
      looseFiles.push({ name: file.name, content, file });
    }
  }

  if (!sawEntryApi) return null;
  return { directories, looseFiles };
}
