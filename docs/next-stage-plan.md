# RivalScope Next Stage Plan

This file is intentionally short.

The previous next-stage plan became stale after the confidence, provenance,
DAG, role-contract, schema, and evaluation discussions were consolidated. The
current canonical roadmap is now:

- [master-plan.md](master-plan.md)

Use `master-plan.md` for execution order, module priorities, acceptance
criteria, and competition positioning.

For the next coding session, use the execution handoff:

- [implementation-handoff-plan.md](implementation-handoff-plan.md)

Current implementation must start with:

1. Module C: Multi-Page Observability UI rework.

Do not continue to the following modules until Module C is accepted:

2. Source tooling and evidence ingestion.
3. Model gateway and real agents.
4. Tool contracts and runtime guardrails.
5. Routed research DAG.

The active Phase 1 subsystem plan is:

- [source-tooling-design.md](source-tooling-design.md)

The active Phase 2 subsystem plan is:

- [model-gateway-design.md](model-gateway-design.md)

The active Module C UI plan is:

- [observability-ui-design.md](observability-ui-design.md)

The highest-impact competition slice remains:

```text
SourceSnapshot + EvidenceSpan
  -> real Extractor / Analyst
  -> confidence and trace gates
  -> clickable provenance UI
  -> eval baseline comparison
```
