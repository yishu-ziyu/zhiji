import { agentDisplayName } from "@/shared/knowledge/agent-activity";

export function actorLabel(actor: string) {
  if (actor.startsWith("agent:") || actor === "agent") {
    return agentDisplayName(actor);
  }
  return actor;
}
