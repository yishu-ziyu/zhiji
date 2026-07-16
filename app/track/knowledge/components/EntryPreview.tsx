import styles from "../workbench-entry.module.css";

/**
 * Static result preview for cold-start entry.
 * Shows what the screen looks like after connecting — not live data.
 */
export function EntryPreview() {
  return (
    <div className={styles.entryPreview} aria-label="连接后结果示意">
      <div className={styles.entryPreviewHead}>
        <span className={styles.entryPreviewLabel}>连接后你会看到</span>
        <span className={styles.entryPreviewBadge}>示例</span>
      </div>

      <div className={styles.entryPreviewBlock}>
        <p className={styles.entryPreviewBlockTitle}>现在怎样</p>
        <p className={styles.entryPreviewSummary}>
          主线在推进，两处待确认；最近改动集中在文档与接口说明。
        </p>
        <p className={styles.entryPreviewSummaryMuted}>
          依据来自你授权文件夹内的材料，不是全机扫描。
        </p>
      </div>

      <ul className={styles.entryPreviewJudgments}>
        <li>
          <span className={styles.entryPreviewJudgmentText}>
            当前理解：交付范围已收窄到本周可验收的部分
          </span>
          <span className={styles.entryPreviewSource}>README.md · 第 12 行附近</span>
        </li>
        <li>
          <span className={styles.entryPreviewJudgmentText}>
            待核对：接口变更是否已同步到调用方说明
          </span>
          <span className={styles.entryPreviewSource}>docs/api-notes.md · 最近修改</span>
        </li>
      </ul>
    </div>
  );
}
