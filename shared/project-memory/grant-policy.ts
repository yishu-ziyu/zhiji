/**
 * Grant access policy — applied BEFORE any file body read / hash / CAS write.
 * PR-03: metadata-only preflight + default deny for secrets & heavy dirs.
 */

export const GRANT_POLICY_VERSION = "v1.0.0";

export type GrantPolicyDecision =
  | "allow"
  | "block"
  | "skip"
  | "metadata_only";

export type GrantPolicyRule = {
  id: string;
  /** Minimatch-ish globs; matched against posix relative paths. */
  patterns: string[];
  decision: GrantPolicyDecision;
  reason: string;
};

export type GrantPolicy = {
  version: string;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxFiles: number;
  /** When true, only these extensions may be read as body (after block rules). */
  textExtensions: string[];
  rules: GrantPolicyRule[];
};

export const DEFAULT_GRANT_POLICY: GrantPolicy = {
  version: GRANT_POLICY_VERSION,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
  maxFiles: 5_000,
  textExtensions: [
    ".md",
    ".txt",
    ".json",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".rs",
    ".go",
    ".java",
    ".kt",
    ".swift",
    ".yml",
    ".yaml",
    ".toml",
    ".ini",
    ".csv",
    ".html",
    ".css",
    ".scss",
    ".sql",
    ".sh",
    ".zsh",
    ".bash",
    ".env.example",
  ],
  rules: [
    {
      id: "block-git",
      patterns: [".git", ".git/**"],
      decision: "skip",
      reason: "Git 对象与元数据默认不进项目记忆",
    },
    {
      id: "block-deps",
      patterns: [
        "node_modules",
        "node_modules/**",
        "vendor",
        "vendor/**",
        ".pnpm-store/**",
      ],
      decision: "skip",
      reason: "依赖目录体积大且通常非项目理解目标",
    },
    {
      id: "block-build",
      patterns: [
        ".next",
        ".next/**",
        "dist",
        "dist/**",
        "build",
        "build/**",
        "out",
        "out/**",
        "coverage",
        "coverage/**",
        ".turbo/**",
        ".cache/**",
      ],
      decision: "skip",
      reason: "构建产物默认跳过",
    },
    {
      id: "block-secrets",
      patterns: [
        ".env",
        ".env.*",
        "**/.env",
        "**/.env.*",
        "**/*.pem",
        "**/*.key",
        "**/*.p12",
        "**/*.pfx",
        "**/id_rsa",
        "**/id_ed25519",
        "**/*secret*",
        "**/*credentials*",
      ],
      decision: "block",
      reason: "可能含密钥/凭证，默认禁止读取正文",
    },
    {
      id: "block-binaries",
      patterns: [
        "**/*.png",
        "**/*.jpg",
        "**/*.jpeg",
        "**/*.gif",
        "**/*.webp",
        "**/*.ico",
        "**/*.pdf",
        "**/*.zip",
        "**/*.tar",
        "**/*.gz",
        "**/*.7z",
        "**/*.mp4",
        "**/*.mov",
        "**/*.woff",
        "**/*.woff2",
        "**/*.ttf",
        "**/*.eot",
        "**/*.sqlite",
        "**/*.db",
      ],
      decision: "skip",
      reason: "二进制/媒体默认不读正文",
    },
  ],
};

function normalizeRel(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.?\//, "");
}

/** Very small glob: supports ** / * and trailing path segments. */
export function matchPolicyPattern(relativePath: string, pattern: string): boolean {
  const rel = normalizeRel(relativePath);
  const pat = pattern.replace(/\\/g, "/");
  if (pat === rel) return true;
  // Escape regex specials except our glob tokens
  const reSrc =
    "^" +
    pat
      .split("**")
      .map((part) =>
        part
          .split("*")
          .map((s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&"))
          .join("[^/]*"),
      )
      .join(".*") +
    "$";
  return new RegExp(reSrc).test(rel);
}

export function decidePath(
  relativePath: string,
  policy: GrantPolicy = DEFAULT_GRANT_POLICY,
  meta?: { sizeBytes?: number },
): { decision: GrantPolicyDecision; reason: string; ruleId?: string } {
  const rel = normalizeRel(relativePath);
  for (const rule of policy.rules) {
    if (rule.patterns.some((p) => matchPolicyPattern(rel, p))) {
      return {
        decision: rule.decision,
        reason: rule.reason,
        ruleId: rule.id,
      };
    }
  }
  if (meta?.sizeBytes != null && meta.sizeBytes > policy.maxFileBytes) {
    return {
      decision: "skip",
      reason: `文件超过 ${policy.maxFileBytes} 字节上限`,
      ruleId: "max-file-bytes",
    };
  }
  const lower = rel.toLowerCase();
  const ext = lower.includes(".")
    ? lower.slice(lower.lastIndexOf("."))
    : "";
  const base = lower.slice(lower.lastIndexOf("/") + 1);
  const allowedExt =
    policy.textExtensions.includes(ext) ||
    policy.textExtensions.includes(base);
  if (!allowedExt && ext) {
    return {
      decision: "metadata_only",
      reason: "扩展名不在默认可读正文列表",
      ruleId: "ext-allowlist",
    };
  }
  return { decision: "allow", reason: "默认允许" };
}

export type PreflightEntry = {
  relativePath: string;
  sizeBytes: number;
  decision: GrantPolicyDecision;
  reason: string;
  ruleId?: string;
};

export type PreflightReport = {
  policyVersion: string;
  totalEntries: number;
  eligibleFiles: number;
  blockedFiles: number;
  skippedFiles: number;
  metadataOnlyFiles: number;
  eligibleBytes: number;
  blocked: PreflightEntry[];
  skippedSample: PreflightEntry[];
  warnings: string[];
};

/**
 * Metadata-only preflight: never reads file bodies.
 * `entries` must come from directory listing (name + size only).
 */
export function buildPreflightReport(
  entries: Array<{ relativePath: string; sizeBytes: number; isFile: boolean }>,
  policy: GrantPolicy = DEFAULT_GRANT_POLICY,
): PreflightReport {
  const blocked: PreflightEntry[] = [];
  const skippedSample: PreflightEntry[] = [];
  let eligibleFiles = 0;
  let blockedFiles = 0;
  let skippedFiles = 0;
  let metadataOnlyFiles = 0;
  let eligibleBytes = 0;
  const warnings: string[] = [];

  for (const e of entries) {
    if (!e.isFile) continue;
    const d = decidePath(e.relativePath, policy, { sizeBytes: e.sizeBytes });
    const row: PreflightEntry = {
      relativePath: normalizeRel(e.relativePath),
      sizeBytes: e.sizeBytes,
      decision: d.decision,
      reason: d.reason,
      ruleId: d.ruleId,
    };
    if (d.decision === "allow") {
      eligibleFiles += 1;
      eligibleBytes += e.sizeBytes;
    } else if (d.decision === "block") {
      blockedFiles += 1;
      blocked.push(row);
    } else if (d.decision === "metadata_only") {
      metadataOnlyFiles += 1;
      if (skippedSample.length < 20) skippedSample.push(row);
    } else {
      skippedFiles += 1;
      if (skippedSample.length < 20) skippedSample.push(row);
    }
  }

  if (blockedFiles > 0) {
    warnings.push(`检测到 ${blockedFiles} 个可能敏感文件，默认不读取正文`);
  }
  // Keep corpus totals in the report for observability. Do not present the
  // current soft budgets as warnings until connect enforces them as gates.

  return {
    policyVersion: policy.version,
    totalEntries: entries.length,
    eligibleFiles,
    blockedFiles,
    skippedFiles,
    metadataOnlyFiles,
    eligibleBytes,
    blocked,
    skippedSample,
    warnings,
  };
}

/** True only when policy allows reading file body (hash/CAS/model). */
export function mayReadFileBody(
  relativePath: string,
  policy: GrantPolicy = DEFAULT_GRANT_POLICY,
  meta?: { sizeBytes?: number },
): boolean {
  return decidePath(relativePath, policy, meta).decision === "allow";
}
