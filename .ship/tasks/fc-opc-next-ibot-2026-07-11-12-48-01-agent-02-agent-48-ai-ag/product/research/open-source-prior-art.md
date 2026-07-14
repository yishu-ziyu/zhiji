# Open-source prior-art gate

Date: 2026-07-13

Purpose: before proposing custom implementation, check whether an existing project
already solves the problem, whether we should reuse code, integrate through an API,
borrow a domain pattern, or deliberately do neither.

## Result

There is no shortage of open-source CRM, project, workflow, signing and Agent
infrastructure. The missing piece is not a generic implementation of those categories.
It is the selected Chinese operating event, the minimum state model that represents its
business consequence, and the entry path that does not create more work than it saves.

The current repository should not absorb an entire CRM/PM/ERP codebase. Those projects
are larger systems in different stacks, several use strong copyleft or source-available
licenses, and they would replace rather than deepen the existing 180-second vertical
slice. Reuse should be selective: patterns now, APIs or infrastructure only when the
chosen mechanism requires them.

## Prior-art matrix

| Project | What it already solves | License signal | Decision for this repository |
|---|---|---|---|
| [Chatwoot](https://github.com/chatwoot/chatwoot) | Omnichannel conversation inbox, contact history, labels, automation, capacity and an AI support agent. Its official channel list includes web chat, email, Facebook, Instagram, X, WhatsApp, Telegram, Line and SMS; it does not establish personal-WeChat ingestion. | MIT | Do not copy the Rails/Vue application. If the target channel becomes one Chatwoot supports, treat it as an event source through integration. It does not solve arbitrary personal-WeChat history. |
| [Twenty](https://github.com/twentyhq/twenty) | Customizable CRM building blocks and customer records. | Mostly AGPL-3.0, with marked enterprise-licensed files | Treat as a CRM/write-back reference or future integration target. Do not copy code into this product without a deliberate license decision. |
| [Plane](https://github.com/makeplane/plane) | Issues, cycles, roadmaps, project views, docs and triage. | AGPL-3.0 | Borrow the project/issue vocabulary only. A full PM replacement would repeat existing capability and increase scope. |
| [Taskosaur](https://github.com/Taskosaur/Taskosaur) | Conversational creation and execution of project-management actions, plus projects, tasks and dependencies. | Business Source License | Strong counterexample to claiming “chat controls a project manager” as innovation. Do not embed this large stack. |
| [ERPNext](https://github.com/frappe/erpnext) / [Dolibarr](https://github.com/Dolibarr/dolibarr) | CRM, quote/order, project, invoice and accounting objects already connected in a company system. | GPL-3.0 / GPL-3+ | Use as proof that the business-object chain is established prior art. Do not rebuild an ERP for the competition. |
| [Invoice Ninja](https://github.com/invoiceninja/invoiceninja) / [InvoicePlane](https://github.com/InvoicePlane/InvoicePlane) | Quotes, invoices, clients, payments and, in Invoice Ninja, projects/time tracking. | Elastic License / open-source project license | Strong counterexample to a generic quote/invoice feature. Integrate later only if commercial-boundary evidence wins and a target user already uses such a system. |
| [Documenso](https://github.com/documenso/documenso) | Self-hosted document signing and signature workflow. | AGPL-3.0 | Use through its API only if legal signature becomes an explicit requirement. The current client confirmation must remain a collaboration fact, not be relabeled as a signature. |
| [Activepieces](https://github.com/activepieces/activepieces) | Connectors, AI workflows, delays and human approval; its community edition is MIT. | MIT community edition; commercial enterprise features | Best open-source candidate for connector experiments or visible workflow composition. Add it only when a selected source/target connector is verified; do not introduce it to orchestrate four local function calls. |
| [n8n](https://github.com/n8n-io/n8n) | Visual AI/workflow automation and a large integration catalogue. | Sustainable Use License plus enterprise license | Useful as prior art and possibly an external automation runtime, but it is source-available rather than a library to copy freely into the product. |
| [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | TypeScript durable tasks, cron schedules, waits, retries, queues, observability and human waitpoints. | Apache-2.0 | Best candidate if the real product needs reliable background waiting/anomaly checks. Skip for the deterministic demo until background execution is part of the accepted product action. |
| [LangGraph.js](https://github.com/langchain-ai/langgraphjs) / [Mastra](https://github.com/mastra-ai/mastra) | Stateful Agent orchestration, memory and human-in-the-loop primitives. | MIT / mostly Apache-2.0 with enterprise directories | Do not add now. The current explicit state machine and direct LLM adapter are smaller and more auditable. Reconsider only when a validated flow genuinely branches, pauses, resumes and calls several tools. |
| [NocoBase](https://github.com/nocobase/nocobase) | Relational business data, pages, workflows, permissions, audit logs and AI actions over the same records. | Mixed license files; verify the exact package before reuse | Strong architectural prior art for “AI maintains business state.” Consider an isolated backend spike only if the product needs user-defined objects and permissions; replacing the current app now would cost more than it saves. |
| [APITable](https://github.com/apitable/apitable) / [Teable](https://github.com/teableio/teable) | API-oriented collaborative tables and no-code relational records. | Project-specific licenses require verification | Possible future storage/write-back targets for users already working in tables. They do not supply the product's event interpretation or authority rules. |
| [Dify](https://github.com/langgenius/dify) / [Coze Studio](https://github.com/coze-dev/coze-studio) | Visual Agent/workflow construction, model access and knowledge/tool composition. | Project-specific licenses require verification | Strong counterexample to claiming a visual Agent workflow as innovation. Use only if an external workflow materially shortens implementation after the business flow is fixed. |

## What can be reused immediately

1. **The current repository's state machine before external code.** It already protects
   client-owned confirmation and acceptance. Replacing it with a framework would lose
   product-specific authority rules.
2. **Append-only event history as the organizing pattern.** CRM, PM, workflow and
   signing systems all retain actions around domain records. The next local change
   should generalize retained source/result events only as far as the selected feature
   needs.
3. **Human approval as an infrastructure primitive, not an innovation claim.**
   Activepieces, Trigger.dev, LangGraph and Mastra already support it. Our value must be
   which Chinese business decision is proposed, with what evidence, and what verified
   state changes afterward.
4. **External systems as adapters.** A future implementation should read/write the
   user's existing CRM, PM, invoice or conversation system where possible. It should
   not force a migration before it has proved value.
5. **One relational truth shared by people and AI.** NocoBase already demonstrates the
   general architecture of AI acting on the same permissioned, audited business data
   as people. Our custom work is the narrow domain model and the evidence-gated
   transition, not another generic low-code platform.

## What still requires custom product code

- the typed relationship between a Chinese client event and this product's selected
  project/commitment/waiting/commercial state;
- the evidence and uncertainty shown before a consequential change;
- authority rules deciding what the provider, client and Agent may change;
- the 180-second interaction that proves an error disappears;
- evaluation fixtures based on real target-user artifacts.

## Reuse gate for implementation

Before adding a dependency or copying source:

1. name the exact missing capability;
2. confirm the current repo and platform do not already provide it;
3. verify current official capability and license;
4. compare integration size with the custom code it replaces;
5. require one acceptance check that would fail if the reused capability breaks.
