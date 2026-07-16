/**
 * T-19 / D-27: project-hard default isolation helpers.
 * Missing scope is an error — never "all projects" and never silent DEFAULT_PROJECT_ID.
 */

export class ProjectScopeError extends Error {
  readonly code = "PROJECT_SCOPE_REQUIRED" as const;
  constructor(message = "projectId 必填") {
    super(message);
    this.name = "ProjectScopeError";
  }
}

export class ProjectAccessError extends Error {
  readonly code = "PROJECT_ACCESS_DENIED" as const;
  constructor(message = "对象不在当前项目范围内") {
    super(message);
    this.name = "ProjectAccessError";
  }
}

/** Non-empty project id or throw. Never returns DEFAULT or empty. */
export function requireProjectId(value: unknown): string {
  if (typeof value !== "string") {
    throw new ProjectScopeError("projectId 必填");
  }
  const id = value.trim();
  if (!id) {
    throw new ProjectScopeError("projectId 必填");
  }
  return id;
}

export function assertEntityInProject(
  entity: { projectId?: string } | null | undefined,
  projectId: string,
  label = "对象",
): void {
  const scope = requireProjectId(projectId);
  if (!entity) {
    throw new ProjectAccessError(`${label}不存在`);
  }
  if ((entity.projectId ?? "").trim() !== scope) {
    throw new ProjectAccessError(`${label}不在当前项目范围内`);
  }
}

/** Human Owner actors only — agents cannot approve cross-project refs. */
export function assertOwnerApprover(actor: string): string {
  const a = actor?.trim();
  if (!a) {
    throw new ProjectScopeError("跨项目引用需要 Owner 确认（approvedBy 必填）");
  }
  if (a.startsWith("agent:") || a === "agent") {
    throw new ProjectScopeError("跨项目引用只能由 Owner 批准，Agent 不能批准");
  }
  return a;
}

export function isAgentActor(actor: string | undefined): boolean {
  const a = actor?.trim() ?? "";
  return a.startsWith("agent:") || a === "agent";
}
