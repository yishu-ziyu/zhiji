# Grok KAL PRD Review — 2026-07-16

Status: candidate product input, not implementation authority.

## Adopt

- Retrieval → knowledge → action → result feedback as one product loop.
- Original-source spans and traceable provenance for extracted claims.
- Human confirmation for high-risk external actions.
- Execution results and failures produce durable events and return to project knowledge.
- Natural-language/file intake with low maintenance burden.
- Structured contracts between capabilities.
- A reproducible meeting → tasks + follow-up draft → confirmation → result-feedback demo.
- Three retrieval triggers accepted in PRODUCT_DEV_TASKS.md D-08.

## Modify

- An input may remain useful knowledge without producing an immediate action. The system attempts connection and exposes unresolved context; it does not force every item through an action.
- “Meaningful grafting” becomes evidence-backed connection suggestions. Unconnected information may remain pending; the product must not invent a relation to eliminate an orphan count.
- Similarity 0.45, 30/90-day freshness, three-repetition SOP promotion, and orphan rate below 5% are hypotheses requiring evidence.
- Retriever/Synthesizer/Actioner may be capabilities within one Agent/runtime. Product behavior comes before internal Agent count.
- Confidence numbers require calibrated meaning. Source quality, confirmation state, freshness, and conflict are separate signals.
- Customer/project/concept/SOP/FAQ/case/note is too narrow as a universal ontology. Keep the existing generic project/material/card/relation/work/event model until business cases prove additional types.
- Human confirmation is risk-based. External sending, deletion, permission changes, money, legal/medical/financial decisions, and high-impact knowledge changes require explicit control.

## Hold pending source research

- Python 3.11, Pydantic, LangGraph, LiteLLM, Chroma/FAISS/LanceDB, Streamlit/Gradio.
- New repository and directory structure.
- Obsidian, Feishu, DingTalk, audio transcription, and webhook connector scope.
- A fixed serial multi-Agent topology.

The existing product is a Next.js/TypeScript system with Material, KnowledgeCard, Relation, ActionItem, WorkEvent, ProjectCanvasSnapshot, and Agent Bridge. Reuse or replacement decisions must compare open-source source code against this real surface and include migration/exit cost.

## Accepted retrieval behavior

1. User-requested retrieval.
2. Retrieval prompted by insufficient, conflicting, or stale evidence.
3. Retrieval required to complete an action with missing current facts.

Every retrieval shows where it searched, why it searched, and where each result came from. External search respects authorization. Duplicate/cost controls apply. Search hits remain candidates until cited, saved, confirmed, or verified through defined product behavior.

## Open decisions

- Q-21: automatic versus confirm-before-search behavior.
- Q-22: freshness and staleness rules.
- Q-23: external-source authorization.
- Q-24: whether every hit becomes a Raw record or only selected evidence enters project knowledge.
