"use client";

/**
 * PR-14: thin composition shell — slots only, no data loading.
 * page.tsx keeps orchestration; this only arranges regions.
 */
import type { ReactNode } from "react";

export type WorkbenchShellProps = {
  /** Left project list */
  navigator?: ReactNode;
  /** Center canvas / empty guide */
  canvas: ReactNode;
  /** Right inspector / agent rail */
  inspector?: ReactNode;
  /** Optional PR-15 claim list (below inspector or inside rail) */
  claimReview?: ReactNode;
  /** Bottom timeline */
  timeline?: ReactNode;
  className?: string;
  mainClassName?: string;
};

export function WorkbenchShell({
  navigator,
  canvas,
  inspector,
  claimReview,
  timeline,
  className,
  mainClassName,
}: WorkbenchShellProps) {
  return (
    <div className={className} data-testid="workbench-shell">
      {navigator}
      <div className={mainClassName} data-testid="workbench-main">
        {canvas}
        {inspector}
        {claimReview}
      </div>
      {timeline}
    </div>
  );
}
