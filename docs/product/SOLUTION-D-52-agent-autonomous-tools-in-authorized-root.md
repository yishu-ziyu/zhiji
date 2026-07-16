# SOLUTION · D-52 · Agent autonomous capability inside authorized project root

**Status:** Owner-confirmed follow-up to D-51 (2026-07-16)  
**IDs:** D-52 · closes Q-34 **tool-autonomy / capability principle** (not every API name)  
**Parent:** D-51 product Agent loop · D-50 authorization boundary · D-10/D-15/D-18  
**Audience:** Lead product path; G2 delivery (after D-50 final acceptance before G5 Agent work)  
**Security:** **No API keys** in this document or receipts.

---

## 1. Principle

**Give the Agent sufficient autonomous capability** inside an **explicitly authorized project root**.

The Owner authorizes the **folder boundary once** (D-50). Inside that root, the Agent must not stop for confirmation on every read. Outside that root, or for write/send/sensitive expansion, confirmation remains mandatory.

## 2. Automatic (no per-read confirmation) — inside authorized root

Within the authorized project root, the Agent **may automatically**:

| Capability | Notes |
|------------|--------|
| **Map structure** | Build/update project map (working structure, not truth). |
| **Read relevant files and exact revisions** | Prefer evidence-bearing paths; pin exact revisions. |
| **Search text / symbols / relations** | In-boundary retrieval tools. |
| **Inspect Git** | `status` / `log` / `diff` / `show` / `blame` (or equivalent) **inside** the authorized root only. |
| **Follow references** | Cross-file / symbol / doc links **within** boundary. |
| **Compare history** | Before/after, revisions, prior accepted understanding. |
| **Iterate tool calls** | Continue until it can **answer with evidence** or **explicitly mark unknown**. |

**No per-read confirmation** for the above inside the authorized root.

## 3. Protected actions (require confirmation)

These **always** require Owner confirmation (or stricter rule already set):

| Action class | Rule |
|--------------|------|
| **Expand filesystem scope** | Beyond current authorized root / grant. |
| **Sensitive / paid / unapproved sources** | D-10 / D-17 / D-18. |
| **Any write / send / delete / commit** | External or repo-mutating side effects. |

## 4. Public / pre-authorized external read

- Follow **D-10 / D-18** (and D-29 first sources).
- Must leave a **visible receipt** of the external read (source class, scope, time — no secrets).

## 5. Owner visibility and interrupt

- Owner can **see** the run (progress / tools used / status).
- Owner can **interrupt** the run at any time.
- Interrupted run must stop cleanly without silent writes outside rules.

## 6. Required receipts (every toolful run)

| Receipt | Required |
|---------|----------|
| **Tool receipts** | Each tool call (or batch): name, in-boundary scope, result summary or error, revision/path pins when applicable. |
| **Stopping reason** | Why the loop stopped: evidence sufficient · unknown · Owner interrupt · error/budget · confirmation required · other explicit code. |
| **Model receipt (D-51)** | provider / model / effort / fallback when model used. |

**Never** include API keys or tokens in any receipt.

## 7. Visible acceptance (when I do X I see Y)

1. After I authorize a project folder, reconstruction **does not** ask me to approve each file read inside that folder.
2. Agent may map, search, Git-inspect, and multi-step tool until evidence or **unknown**.
3. If Agent needs a path outside the folder, paid/sensitive source, or any write/send/delete/commit → I get a **confirmation** stop, not silent action.
4. I can watch the run and **interrupt** it.
5. After stop, I can inspect **tool receipts** + **stopping reason** (+ model receipt if model ran).

## 8. Relation to open items

| Item | Status after D-52 |
|------|-------------------|
| D-51 loop + MVP model | Unchanged |
| Q-34 tool **autonomy principle** | **Closed** by D-52 |
| Exact tool API names / schemas | Eng detail under this principle (G2 may list in ASSIGN); not a new product open Q unless conflict |
| Q-33 framework runtime | Still open |
| G5 activation | Still **after D-50 final acceptance** (S-118) |

## 9. Non-goals

- Not whole-disk autonomy.
- Not silent external write/send/delete/commit.
- Not replacing Owner confirm of **candidate understanding** (D-51 step still applies).
