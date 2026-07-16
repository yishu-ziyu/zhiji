/**
 * Rank / filter materials for the project canvas (Canvasight center).
 * Prefer human-readable project knowledge; suppress lockfiles, media, tooling dumps.
 */

export type RankableCard = {
  id: string;
  title?: string;
  sourceFileId?: string;
  content?: string;
  source?: string;
  timestamp?: string;
};

export function canvasMaterialLabel(card: RankableCard): string {
  return (
    card.title?.trim() ||
    card.sourceFileId?.split(/[/\\]/).pop()?.trim() ||
    ""
  );
}

/** True when this file should not occupy the project-center graph. */
export function isCanvasNoiseMaterial(name: string): boolean {
  const base = (name.split(/[/\\]/).pop() ?? name).trim().toLowerCase();
  if (!base) return true;

  if (
    /^(package-lock|pnpm-lock|yarn\.lock|bun\.lockb|composer\.lock)/.test(base)
  ) {
    return true;
  }
  if (base.endsWith(".lock") || base.endsWith(".lockb")) return true;

  if (
    /\.(mp3|mp4|wav|webm|mov|avi|png|jpe?g|gif|webp|ico|bmp|woff2?|ttf|eot|zip|gz|tar|rar|7z|pdf|wasm|bin|dmg|exe|dll)$/.test(
      base,
    )
  ) {
    return true;
  }

  // Tooling / generated noise common in this repo's demos.
  if (/^(run-|minimax-env|_options|favicon|logo-horizontal)/.test(base)) {
    return true;
  }
  if (base.startsWith("_") && base.endsWith(".css")) return true;
  // Local scripts / fixtures are not project understanding structure.
  if (
    /\.(mjs|cjs)$/.test(base) ||
    /^(serve-|stagehand|fixture|script)/.test(base)
  ) {
    return true;
  }
  // Long hashtag dump titles (e.g. social audio filenames).
  if (base.includes("#") && base.length > 36) return true;

  return false;
}

/**
 * Higher = better as a project-center neighbor / 「现在怎样」证据.
 * Noise returns strongly negative.
 */
export function canvasMaterialRankScore(card: RankableCard): number {
  const name = canvasMaterialLabel(card);
  if (!name) return -500;
  if (isCanvasNoiseMaterial(name)) return -1000;

  let score = 0;
  const lower = name.toLowerCase();

  if (/\.md$/i.test(lower) || /\.markdown$/i.test(lower)) score += 120;
  if (/^readme(\.|$)/i.test(lower)) score += 40;
  if (/^(todo|notes?|decisions?|context|spec|prd|brief)/i.test(lower)) {
    score += 90;
  }
  if (card.source === "meeting" || card.source === "email" || card.source === "chat") {
    score += 50;
  }
  if (card.source === "doc") score += 15;

  const contentLen = card.content?.trim().length ?? 0;
  if (contentLen > 200) score += 30;
  else if (contentLen > 40) score += 15;

  if (/\.(html|htm|txt)$/i.test(lower)) score += 10;
  if (/\.(css|scss|less|js|jsx|ts|tsx|mjs|cjs|json|map)$/i.test(lower)) {
    score -= 40;
  }
  if (/node_modules|\.next\/|dist\//i.test(card.sourceFileId ?? name)) {
    score -= 200;
  }

  return score;
}

export function sortCardsForCanvas<T extends RankableCard>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const scoreDiff = canvasMaterialRankScore(b) - canvasMaterialRankScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.timestamp ?? "").localeCompare(a.timestamp ?? "");
  });
}

export function isUsefulCanvasCard(card: RankableCard): boolean {
  return canvasMaterialRankScore(card) >= 0;
}
