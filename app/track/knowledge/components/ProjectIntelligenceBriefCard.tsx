"use client";

/**
 * 右栏「项目情报简报」——录屏主画面。
 * Brief 是读模型；Candidate 必须过 grounded 硬门才展示判断正文。
 */
import type {
  BriefMissingPart,
  ProjectIntelligenceBrief,
} from "@/shared/project-memory/brief/assemble-brief";
import type {
  Claim,
  ClaimEvidenceLink,
  OwnerResolution,
  OwnerResolutionDecision,
  PreciseEvidenceAnchor,
} from "@/shared/project-memory/claims/types";
import { ClaimReviewPanel } from "./ClaimReviewPanel";
import styles from "./project-intelligence-brief.module.css";

export type ProjectIntelligenceBriefCardProps = {
  brief?: ProjectIntelligenceBrief | null;
  /** insufficient / failed take precedence over brief body */
  mode?: "brief" | "insufficient" | "run_failed" | "none";
  insufficientMessage?: string | null;
  missingTools?: BriefMissingPart[];
  claims?: Claim[];
  anchors?: PreciseEvidenceAnchor[];
  links?: ClaimEvidenceLink[];
  resolutions?: OwnerResolution[];
  failureMessage?: string | null;
  onResolveClaim?: (
    claim: Claim,
    decision: Extract<
      OwnerResolutionDecision,
      "accept" | "accept_edited" | "reject" | "defer"
    >,
    editedText?: string,
  ) => void | Promise<void | OwnerResolution>;
  onOpenRevision?: (revisionId: string) => void;
};

const MISSING_LABEL: Record<BriefMissingPart, string> = {
  map: "地图 project_map",
  search: "搜索 search_text",
  read: "读取 read_revision / read_path",
};

export function ProjectIntelligenceBriefCard({
  brief = null,
  mode = "brief",
  insufficientMessage = null,
  missingTools = [],
  claims = [],
  anchors = [],
  links = [],
  resolutions = [],
  failureMessage = null,
  onResolveClaim,
  onOpenRevision,
}: ProjectIntelligenceBriefCardProps) {
  if (mode === "run_failed") {
    return (
      <section
        className={styles.card}
        data-testid="project-intelligence-brief"
        data-state="failed"
        aria-label="项目情报简报"
      >
        <header className={styles.header}>
          <span className={styles.kicker}>项目情报</span>
          <span className={styles.badgeFail}>本轮失败</span>
        </header>
        <h2 className={styles.title}>本轮没有可用简报</h2>
        <p className={styles.body} data-testid="brief-failed-message">
          {failureMessage?.trim() ||
            "本轮失败：不沿用旧 Candidate 或历史 Accepted 冒充本次成功。"}
        </p>
      </section>
    );
  }

  if (mode === "insufficient") {
    return (
      <section
        className={styles.card}
        data-testid="project-intelligence-brief"
        data-state="insufficient"
        aria-label="项目情报简报"
      >
        <header className={styles.header}>
          <span className={styles.kicker}>项目情报</span>
          <span className={styles.badgeFail}>依据不足</span>
        </header>
        <h2 className={styles.title} data-testid="brief-insufficient-title">
          依据不足，尚不能形成项目情报简报
        </h2>
        <p className={styles.body} data-testid="brief-insufficient-message">
          {insufficientMessage?.trim() ||
            "需要真实的地图、搜索与读取收据后，才能展示可审查判断。"}
        </p>
        {missingTools.length > 0 ? (
          <ul className={styles.bulletList} data-testid="brief-missing-tools">
            {missingTools.map((m) => (
              <li key={m}>缺少：{MISSING_LABEL[m]}</li>
            ))}
          </ul>
        ) : null}
        <p className={styles.muted}>
          不会展示 Candidate 的「当前判断」正文，以免无收据冒充成功。
        </p>
      </section>
    );
  }

  if (!brief || mode === "none") return null;

  const reviewClaims = claims.length > 0 ? claims : [];
  const reviewClaimIds = new Set(reviewClaims.map((claim) => claim.id));
  const seenEvidence = new Set<string>();
  const evidenceHighlights = links
    .filter(
      (link) =>
        reviewClaimIds.has(link.claimId) &&
        (link.relation === "supports" || link.relation === "contradicts"),
    )
    .map((link) => anchors.find((anchor) => anchor.id === link.anchorId))
    .filter((anchor): anchor is PreciseEvidenceAnchor => Boolean(anchor))
    .filter((anchor) => {
      const key = `${anchor.revisionId}:${anchor.relativePath}:${anchor.quote}`;
      if (seenEvidence.has(key)) return false;
      seenEvidence.add(key);
      return true;
    })
    .slice(0, 3);
  const usefulWhyNow =
    brief.whyNow !== "尚不能判断" &&
    !/没有可核对的文件变化|无明显文件变化/.test(brief.whyNow);
  const visibleLimits = brief.contraryOrLimits.slice(0, 2);
  const visibleUnknowns = brief.unknowns
    .filter((text) => !/暂无可用的原文依据/.test(text))
    .slice(0, 2);

  return (
    <section
      className={styles.card}
      data-testid="project-intelligence-brief"
      data-kind={brief.kind}
      data-grounded={brief.groundedInTools ? "true" : "false"}
      aria-label="项目情报简报"
    >
      <header className={styles.header}>
        <span className={styles.kicker}>项目情报简报</span>
        <span
          className={
            brief.kind === "accepted" ? styles.badgeOk : styles.badgePending
          }
        >
          {brief.kind === "accepted"
            ? brief.restoreLabel || "上次已确认判断"
            : "待你确认"}
        </span>
      </header>

      {brief.kind === "accepted" && brief.restoreLabel ? (
        <p className={styles.muted} data-testid="brief-restore-label">
          {brief.restoreLabel}（非本轮新生成）
        </p>
      ) : null}

      <div className={styles.block}>
        <h3 className={styles.label}>项目现在怎样</h3>
        <p className={styles.judgment} data-testid="brief-current-judgment">
          {brief.currentJudgment}
        </p>
      </div>

      {usefulWhyNow ? (
        <div className={styles.block}>
          <h3 className={styles.label}>为什么现在要看</h3>
          <p className={styles.body} data-testid="brief-why-now">
            {brief.whyNow}
          </p>
        </div>
      ) : null}

      <div className={styles.block}>
        <h3 className={styles.label}>我依据什么</h3>
        {evidenceHighlights.length > 0 ? (
          <ul className={styles.evidenceList} data-testid="brief-revisions">
            {evidenceHighlights.map((anchor) => (
              <li key={anchor.id}>
                {onOpenRevision ? (
                  <button
                    type="button"
                    className={styles.evidenceButton}
                    onClick={() => onOpenRevision(anchor.revisionId)}
                  >
                    <span>{anchor.relativePath}</span>
                    <q>{anchor.quote}</q>
                  </button>
                ) : (
                  <div className={styles.evidenceItem}>
                    <span>{anchor.relativePath}</span>
                    <q>{anchor.quote}</q>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>展开下方判断，可核对具体文件和原文。</p>
        )}
      </div>

      {visibleLimits.length > 0 || visibleUnknowns.length > 0 ? (
        <div className={styles.twoCol}>
          {visibleLimits.length > 0 ? (
            <div className={styles.block}>
              <h3 className={styles.label}>需要留意</h3>
              <ul className={styles.bulletList} data-testid="brief-limits">
                {visibleLimits.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {visibleUnknowns.length > 0 ? (
            <div className={styles.block}>
              <h3 className={styles.label}>还不知道什么</h3>
              <ul className={styles.bulletList} data-testid="brief-unknowns">
                {visibleUnknowns.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.decision} data-testid="brief-decision">
        <h3 className={styles.label}>你现在只要决定</h3>
        <p className={styles.decisionText}>{brief.decisionPrompt}</p>
      </div>

      {reviewClaims.length > 0 && brief.kind === "candidate" ? (
        <details className={styles.claims} data-testid="brief-claim-review">
          <summary className={styles.claimsSummary}>
            <span>逐条核对判断与原文</span>
            <span>{reviewClaims.length} 条</span>
          </summary>
          <div className={styles.claimsPanel}>
            <ClaimReviewPanel
              claims={reviewClaims}
              anchors={anchors}
              links={links}
              initialResolutions={resolutions}
              title="逐条核对"
              onResolve={onResolveClaim}
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}
