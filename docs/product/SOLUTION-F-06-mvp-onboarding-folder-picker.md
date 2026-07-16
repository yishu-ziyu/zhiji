# SOLUTION · F-06 / D-50 · Onboarding responsibility (not folder-picker-only)

**Status:** Owner-confirmed deeper product conclusion (feedback #1 · deepened 2026-07-16)  
**IDs:** F-06 · D-50  
**Authority list:** `.ship/tasks/first-user-real-entry-015/control/PRODUCT_DEV_TASKS.md`  
**Roadshow:** `docs/product/ROADSHOW_PRODUCT_LOGIC.md`  
**For:** G2 delivery classification and dispatch (not Lead routine traffic)

**Path stability:** This file remains the single durable solution document for F-06/D-50 (filename historical; scope is **responsibility model**, not “picker UI only”).

---

## 1. Problem (root failure)

**Not** “missing a folder picker widget.”

**Root failure:** Onboarding **reverses responsibility** and treats the user as a **system configurator**.

The product asks the human to assemble internal connection parameters (`projectId`, `rootPath` syntax, `watchPrefixes`, and similar internal terms) before any work begins. That is Agent/system work, not Owner work.

Surface symptom (still real): fields and copy that force internal IDs/path syntax.  
Product diagnosis: wrong who-does-what at first use.

## 2. Real example (Owner)

**Screenshot (durable):**  
`.ship/evidence/f06-onboarding-internal-ids/owner-screenshot-2026-07-16-205400.png`

**What the Owner saw:**

- Headline: 选择一个本地项目，开始重建当前理解  
- Body still: 先由 Owner 输入项目 ID、真实 rootPath 与关注路径…  
- Fields: 项目 ID (UUID) · 本地 rootPath · 关注路径（逗号分隔）  
- CTA: 连接项目并读取默认事项  

**Code gap (slot16 lineage @ `3b6c33a1`):**  
`app/track/knowledge/mvp/page.tsx` L115 · L229–241  

Treehouse capture path:  
`~/.treehouse/fc-opc-ibot-678696/16/fc-opc-ibot/app/track/knowledge/mvp/page.tsx`

## 3. Accepted responsibility model (D-50)

| Who | Responsibility |
|-----|----------------|
| **User / Owner** | Only **identifies an authorized project folder** (Continue prior project, or pick a new folder). May later **correct / confirm** uncertain understanding, or **expand permission** when the Agent asks. |
| **Agent / system** | Within that folder boundary: **reads**, **detects project structure / history / changes**, and **produces an initial source-backed current understanding**. Hides `projectId`, `rootPath` syntax, watch syntax, and other **internal terms** from normal onboarding. |

### Concrete product rules

1. User does **not** configure the system (no required UUID, path string, watch list, or internal jargon on first path).
2. **Selected folder = explicit permission boundary.** Nothing outside is read. Cancel is safe (no grant / no scan residue).
3. After boundary is set, the Agent (not the user) drives discovery: structure, history, changes → **initial source-backed current understanding** (candidate until Owner confirms where needed).
4. Owner is interrupted **only** to: correct/confirm uncertainty, or expand permission beyond current boundary.
5. Safe default excludes inside the folder; advanced scope is later, not the entry exam.
6. Existing project offers **Continue**; new project uses **native folder picker** — these are **means**, not the product goal.

## 4. Visible acceptance sequence (when I do X I see Y)

Ordered Owner-visible sequence for G4/G6 and eng READY:

1. **Open MVP fresh** → I am **not** asked for projectId / rootPath syntax / watch prefixes / internal term explanations.
2. **If I have a prior project** → I see a plain **Continue** on that project (folder identity human-readable), not a config form.
3. **If new** → I choose a folder via **native folder picker**; cancel returns to the same start with **no** connected state and **no** success claim.
4. **After I authorize a folder** → UI shows only that I authorized **this** project folder (permission boundary), not system fields.
5. **Without me typing structure/watch rules** → system reads **only inside** the folder (safe defaults apply) and **detects** structure / history / changes.
6. **I receive an initial current understanding** that is **source-backed** (I can point at evidence), not a blank “fill more config” wall.
7. **When something is uncertain or out of scope** → product **asks me** to correct/confirm or expand permission — it does **not** dump me into raw ID/path/watch editors as the default.
8. **Internal IDs and path/watch syntax stay hidden** on the happy path (may exist only in advanced/debug later, never as onboarding tax).

## 5. Roadshow meaning

| Pitch layer | Meaning |
|-------------|---------|
| **User pain** | Returning (or first connecting) should not require becoming the product’s ops engineer. |
| **Decision** | Authorization is “this project folder”; understanding work is the Agent’s job inside that boundary. |
| **Demo line** | “You point at the project. The Agent rebuilds what is going on from sources. You only correct what is unsure or open a wider door.” |
| **Not the demo** | Teaching judges UUIDs, absolute paths, or watch-prefix DSL. |
| **Efficiency (D-45)** | Cuts **return-to-decision** front-door tax: enter → authorized boundary → source-backed understanding → next decision — not enter → configure system → maybe later understand. |
| **Aligns** | D-39 observer within authorized sources · D-44 return-to-local-project · D-41/D-42 source-backed state · D-43 no silent overwrite of understanding. |

## 6. Unanswered / non-goals (do not invent)

- Exact native picker stack (argv-safe native seam vs other) → eng; product requires real folder choice, not fake path typing.
- Exact default exclude list → safe defaults now; Owner may refine later.
- Full multi-project library UI → minimal Continue first.
- Whole-disk / unapproved sources / Gmail → still forbidden (D-10/D-17/D-29/D-39).
- Owner final product acceptance of MVP overall → still OA-21 / D-02; this solution does not substitute.

## 7. Eng note for G2 (already dual-writing)

Prior ASSIGN wave (G3B native connection · G3A onboarding UI @ base `3b6c33a1`, G5 excluded) remains valid **as the connection seam**, but acceptance **must not stop at “picker exists.”**

Integrate READY must satisfy the **responsibility sequence** in §4: after folder authorization, initial **source-backed current understanding** path exists without forcing the user back into configurator mode. If current dual-write scope is UI/API-only and leaves “empty until user configures more,” that is still **FAIL** against D-50 deepened.

Sec1 does **not** re-dispatch seats. G2 reclassifies if builders need a follow-on slice.

## 8. Links

- F-06 / D-50 / S-114 in PRODUCT_DEV_TASKS  
- Evidence: `.ship/evidence/f06-onboarding-internal-ids/`  
- Process sole: `MVP_FAST_INBOX.md` (Sec2)
