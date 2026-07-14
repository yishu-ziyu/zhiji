# First-three-dimensions research synthesis

Date: 2026-07-13

Status: discussion artifact, not an approved product specification.

> Superseded notice: the later China-first evidence and implementation synthesis in
> [02b-china-product-map.md](02b-china-product-map.md) is the current decision. Keep
> this file as provenance; where the two conflict, especially on `Waiting-for` as the
> primary wedge, follow `02b`.

## Current decision

Do not expand the existing commitment-slip prototype into the proposed full chain yet.

The repository already proves a limited flow: extract commitment candidates from the current pasted message, let the provider review them, let the client independently confirm or request changes, let the provider mark delivery, and let the client independently accept or reject, with an event history. It does not yet prove historical context, quote/project/task propagation, durable memory, channel ingestion or independent verification of external execution.

The evidence supports a narrower problem structure: some project-based independent professionals simultaneously manage several clients and projects, while client communication and client management create material operating work. The strongest available segment evidence is for creative, web and marketing service providers with repeated client review cycles; the evidence for independent developers is presently weaker and mainly founder-fit. The research does **not** yet prove that either segment wants a new standalone product, that personal-WeChat ingestion is solvable with no user action, or that automatic priority management is trusted.

The strongest remaining product hypothesis is:

> When a client message changes a fact of delivery, an agent explains which quote, commitment, project and task states are affected, shows the source evidence, and applies the approved changes. The value is avoiding manual reconstruction and inconsistent state, not setting another reminder.

This is a hypothesis to test against real project artifacts before code. The scene problem is currently **medium-confidence**; the proposed “state mismatch causes loss” mechanism is **low-confidence**; commercial value is **unvalidated**.

## What the competition actually asks us to prove

The 2026-07-13 organizer meeting defines the first three manual-review dimensions as:

- scene value, 25 points: whether the problem is real, the target user is clear and the scene is valid;
- commercialization potential, 25 points: whether the work can continue into a service, product, case or repeatable solution;
- innovation, 15 points: whether the team has an original Agent design, workflow combination or way of entering the scene.

The meeting does not use the phrase “new AGI workflow.” It also says that third-party platforms, workflows and code are allowed, provided the team discloses them and makes its own scene understanding, business-flow design and product structure visible.

Source: [2026-07-13 organizer meeting transcript](/Users/mahaoxuan/Downloads/2026-07-13%2010_01%20记录_原文.pdf).

## 1. Scene value

### What is supported

1. **The target work structure exists.** Upwork's 2025 survey of 3,000 skilled US knowledge workers found that 33% of skilled freelancers fit its “Freelance Business Owner” persona, described as operating a business while managing a portfolio of clients and projects simultaneously. This supports the existence of the role structure, not the proposed product. [Upwork Future Workforce Index](https://www.upwork.com/research/future-workforce-index-2025)

2. **Multiple client relationships occur within a six-month window, but concurrency is not established by the mean.** Upwork's Freelance Forward data reports an average of ten clients over six months for full-time freelancers and six for freelancers overall. This supports the existence of multi-client portfolios, but not their distribution, concurrent-active-project count or Chinese behavior. [Upwork flexibility research](https://www.upwork.com/press/releases/flexibility-through-freelancing-research-report)

3. **Client operations are a reported pain, but task tracking is not the largest pain.** In Worksome's 2022 vendor survey, the “top three challenges” question had 711 responses: managing clients 189/711 (26.6%), client communications 165/711 (23.2%), and tracking projects/tasks 109/711 (15.3%). Finding work, pricing and tax/accounting ranked higher. This is positive evidence for a client-operations segment and counter-evidence against calling generic task tracking the universal OPC pain. [Worksome Global Freelancer Survey 2022](https://assets-global.website-files.com/60a241ae6727e385f83bb3f5/62d19f3e4e6e63282b6c08dc_Global%20Freelancer%20Survey%20Report%202022.pdf)

4. **High communication-event volume is measurable in knowledge work, but loss is not.** Microsoft reports that the top 20% of high-ping Microsoft 365 users receive an average of 275 meetings, emails or chats per 24-hour day, based on aggregated telemetry ending 2025-02-15. This measures event volume in a broad employee population; it does not establish interruption cost, productivity loss or an independent-operator market. [Microsoft Work Trend Index methodology](https://www.microsoft.com/en-us/worklab/work-trend-index/breaking-down-infinite-workday)

5. **Client expectations, briefs and deadlines change often in a directly relevant freelancer sample.** Malt's 2024 survey received 5,092 responses from registered freelancers in six European countries. In the client-focused subgroup of roughly 3,600 respondents, 55% selected unrealistic expectations, 48% unclear communication, 47% inadequate briefs and 32% constantly changing deadlines. Changing deadlines were highest in Art & Design at 39%, versus Tech & Data at 33% and Business Consulting at 25%. This supports the change event and a creative-service segment; it does not measure stale internal state or resulting loss. [Malt Freelancing in Europe 2024](https://pages.malt.com/hubfs/FIE_2024/FILES/pdf_FIE-2024_digital_en.pdf)

6. **Project operating losses exist, but stale state is not shown to be their main cause.** A Teamwork/Audience Audit survey of 512 agency leaders found 33% reporting difficulty staying on budget, 29% staying on schedule, 24% completing tasks on time and 20% sharing current status with clients; 67% said projects went over budget at least sometimes. Over-servicing was attributed more often to keeping clients happy (56%), failing to handle scope creep (37%) or difficulty saying no (33%) than to not noticing it in time (16%). A separate, high-conflict Ignition vendor survey reported 78% of 273 US agency leaders rarely or only sometimes charged for out-of-scope work. These results support real losses and warn that awareness alone may not change pricing or boundary behavior. [Teamwork State of Agency Operations 2023](https://26079973.fs1.hubspotusercontent-eu1.net/hubfs/26079973/2.%20PDFs/1.%20Downloadable%20PDFs/Teamwork.com%20The%20State%20of%20Agency%20Operations%20Benchmarking%20Report%202023.pdf), [Ignition 2025 agency report](https://www.ignitionapp.com/news/2025-agency-pricing-cashflow-report)

7. **Large transaction data shows changing scope can damage delivery, but the exact mechanism remains anecdotal.** A study of 143,435 mutually rated Upwork transactions found lower client ratings for hourly and multi-freelancer projects; its unquantified sample of 100 low-rated comments included unclear scope and change requests affecting schedules. The regression did not measure cross-system state mismatch, and client multitasking itself was not significantly associated with client ratings. [Seifried et al., 2024](https://www.tandfonline.com/doi/full/10.1080/13662716.2023.2243243)

### What is not supported yet

- No reviewed China-specific primary survey directly measures the proposed segment: project-based solo operators with several concurrent clients whose commitments change in WeChat.
- No quantified evidence yet shows how often a client message changes scope, price, deadline, dependency or acceptance state.
- No quantified evidence yet connects those events to missed work, rework, delayed payment or lost clients.
- The founder's report of four or five projects, priority conflict and forgotten waiting items is first-person evidence for one user, not market evidence.
- Existing broad reports often show acquisition, pricing, tax, payment and income stability as larger problems. The product must select a segment where delivery coordination dominates instead of claiming “all OPC.”
- A 2025 Write the Docs community survey provides direct counter-evidence: among 80 contractors/freelancers, 57.5% served one client at a time, 92.5% considered hours reasonable and 81.2% considered workload manageable. The pain is not universal even among project-based knowledge workers. [Write the Docs 2025 Salary Survey](https://www.writethedocs.org/surveys/salary-survey/2025/)
- Client involvement is not inherently waste. A study of 60 consulting teams found client participation associated with better performance and creativity under strong team connection. The product should help absorb and propagate valid changes, not suppress customer feedback. [Fu et al., PLOS ONE 2023](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0280738)

### Precise candidate user

Proposed research inclusion criteria, not validated user facts:

- first research priority: an independent designer, web/brand/marketing provider or micro-agency with repeated client review cycles;
- second priority: an independent developer, consultant or implementation specialist, pending direct artifacts;
- three or more concurrent non-standard client projects;
- client decisions arrive outside the project system, with chat as the first channel to test;
- a new message can change a price, scope, deliverable, deadline, dependency or acceptance state;
- the same person sells, plans, delivers and follows up.

Exclude:

- self-serve SaaS, standard digital products and platform-managed orders;
- a freelancer with one stable client or one active project;
- teams already requiring every client decision to enter a single managed workflow;
- work where the main pain is acquisition, tax, payment collection or content production.

### Hypothesized precise scene

The trigger is not “the user opens a dashboard.” It is:

> During an active project, a client sends a message that approves, rejects, changes or blocks part of the work.

The hypothesized current work is to recognize the business meaning, recover the relevant project context, produce candidate affected objects, resolve uncertainty, choose what now takes priority, update records and reply. The proposed failure mechanism is that one or more of those states remain stale or inconsistent; this mechanism still requires artifact evidence.

The proposed product is useful only if it reduces that whole reconstruction-and-update job. Extracting a task and starting a timer is not sufficient; notes and alarms already do that.

### Scene-value verdict

**Supported:** a credible narrow user structure, a plausible event and real adjacent losses.

**Not validated:** recurrence, whether stale quote/commitment/project/task state is the cause of those losses, willingness to change behavior and the chosen solution.

The right next evidence is not another opinion survey. It is artifact-based reconstruction of real recent projects.

## 2. Commercialization potential

### Definitions

**Service**

A provider repeatedly applies its labor and judgment for each customer. Delivery capacity grows mainly by adding human time. The result may be valuable, but the process can vary substantially from one customer to the next.

**Productized service**

A service with a specified buyer, trigger, outcome, scope, process and price. Human delivery still exists, but the invariant parts are standardized, systemized and often modularized. Research describes productization as turning variable, ad-hoc service into an offering that is specified, identifiable and priced. [Wirtz et al., “Service products and productization”](https://www.sciencedirect.com/science/article/pii/S0148296321005919)

**Software product**

The invariant transformation is performed by the same software for many users. Onboarding and support can still involve people, but the core operating method is not redesigned per customer and the bounded human cost should not grow approximately one-for-one with customer count.

**Case**

For this research, a case means a documented before/after instance that ties a real input and workflow change to an observed, preferably measured result. This is our operational standard, not a quoted organizer definition. A demo is not such a case; it lacks a real user, baseline and observed outcome.

**Repeatable solution**

The same target trigger, required inputs, transformation, output and proof of value work for the next comparable customer within a bounded setup cost. Repeatability matters because it makes sales comprehensible, setup predictable, quality measurable, learning cumulative and automation economically worthwhile. Service-productization research links standardization and modularization to less repeated redesign, greater measurability, faster setup and easier selling. [Shamsuzzoha, Blomqvist and Takala, 2023](https://doi.org/10.1080/19397038.2023.2184514)

### Adjacent-category pricing evidence

Current client-operations vendors publicly offer paid client/project workflows to independent professionals and small service businesses. This puts current commercial feasibility at roughly **6/10: clear commercial supply and price anchors, but no verified budget or willingness to pay for this product**.

- Bonsai currently lists annual-billing plans from $9/user/month for CRM, tasks, projects and time tracking, and $19/user/month for proposals, contracts, billing, scheduling and a client portal. [Bonsai pricing](https://www.hellobonsai.com/pricing)
- Dubsado lists $35/month for client/project management, invoices and templates, and $55/month for automated workflows, scheduling and proposals. [Dubsado pricing](https://www.dubsado.com/pricing)
- HoneyBook lists $29/month annually for solo business owners and includes unlimited clients/projects plus a pipeline; its AI features already include lead-priority notices, email drafts, a meeting note taker and preparation notes. [HoneyBook plans](https://help.honeybook.com/en/articles/2418282-what-s-included-in-each-honeybook-membership-plan)

These pages prove public paid supply and price anchors. They do **not** prove transactions, retention, target-user budget, willingness to pay for this Agent, that 99 RMB is the right price, or that a narrower product can displace an integrated suite.

The competitive pressure is stronger than the three prices imply. Dubsado already has project status, client portals, approval forms and client-triggered workflows; Bonsai's client portal includes progress, tasks and messages; HoneyBook combines contracts, portals, meetings and project AI. [Dubsado product information](https://www.dubsado.com/llm-info), [Bonsai client portal](https://help.hellobonsai.com/en/articles/4409019-how-to-use-the-client-portal)

Free or low-cost Asana, Notion, Trello and HubSpot plans also make generic tracking cheap. [Asana pricing](https://asana.com/pricing), [Notion pricing](https://www.notion.com/pricing), [Trello pricing](https://trello.com/en/pricing), [HubSpot pricing](https://www.hubspot.com/pricing/suite)

HoneyBook is officially limited to US/Canadian businesses and Dubsado Payments does not support mainland-China merchants, so their prices cannot be used to infer Chinese willingness to pay. [HoneyBook](https://www.honeybook.com/), [Dubsado Payments supported countries](https://help.dubsado.com/en/articles/8940370-manage-payments-with-dubsado-payments)

The first buyer, if this works, is the provider/owner who bears rework, waiting and administrative cost. The external client should be a free guest with no forced account; client participation is a prerequisite for value, not a second revenue line. The credible entry is an overlay that writes back to existing client/project systems, because replacing tools that already hold contracts, invoices, payments, templates, portals and history creates high switching cost.

### A credible iteration path

The path is not “keep adding features.” It is a sequence of evidence and standardization:

1. **Concierge service:** take a real client-change message and manually produce an evidence-linked impact update across scope, quote, deadline, dependencies and tasks. Observe whether the operator acts differently.
2. **Productized service:** fix the target segment, required source material, output format, turnaround, quality rules and price. Repeat it across several comparable operators.
3. **Product:** automate the invariant steps that repeatedly consumed human work: context retrieval, affected-object detection, proposed state diff, approval, execution and verification.
4. **Reusable vertical solution:** package the object model, integrations and evaluation set first for the evidence-stronger creative/web/marketing service segment. Expand to independent software delivery only after direct artifacts support it and the same event-to-outcome metric repeats.

### Commercial gates

Do not claim that the commercial path or willingness to pay is validated until at least these are observed:

- the event happens repeatedly in live work;
- the produced impact diff changes an action or prevents a mistake;
- users repeat the behavior without being chased;
- setup cost falls across users instead of rising with customization;
- several target users pay or place a real deposit, repeat the behavior and renew;
- per-account delivery, onboarding, support, model, message and payment costs are measured and fall as the process standardizes.

A letter of intent shows intent, and replacement of a work step shows behavioral value; neither is equivalent to cash willingness to pay.

## 3. Innovation

### The relevant old workflows

There are three baselines, not one:

1. **Manual work:** read the message, remember the context, search documents, update tasks, set reminders and write a reply.
2. **Deterministic automation:** a structured trigger follows predefined conditions and actions. It is reliable when the input and path are known, but brittle with ambiguous client language.
3. **Chat/copilot AI:** the user collects context, writes a prompt, receives a summary or draft and manually transfers the result back into the operating system.

Across all three, the operator remains the integration layer: they translate the customer statement, compare quote versions, seek commercial or counterparty approval, update project dependencies and tasks, verify the target-system or customer response, and write the new fact back into history.

OpenAI's current guide distinguishes agents from single-turn chatbots and classifiers by LLM-managed workflow execution and tool use. Observing independent results, adjusting and knowing when to return control are the closed-loop properties required by this proposed product, not a universal definition of every Agent. [OpenAI practical guide to agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)

### What current products already do

- Asana AI Studio already handles intake, completeness checks, classification, prioritization, routing, risk alerts, connected-tool actions and automatic task updates. Its current commercial AI Teammates add Work Graph context, checkpoints, actions and persistent memory. [Asana AI Studio](https://asana.com/product/ai/ai-studio), [Asana AI Teammates](https://asana.com/resources/ai-teammates-overview)
- Salesforce has separately productized natural-language quoting with Agentforce for Revenue and event-to-structured-operating-work with Agentforce Operations, including approvals and audit. The latter was announced generally available in April 2026. [Agentforce for Revenue](https://www.salesforce.com/news/stories/agentforce-for-revenue-announcement/), [Agentforce Operations](https://www.salesforce.com/news/stories/agentforce-operations-announcement/)
- HubSpot Breeze uses CRM and conversation context for customer actions; its custom Breeze Studio agents remain beta in the current documentation. [HubSpot Customer Agent](https://knowledge.hubspot.com/customer-agent/set-up-the-customer-agent), [Breeze Studio](https://knowledge.hubspot.com/ai/use-assistants-and-agents-in-breeze-studio?LanguageId=1)
- ClickUp Super Agents use workspace context, perform task/project actions, keep logs and support persistent memory. [ClickUp Super Agents](https://help.clickup.com/hc/en-us/articles/31010910371991-What-are-Super-Agents), [ClickUp Agent memory](https://help.clickup.com/hc/en-us/articles/37038846655383-What-is-Super-Agent-Memory)
- Notion Custom Agents, currently beta for Business and Enterprise, support triggers, connected context, MCP tools, write approvals and reversible run logs. [Notion Custom Agents](https://www.notion.com/en-gb/help/custom-agents)
- Glean Agents are generally available as a horizontal cross-application platform. Interactive Web writes pause for review by default, while background and chat-channel execution have narrower approval behavior. [Glean Agents](https://www.glean.com/press/glean-expands-horizontal-agent-platform-delivers-dozens-of-agents-and-open-interoperability-across-the-enterprise), [Glean human-in-the-loop actions](https://docs.glean.com/agents/actions/human-in-the-loop-experience-for-actions)
- monday.com announced custom Agents available in May 2026, while its help center still describes gradual rollout. It already combines agents, boards, AI blocks and workflows. [monday.com Agent announcement](https://monday.com/blog/product/welcome-to-the-agentic-era-at-monday-com/), [monday Agents help](https://support.monday.com/hc/en-us/articles/33347027353746-AI-Agents-on-monday-com)
- Microsoft's Sales Agent remains preview, Planner Agent can execute project tasks with human review, and Copilot Studio can compose the workflow. Atlassian Rovo can use tools interactively, but an Agent inside Jira automation only returns text for deterministic automation to execute. [Microsoft Sales Agent](https://learn.microsoft.com/en-us/microsoft-sales-copilot/use-sales-chat), [Planner Agent](https://support.microsoft.com/en-us/planner/copilot/execute-tasks-with-planner-agent), [Rovo automation limits](https://support.atlassian.com/rovo/docs/agents-in-automations/)
- HoneyBook already combines a client/project pipeline with AI lead priority, drafts, meeting notes and preparation.
- Huddle is a direct product neighbor that markets a unified read-only task/status view across client tools. Its own 2026 survey is methodologically weak and commercially conflicted, so it is useful as a capability baseline, not as demand or ROI proof. [Huddle freelancer-tool survey](https://huddle.app/blog/what-freelancers-say-about-managing-client-tools)

Therefore these are commodity claims, not credible innovation:

- “AI summarizes client messages”;
- “AI creates tasks”;
- “AI sets priority”;
- “AI reminds you about deadlines”;
- “AI has a knowledge base”;
- “several AI nodes are connected in a workflow”;
- “AI uses customer or CRM history”;
- “an event or schedule triggers the Agent”;
- “the Agent calls MCP or cross-application tools”;
- “a user can approve or reverse a write”;
- “the run has logs, audit or observability”;
- “the Agent has persistent or learned memory”;
- “natural language generates a quote.”

### What “capability combination” means

Capabilities are primitives: unstructured-language understanding, retrieval, durable state, deterministic rules, tool actions, monitoring, verification and human approval. A workflow is the orchestration of those capabilities.

A Coze or other no-code workflow can qualify as a capability combination. The platform choice is not the innovation. The innovation must be visible in the causal design: why these capabilities are combined, which decision is delegated, where a human must approve, what changes in the external system, and what measurable failure disappears.

### The narrow innovation hypothesis

The proposed difference is not another project manager. It is three connected rules:

1. **Typed impact diff:** one new customer fact produces separate before/after candidates for quote, bilateral commitment, project and task, including conflicts, uncertainty and source excerpts.
2. **Bilateral state authority:** the service provider cannot impersonate the client's confirmation or acceptance; the counterparty action is independent evidence.
3. **Evidence-gated memory:** a model interpretation remains a candidate until it is approved, confirmed by the external system's response or confirmed by the client. Only then can it become a business fact used by later actions.

Together they form **event-to-consistent-company-state**:

```text
client message changes a delivery fact
-> retrieve the relevant commercial and delivery context
-> produce candidate quote / commitment / project / task impacts, confidence, contradictions and abstentions
-> show typed, evidence-linked state diffs and uncertainty
-> user approves the consequential actions
-> update the records and draft/send the response
-> observe the target-system or counterparty result
-> promote only verified changes into durable business memory
```

Human approval is not decorative. It should be a product rule here for consequential actions such as sending customer messages, changing a quote or updating authoritative records; current platforms implement approval selectively or configurably rather than universally. [Microsoft human-in-the-loop tool approvals](https://learn.microsoft.com/en-us/agent-framework/agents/tools/tool-approval)

### Scene entry

“Scene entry” means the exact moment and behavior through which the product enters existing work. Here the proposed entry is a client-change message, not a blank dashboard and not a manually created task. Message-first entry is a scene-fit and adoption choice, not a novelty claim: HubSpot and Salesforce already trigger work from customer conversations, email and other events.

The entry remains technically unresolved for personal WeChat. Official capabilities support enterprise WeCom archiving under administrator and consent requirements, intentional Mini Program opening of screenshots/files, and chat-bound output tools; they do not expose a general third-party API for arbitrary personal chat history. See [WeChat input feasibility](research/wechat-input.md).

### Innovation verdict

The generic Agent capability is not new. In the official products reviewed, we did not find an off-the-shelf OPC product that combines a typed quote-bilateral-commitment-project-task impact model with evidence-gated fact promotion. That bounded finding is not a market-blank or global-first claim: Salesforce, Microsoft, Glean, Notion, monday and other platforms can already compose most of the chain. The combination is defensible only if the demo proves all three mechanisms:

- it understands a real ambiguous client change;
- it finds consequences that a reminder or single task does not represent;
- it applies and verifies approved state changes with visible source evidence.

If the demo only imports text, generates tasks and starts reminders, the innovation score should be expected to be low.

## Go / no-go gate before specification

The research supports continuing the investigation, but not expanding the current prototype into the proposed full product chain.

Before product specification, collect real evidence from the target scene:

1. Interview 8-12 qualified operators and reconstruct recent client-change events from actual chats, quotes, project notes and task records. Record affected objects, manual steps, elapsed time and errors.
2. Run the proposed impact-diff output manually on those events. Have the operator judge each candidate, missing impact, contradiction and abstention, then observe whether the result changes the next action.
3. Enter a product test only if at least 5 of the first 8 participants can show a recent real artifact, at least 3 events contain the full chain of changed customer truth -> stale business state -> observable operating consequence, and qualified users report at least two such events per month and accept two weeks of live-project testing. Stop or change the segment if the event is rare, the impact is trivial, or a note/reminder solves it equally well.

The product should advance only if the same event, object pattern and measurable advantage recur. Otherwise change the target problem before writing code.
