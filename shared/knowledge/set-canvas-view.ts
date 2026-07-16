/**
 * set_canvas_view tool — pure validation + normalized command.
 * No disk writes; UI applies the command from receipt/API.
 */

import {
  type CanvasCommand,
  parseCanvasCommand,
  CANVAS_MENU_VERSION,
} from "./canvas-command";
import {
  resolveCanvasCommandFromUtterance,
  shouldForceCanvasViewTool,
  type ResolveCanvasIntentContext,
} from "./canvas-intent";

export type SetCanvasViewResult =
  | {
      outcome: "ok";
      summary: string;
      command: CanvasCommand;
      detail: string;
    }
  | {
      outcome: "error";
      summary: string;
      errorClass: "invalid_input";
      detail: string;
    };

/**
 * Execute set_canvas_view from a command-like payload.
 */
export function executeSetCanvasView(input: unknown): SetCanvasViewResult {
  const parsed = parseCanvasCommand(input);
  if (!parsed.ok) {
    return {
      outcome: "error",
      summary: "set_canvas_view 参数不合法",
      errorClass: "invalid_input",
      detail: parsed.error,
    };
  }
  return {
    outcome: "ok",
    summary: `画布已切换为「${parsed.command.view}」`,
    command: parsed.command,
    detail: JSON.stringify(parsed.command),
  };
}

/**
 * From natural language → forced tool path for Agent.
 */
export function planSetCanvasViewFromUtterance(
  utterance: string,
  ctx: ResolveCanvasIntentContext = {},
): {
  shouldCall: boolean;
  toolCall: {
    id: string;
    name: "set_canvas_view";
    input: CanvasCommand;
  } | null;
  command: CanvasCommand | null;
} {
  if (!shouldForceCanvasViewTool(utterance)) {
    return { shouldCall: false, toolCall: null, command: null };
  }
  const { command } = resolveCanvasCommandFromUtterance(utterance, ctx);
  if (!command) {
    return { shouldCall: false, toolCall: null, command: null };
  }
  return {
    shouldCall: true,
    toolCall: {
      id: `canvas-view-${Date.now()}`,
      name: "set_canvas_view",
      input: command,
    },
    command,
  };
}

export function canvasMenuVersion(): string {
  return CANVAS_MENU_VERSION;
}
