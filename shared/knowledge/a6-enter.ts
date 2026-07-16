/**
 * A6: after folder import creates projects, which one to enter.
 * Pure rule - UI must call this and bind left nav + center/materials to the id.
 */

/** Default: first successfully created project in this batch (G2 A6). */
export function pickA6EnterProjectId(
  createdIds: readonly string[],
): string | null {
  if (!createdIds.length) return null;
  return createdIds[0] ?? null;
}

/**
 * Merge server/optimistic project lists so the batch is visible and
 * the enter-target is easy to find in the left nav.
 */
export function mergeProjectsForA6Enter<T extends { id: string }>(
  created: readonly T[],
  existing: readonly T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const project of created) {
    if (seen.has(project.id)) continue;
    seen.add(project.id);
    out.push(project);
  }
  for (const project of existing) {
    if (seen.has(project.id)) continue;
    seen.add(project.id);
    out.push(project);
  }
  return out;
}
