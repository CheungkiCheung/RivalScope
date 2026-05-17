# RivalScope Agent Instructions

## Product Positioning

RivalScope is an auditable competitive intelligence operations console, not a
black-box AI report generator.

The core promise is:

```text
Every final claim must be traceable to frozen evidence.
```

Accepted evidence chain:

```text
SourceSnapshot -> EvidenceSpan -> AtomicFact -> Claim -> ReportBlock
```

## Must Read Before Work

Before changing code, read:

1. `docs/current-status.md`
2. `docs/implementation-handoff-plan.md`
3. `docs/architecture.md`

When touching UI, also read:

4. `docs/observability-ui-design.md`

Reference drafts live in `docs/reference/`. They are useful for subsystem
details, but the master plan and current-status documents win when documents
conflict.

## Current Status

- Module A: Evidence Data Foundation is accepted.
- Module B: Deterministic Demo Evidence Pipeline is accepted.
- Module C: the first UI attempt is rejected.
- Do not start Module D/E/F until Module C is rebuilt and accepted.

## Hard Constraints

- Do not touch `external/`.
- Do not edit `.next/`.
- Do not stage generated build output, `tmp/`, local environment files, or
  unrelated worktree files.
- Do not rewrite or rebuild Module A+B unless fixing a confirmed regression.
- Preserve the accepted A+B data model and persistence contract.
- Use TDD for data, runtime, persistence, and validation changes.
- For UI work, browser screenshots are required before claiming completion.

## AI-Native Operating Principles

RivalScope should be built like an AI-native research system:

- Each module must prove a capability, not merely add a feature.
- Evidence comes before synthesis; final text is downstream of validated
  artifacts.
- Every AI output is a candidate until schema, role, evidence, and trace gates
  accept it.
- Deterministic demo paths must remain available after real model paths are
  added.
- Skeptic, Critic, and TraceValidator are central product behavior, not extras.
- Human review actions should become future organizational memory.
- Durable context files are part of the product workflow; do not rely on chat
  memory for acceptance rules.

## Module C Hard Rules

Module C is `Multi-Page Observability UI`.

It must not be collapsed into one project detail page.

Required first-class routes or primary views:

```text
/projects/[projectId]
/projects/[projectId]/sources
/projects/[projectId]/claims
/projects/[projectId]/report
/projects/[projectId]/evaluation
/projects/[projectId]/dag
/projects/[projectId]/provenance
```

Module C fails if:

- only one project detail page exists;
- Source Library is only a section inside Cockpit;
- Claim Review is only a section inside Cockpit;
- Agent DAG is only a vertical timeline;
- Provenance is only a text or pill chain;
- Claim Inspector is buried below the fold on desktop;
- desktop/mobile screenshots are not provided.

## UI Design Rules

RivalScope UI should feel like a Competitive Intelligence Operations Console:

- dense professional enterprise SaaS;
- light background `#F6F7F9`;
- deep teal primary;
- blue-gray neutral states;
- amber warning;
- red danger;
- table-first review surfaces;
- right-side inspectors;
- graph/canvas audit views.

Avoid:

- marketing pages;
- chatbot UI;
- generic white-card dashboards;
- decorative AI glow;
- stuffing all features into one page.

## Verification

For core/data/runtime work:

```bash
npm test --workspace @rivalscope/core
npm test --workspace @rivalscope/agents
npm test --workspace @rivalscope/web
npm run typecheck
```

For DB schema work:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" npm run db:validate --workspace @rivalscope/db
```

For UI work:

```bash
npm test --workspace @rivalscope/web
npm run typecheck
npm run dev --workspace @rivalscope/web
```

Then capture browser screenshots:

- desktop: Cockpit, Sources, Claims, DAG, Provenance;
- mobile: Cockpit, Claims.
