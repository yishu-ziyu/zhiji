/**
 * Filesystem SHA-256 content-addressed store.
 * Write order: temp file → fsync → atomic rename.
 * Orphan blobs allowed; events must never point at missing blobs.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type CasWriteResult = {
  sha256: string;
  sizeBytes: number;
  path: string;
  created: boolean;
};

export class ContentAddressedStore {
  constructor(private readonly rootDir: string) {
    fs.mkdirSync(this.blobsDir(), { recursive: true });
  }

  private blobsDir(): string {
    return path.join(this.rootDir, "blobs");
  }

  blobPath(sha256: string): string {
    const hex = sha256.replace(/^sha256:/, "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hex)) {
      throw new Error(`invalid sha256: ${sha256}`);
    }
    return path.join(this.blobsDir(), hex.slice(0, 2), hex.slice(2, 4), hex);
  }

  has(sha256: string): boolean {
    return fs.existsSync(this.blobPath(sha256));
  }

  /**
   * Persist bytes under content hash. Idempotent if blob already present.
   * On failure, no partial final path remains (temp cleaned best-effort).
   */
  put(bytes: Uint8Array): CasWriteResult {
    const sha256 = sha256Hex(bytes);
    const finalPath = this.blobPath(sha256);
    if (fs.existsSync(finalPath)) {
      return {
        sha256,
        sizeBytes: bytes.byteLength,
        path: finalPath,
        created: false,
      };
    }
    const dir = path.dirname(finalPath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(
      dir,
      `.tmp-${process.pid}-${randomUUID()}-${sha256.slice(0, 12)}`,
    );
    try {
      const fd = fs.openSync(tmp, "w");
      try {
        fs.writeSync(fd, bytes);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmp, finalPath);
      // Best-effort directory fsync on parent (may no-op on some FS).
      try {
        const dfd = fs.openSync(dir, "r");
        try {
          fs.fsyncSync(dfd);
        } finally {
          fs.closeSync(dfd);
        }
      } catch {
        /* ignore dir fsync failures */
      }
    } catch (error) {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* ignore */
      }
      throw error;
    }
    return {
      sha256,
      sizeBytes: bytes.byteLength,
      path: finalPath,
      created: true,
    };
  }

  read(sha256: string): Uint8Array | null {
    const p = this.blobPath(sha256);
    if (!fs.existsSync(p)) return null;
    return new Uint8Array(fs.readFileSync(p));
  }
}
