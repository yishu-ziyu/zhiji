/**
 * Agent dual memory facade.
 * - Project Memory: shared/project-memory (SQLite + CAS)
 * - Dialogue Memory + prefs + archive + workbench bundle: this package
 */
export type {
  ConfirmStyle,
  DialogueMessage,
  DialogueRole,
  DialogueSession,
  DialogueSessionStatus,
  EventArchivePlan,
  EventArchiveRecord,
  OpenToolIntent,
  UserPreferences,
  WorkbenchBundle,
  WritingStyle,
} from "./types";

export {
  appendDialogueMessage,
  closeDialogueSession,
  getDialogueSession,
  listDialogueMessages,
  listDialogueSessions,
  listRecentProjectDialogue,
  openDialogueSession,
  resetDialogueStoreForTests,
  setOpenToolIntent,
} from "./dialogue-store";

export {
  DialogueJsonCorruptError,
  isDialogueSqliteMode,
  migrateJsonDialogueToSqlite,
  readDialogueJsonMapStrict,
  type MigrateJsonDialogueReport,
} from "./dialogue-sqlite-store";

export {
  getUserPreferences,
  patchUserPreferences,
  resetUserPreferencesForTests,
} from "./user-preferences";

export {
  applyEventArchive,
  archivedEventIdSet,
  filterActiveEvents,
  findArchivedEventPayload,
  listEventArchives,
  planEventArchive,
  resetEventArchivesForTests,
} from "./event-archive";

export { loadWorkbenchBundle } from "./workbench-bundle";

export {
  writeDialogueMilestoneToKnowledge,
  type DialogueWritebackResult,
} from "./dialogue-writeback";

export {
  buildAgentChatContext,
  formatAgentChatContextForPrompt,
  toAgentChatContextPack,
  type AgentChatContext,
  type AgentChatContextPack,
} from "./chat-context";

export {
  confirmOwnerProjectStatement,
  listOwnerProjectStatements,
  looksLikeProjectUnderstanding,
  mergeOwnerStatementsIntoUnderstandingBody,
  proposeOwnerProjectStatement,
  recordOwnerProjectStatement,
  resetOwnerStatementsForTests,
  withdrawOwnerProjectStatement,
  type OwnerProjectStatement,
  type OwnerStatementStatus,
} from "./owner-statements";
