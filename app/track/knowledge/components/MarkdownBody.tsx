"use client";

import { useEffect, useMemo, useState } from "react";
import {
  looksLikeMarkdown,
  renderMarkdownLite,
} from "@/shared/knowledge/markdown-lite";
import styles from "../project-canvas.module.css";

type Props = {
  source: string;
  /** File / card title — helps default to render for .md */
  hintName?: string;
  /** test id for the rendered surface */
  "data-testid"?: string;
  className?: string;
};

/**
 * Inspector / preview body: toggle between rendered markdown and raw text.
 * Defaults to 渲染 when content looks like markdown.
 */
export function MarkdownBody({
  source,
  hintName = "",
  "data-testid": testId,
  className,
}: Props) {
  const canRender = useMemo(
    () => looksLikeMarkdown(source, hintName),
    [source, hintName],
  );
  const [mode, setMode] = useState<"render" | "raw">(() =>
    canRender ? "render" : "raw",
  );

  useEffect(() => {
    setMode(canRender ? "render" : "raw");
  }, [canRender, source]);

  const html = useMemo(
    () => (mode === "render" ? renderMarkdownLite(source) : ""),
    [mode, source],
  );

  return (
    <div className={[styles.mdBody, className].filter(Boolean).join(" ")}>
      {canRender ? (
        <div className={styles.mdBodyToolbar} role="group" aria-label="正文显示">
          <button
            type="button"
            data-active={mode === "render"}
            onClick={() => setMode("render")}
          >
            渲染
          </button>
          <button
            type="button"
            data-active={mode === "raw"}
            onClick={() => setMode("raw")}
          >
            原文
          </button>
        </div>
      ) : null}
      {mode === "render" && canRender ? (
        <div
          className={styles.mdProse}
          data-testid={testId}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p
          className={styles.mdRaw}
          data-testid={testId}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {source}
        </p>
      )}
    </div>
  );
}
