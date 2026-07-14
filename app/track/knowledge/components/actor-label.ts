export function actorLabel(actor: string) {
  if (actor === "agent:project-reviewer") return "Agent 项目复核";
  if (actor === "agent:external") return "外部 Agent";
  if (actor.startsWith("agent:")) return "其他 Agent";
  return actor;
}
