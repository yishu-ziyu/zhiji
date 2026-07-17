import {
  buildCanvasCommand,
  parseCanvasCommand,
  type CanvasCommand,
  type CanvasViewId,
} from "@/shared/knowledge/canvas-command";

type CanvasReceipt = {
  tool: string;
  summary: string;
};

const VIEW_SUMMARY_RE = /^画布已切换为「(now|by_kind|decision|evidence)」$/;

/**
 * Recover the UI command from a real set_canvas_view receipt.
 *
 * Newer in-memory receipts may include the normalized JSON after a newline.
 * Durable receipts intentionally retain only their human-safe summary, so the
 * fixed tool summary is also a valid, lossless view command fallback.
 */
export function canvasCommandFromReceipt(
  receipt: CanvasReceipt,
): CanvasCommand | null {
  if (receipt.tool !== "set_canvas_view") return null;

  const summary = receipt.summary.trim();
  const newline = summary.indexOf("\n");
  const jsonPart = newline >= 0 ? summary.slice(newline + 1).trim() : summary;
  try {
    const parsed = parseCanvasCommand(JSON.parse(jsonPart) as unknown);
    if (parsed.ok) return parsed.command;
  } catch {
    // Durable receipts do not keep the JSON detail; use the fixed tool receipt.
  }

  const match = summary.split("\n", 1)[0]?.match(VIEW_SUMMARY_RE);
  if (!match?.[1]) return null;
  return buildCanvasCommand({ view: match[1] as CanvasViewId });
}
