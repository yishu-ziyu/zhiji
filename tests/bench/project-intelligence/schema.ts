/**
 * Project Intelligence Bench — scenario schema.
 * Vertical product bench (not SWE-bench / GAIA).
 */

export type BenchFamily =
  | "reentry"
  | "decision"
  | "conflict"
  | "refuse"
  | "noise"
  | "quick"
  | "structure"
  | "search"
  | "safety";

export type BenchDifficulty = "easy" | "medium" | "hard";

export type BenchCheckKind =
  | "search_queries_contain"
  | "search_queries_exclude"
  | "dialogue_structured"
  | "dialogue_has_section"
  | "dialogue_evidence_path"
  | "dialogue_candidate_footer"
  | "dialogue_no_fake_path"
  | "body_has_now"
  | "body_next_decision_single"
  | "body_why_max"
  | "format_roundtrip_structured";

export type BenchCheck = {
  kind: BenchCheckKind;
  /** For contain/exclude / path / section name. */
  value?: string;
  /** Numeric caps (e.g. why max). */
  max?: number;
};

/**
 * One bench case. Offline cases evaluate pure functions only.
 * Runtime cases may later attach fixture roots + agent runs.
 */
export type BenchScenario = {
  id: string;
  family: BenchFamily;
  difficulty: BenchDifficulty;
  title: string;
  /** Owner utterance or free-form note for the case. */
  ownerUtterance?: string;
  /**
   * Optional UnderstandingBody-like JSON used for format checks.
   * Kept loose so catalog stays JSON-friendly.
   */
  body?: Record<string, unknown>;
  /** Optional pre-rendered agent dialogue for parse-only checks. */
  agentDialogue?: string;
  checks: BenchCheck[];
};

export type BenchCheckResult = {
  kind: BenchCheckKind;
  pass: boolean;
  detail: string;
};

export type BenchScenarioResult = {
  id: string;
  family: BenchFamily;
  difficulty: BenchDifficulty;
  title: string;
  pass: boolean;
  checks: BenchCheckResult[];
};

export type BenchReport = {
  name: string;
  version: string;
  ranAt: string;
  total: number;
  passed: number;
  failed: number;
  byFamily: Record<string, { total: number; passed: number }>;
  results: BenchScenarioResult[];
};
