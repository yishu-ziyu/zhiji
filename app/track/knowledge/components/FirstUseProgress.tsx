"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import {
  FIRST_USE_PROGRESS_LABELS,
  FIRST_USE_PROGRESS_STEPS,
  isProgressStepDone,
  type FirstUseProgressStep,
} from "../lib/onboarding-folder-choice";
import styles from "../workbench-entry.module.css";

type Props = {
  step: FirstUseProgressStep;
  folderName?: string;
};

export function FirstUseProgress({ step, folderName }: Props) {
  return (
    <div className={styles.firstUseProgress} data-testid="first-use-progress" aria-live="polite">
      <span className={styles.kicker}>正在阅读</span>
      <strong>{folderName || "所选项目"}</strong>
      <p>每一步都是真的在做，不会假装完成。</p>
      <ol className={styles.firstUseSteps}>
        {FIRST_USE_PROGRESS_STEPS.map((item) => {
          const done = isProgressStepDone(step, item);
          const active = step === item;
          return (
            <li
              key={item}
              data-step={item}
              data-active={active ? "true" : "false"}
              data-done={done ? "true" : "false"}
              className={
                active
                  ? styles.firstUseStepActive
                  : done
                    ? styles.firstUseStepDone
                    : styles.firstUseStepPending
              }
            >
              {active ? (
                <LoaderCircle size={14} className={styles.spin} />
              ) : done ? (
                <CheckCircle2 size={14} />
              ) : (
                <span className={styles.firstUseStepDot} />
              )}
              <span>{FIRST_USE_PROGRESS_LABELS[item]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
