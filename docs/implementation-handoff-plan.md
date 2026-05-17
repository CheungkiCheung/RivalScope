# RivalScope Implementation Handoff Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` or `superpowers:executing-plans` to
> implement this plan task-by-task. Do not jump to the next module until the
> current module reaches its acceptance criteria.

**Goal:** Turn the already-defined RivalScope architecture into a polished,
competition-ready product slice instead of building shallow MVPs for every
module.

**Architecture:** Start with the evidence data model and deterministic fixture
pipeline, then make the UI expose that data through Project Cockpit, Source &
Evidence Library, Claim Review, Provenance Graph, and Evaluation views. Keep
the existing DAG runner and Agent/Tool interfaces where useful, but upgrade the
artifact and persistence model from `SourceChunk -> Fact -> Claim` to
`SourceSnapshot -> EvidenceSpan -> AtomicFact -> Claim`.

**Tech Stack:** TypeScript, Next.js App Router, Prisma/PostgreSQL, Zod, Vitest.
Use the existing monorepo packages: `@rivalscope/core`, `@rivalscope/agents`,
`@rivalscope/db`, `@rivalscope/tools`, and `apps/web`.

**AI-native operating rule:** optimize for durable, adversarial, auditable
decision quality. Every new coding session must preserve the accepted context
in docs and artifacts, not rely on chat memory. Model output is candidate data
until schema, role, evidence, and trace gates accept it.

---

## Current Execution Gate

Module A+B is accepted. Module C / UI first attempt exists but is rejected.
Do not proceed to Module D/E/F until Module C is rebuilt as a multi-page
observability UI.

The accepted A+B baseline includes:

- counter-evidence trace edges are derived from atomic fact polarity, evidence
  span `spanType`, and claim verdict/status;
- `ModelRun.input` preserves the actual confidence-scorer claim ids;
- a repository/Prisma readback contract test exists and passed against a real
  temporary Postgres database;
- canonical demo fixtures are project-id parameter driven;
- TraceValidator rejects report blocks that cite unrelated existing evidence
  spans.

Acceptance verification results:

- `npm test --workspace @rivalscope/core`: passed, 12/12 tests.
- `npm test --workspace @rivalscope/agents`: passed, 11/11 tests.
- `npm test --workspace @rivalscope/web`: passed, 9 passed / 1 skipped when
  `DATABASE_URL` was absent.
- `npm run typecheck`: passed.
- `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" npm run db:validate --workspace @rivalscope/db`:
  passed, Prisma schema valid.
- `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" npm test --workspace @rivalscope/web -- apps/web/lib/analysis-persistence.test.ts`:
  passed, 10/10 tests with real Prisma readback contract executed.

## 0. Read This Before Coding

The user explicitly wants the earlier modules finished to final demo quality.
Do not create more speculative module plans right now.

Current canonical docs:

- [master-plan.md](master-plan.md)
- [source-tooling-design.md](source-tooling-design.md)
- [model-gateway-design.md](model-gateway-design.md)
- [observability-ui-design.md](observability-ui-design.md)
- [architecture.md](architecture.md)

Reference docs are kept in [reference](reference). If a reference doc conflicts
with the master plan or this handoff plan, follow the master plan and this
handoff plan.

## 1. Current Code Audit

### Keep And Build On

Keep these files and patterns:

- `packages/core/src/workflow.ts`
  - Good immutable DAG state model.
  - Keep scheduling, status transitions, retry, and blocking behavior.
  - Extend later for branch policies and gates.

- `packages/agents/src/agent.ts`
  - Good `Agent` and `Tool` contract foundation.
  - Keep Zod input/output validation.
  - Extend with role contracts, model run records, and richer tool statuses.

- `packages/agents/src/workflow-runner.ts`
  - Useful in-memory runner.
  - Keep as the first runtime.
  - Extend after data model is upgraded.

- `packages/agents/src/artifacts.ts`
  - Useful in-memory artifact store.
  - Must expand artifact kinds.

- `packages/db/src/repositories.ts`
  - Useful repository pattern.
  - Must expand to new source/evidence/model/eval entities.

- `apps/web/lib/run-analysis.ts`
  - Useful server action entry point.
  - Must be rewritten from old 4-node MVP into the new fixture evidence
    pipeline.

- `apps/web/app/projects/[projectId]/page.tsx`
  - Useful route.
  - Current UI should be replaced by Project Cockpit structure.

### Replace Or Heavily Rewrite

These are no longer aligned with the desired final effect:

- `packages/core/src/evidence.ts`
  - Current model stops at `Source -> SourceChunk -> Fact -> Claim`.
  - Replace with or extend to `SourceSnapshot`, `EvidenceSpan`, `AtomicFact`,
    `KnowledgeItem`, `Claim`, `Insight`, `Recommendation`, `ReportBlock`.

- `packages/agents/src/analysis-agents.ts`
  - Current agents are simplistic mock transforms.
  - Keep only as a temporary fixture idea. Replace with deterministic demo
    agents that emit realistic evidence spans, atomic facts, claims,
    confidence, findings, and report blocks.

- `packages/agents/src/workflow-schemas.ts`
  - Current artifact enum is too narrow.
  - Expand around new artifact types.

- `packages/db/prisma/schema.prisma`
  - Current schema lacks `SourceSnapshot`, `EvidenceSpan`, `AtomicFact`,
    confidence breakdowns, trace edges, model runs, eval records, and richer
    statuses.
  - Migrate forward; do not try to force final UI on the old schema.

- `apps/web/app/globals.css`
  - Current design system uses blue primary and basic card layout.
  - Replace with the observability UI design: light background, deep teal,
    compact enterprise tables, inspectors, chips, timelines, graph surfaces.

- `apps/web/app/projects/[projectId]/page.tsx`
  - Current page is report plus logs.
  - Replace with Project Cockpit / Claims tab first.

### Do Not Touch

- `external/`
  - Existing untracked directory. Leave it alone.

- `.next/`
  - Build output, not source. Do not edit it.
  - If it is not ignored, add or verify `.gitignore` includes `.next/`.

## 2. Conflict Review From Planning Docs

The recent planning docs are broadly consistent. Known corrections:

1. Source Tooling says Scrapling is optional backend, not core model.
   - Implementation must keep TypeScript tool contracts stable.
   - Do not hardwire business logic to Scrapling.

2. Model Gateway says LLM outputs are candidate artifacts.
   - Even when real LLMs are added, runtime must validate before artifact
     commit.
   - For now, deterministic fixture/mock model path is preferred.

3. Observability UI includes many pages.
   - Do not build all pages shallowly.
   - Build Project Cockpit, Source & Evidence Library, Claim Inspector, and
     Provenance Graph quality first.

4. Status names must be consistent.
   - Use the taxonomy in `observability-ui-design.md`.
   - Avoid `Completed` if TraceValidator is still pending.

5. Demo data must be consistent.
   - Use one small demo scale unless showing a benchmark run.
   - Recommended demo scale:
     `Sources 146`, `SourceSnapshots 187`, `EvidenceSpans 512`,
     `AtomicFacts 231`, `Claims 63`, `Findings 47`, `ToolCalls 1,024`,
     project run cost `$8.42`.
   - Benchmark cost `$42.18` belongs on Evaluation Dashboard only.

6. Evaluation seeded defects must be internally consistent.
   - If catch rate is high, most seeded defects must show Passed.

## 3. Best Starting Point

Start with **Module A: Evidence Data Foundation + Deterministic Demo Run**.

Reason:

- UI final effect depends on real structured data.
- Source Tooling, confidence, provenance, and UI all need `SourceSnapshot` and
  `EvidenceSpan`.
- Building UI first on the old schema will create throwaway work.
- Real LLM and Scrapling can wait until the evidence pipeline and UI have a
  stable contract.

The first final-quality slice should be:

```text
fixture source snapshots
  -> evidence spans
  -> atomic facts
  -> claims with confidence breakdown
  -> review findings
  -> trace validation
  -> report blocks with evidence chips
  -> Project Cockpit + Source Library + Claim Inspector
```

## 4. Implementation Modules

Do these in order. Each module must be demo-quality before moving on.

### Module A: Evidence Data Foundation

Goal:

Upgrade the domain and database model to support frozen source snapshots,
evidence spans, atomic facts, confidence breakdowns, findings, trace validation,
and report blocks.

Files:

- Modify: `packages/core/src/evidence.ts`
- Modify: `packages/core/src/evidence.test.ts`
- Modify: `packages/agents/src/artifacts.ts`
- Modify: `packages/agents/src/workflow-schemas.ts`
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `packages/db/src/repositories.ts`
- Modify: `apps/web/lib/analysis-persistence.ts`

Required domain objects:

- `SourceSnapshot`
- `EvidenceSpan`
- `AtomicFact`
- `KnowledgeItem`
- `Claim`
- `ClaimConfidence`
- `Insight`
- `Recommendation`
- `ReportBlock`
- `ReviewFinding`
- `TraceValidationResult`

Required database additions:

- `SourceSnapshot`
- `EvidenceSpan`
- `AtomicFact`
- `KnowledgeItem`
- enhanced `Claim` fields:
  - support verdict
  - status
  - claim type
  - confidence
  - confidence breakdown JSON
  - source quality
  - freshness
  - counter evidence count
- `ClaimEvidenceSpan` or equivalent join table
- `TraceEdge`
- `TraceValidationResult`
- `ModelRun` placeholder table can be added now or Module D
- `EvalRun` can wait until Module F

Important:

- Do not delete `Source` and `SourceChunk` until replacements are wired. They
  can coexist temporarily.
- Prefer additive Prisma migration first, then remove old usage after UI and
  persistence move to snapshots/spans.

Acceptance criteria:

- Unit tests prove a claim cannot be valid without evidence spans.
- Unit tests prove `SourceSnapshot -> EvidenceSpan -> AtomicFact -> Claim`
  lineage can be built.
- Prisma schema validates.
- Repositories can create and read a project with source snapshots, evidence
  spans, atomic facts, claims, confidence breakdowns, findings, and report
  blocks.
- Trace validation rejects incoherent lineage, including report blocks that cite
  an evidence span that exists but is not linked to the block's cited claims.
- Real repository/Prisma contract coverage proves persisted A+B entities are
  visible through `ProjectRepository.get`.

Verification commands:

```bash
npm test --workspace @rivalscope/core
npm run db:validate --workspace @rivalscope/db
npm run typecheck
```

### Module B: Deterministic Demo Evidence Pipeline

Goal:

Replace the old 4-node mock analysis with a deterministic final-quality demo run
that creates realistic data for all core UI surfaces.

Files:

- Modify: `apps/web/lib/run-analysis.ts`
- Modify: `apps/web/lib/analysis-persistence.ts`
- Modify: `packages/agents/src/analysis-agents.ts`
- Add: `packages/agents/src/demo-fixtures.ts`
- Add tests in `packages/agents/src/*.test.ts` and `apps/web/lib/*.test.ts`

Target DAG nodes:

```text
research_planner
collector
snapshot_parser
extractor
knowledge_structurer
analyst
skeptic
confidence_scorer
writer
critic
trace_validator
```

The first implementation can be deterministic, fixture-backed, and offline.
It must still produce final-shaped artifacts:

- source candidates
- policy decisions
- source snapshots
- parsed documents
- evidence spans
- atomic facts
- knowledge items
- claims
- confidence breakdowns
- skeptic findings
- critic findings
- trace validation results
- report blocks
- tool calls
- model run placeholders or mock model runs

Acceptance criteria:

- Running the DAG creates a coherent project run with consistent counts.
- At least one claim has supporting evidence and counter evidence.
- At least one claim is approved.
- At least one claim needs more evidence.
- At least one refuted or hypothesis-only claim exists.
- TraceValidator result exists and links to final report blocks.
- AgentRun and ToolCall records are visible and meaningful.
- No network is required.
- Counter-evidence edges are generated from atomic fact polarity, evidence span
  `spanType`, and claim verdict/status. A claim having counter evidence must not
  cause every cited fact to become `QUALIFIES`.
- `ModelRun.input` preserves the claim ids used by the confidence scorer from
  the actual deterministic demo artifact shape.
- Demo fixtures are project-id parameter driven. Serialized artifacts for a
  custom project id must not contain `project_1`.

Verification commands:

```bash
npm test --workspace @rivalscope/agents
npm test --workspace @rivalscope/web
npm run typecheck
```

### Module C: Multi-Page Observability UI

Goal:

Build the polished product UI for the accepted A+B evidence pipeline. This is a
multi-page Competitive Intelligence Operations Console, not a single project
detail page. The UI must expose project status, claim review, source/evidence
audit, report assembly, evaluation, Agent DAG, and provenance graph through
separate routes or first-class primary views.

Current status:

- A first Module C attempt exists, but it is not accepted.
- It connected to the A+B read model, but collapsed too many concepts into one
  `/projects/[projectId]` page.
- Treat that implementation as a data-wiring prototype. Reuse useful read-model
  mapping code if it helps, but do not preserve the single-page information
  architecture.

Hard rule:

```text
Module C fails if the final UI is only one project detail page.
```

Files:

- Replace/modify: `apps/web/app/projects/[projectId]/page.tsx`
- Add/modify routes under `apps/web/app/projects/[projectId]/`
- Add: `apps/web/app/projects/[projectId]/components/*.tsx`
- Add: `apps/web/app/projects/[projectId]/sources/page.tsx`
- Add: `apps/web/app/projects/[projectId]/claims/page.tsx`
- Add: `apps/web/app/projects/[projectId]/report/page.tsx`
- Add: `apps/web/app/projects/[projectId]/evaluation/page.tsx`
- Add: `apps/web/app/projects/[projectId]/dag/page.tsx`
- Add: `apps/web/app/projects/[projectId]/provenance/page.tsx`
- Modify: `apps/web/app/globals.css`
- Avoid repository rewrites unless a UI read-model field is genuinely missing.

Required route/view split:

```text
/projects/[projectId]
  Project Cockpit / Main Workbench

/projects/[projectId]/sources
  Source & Evidence Library

/projects/[projectId]/claims
  Claim Review Workbench

/projects/[projectId]/report
  Report Studio

/projects/[projectId]/evaluation
  Evaluation Dashboard

/projects/[projectId]/dag
  Agent DAG Canvas

/projects/[projectId]/provenance
  Provenance Graph Canvas
```

Minimum accepted scope for the next rework:

- Project Cockpit.
- Source & Evidence Library.
- Claim Review Workbench.
- Agent DAG Canvas.
- Provenance Graph Canvas.

Report Studio and Evaluation Dashboard may be demo-quality if needed, but the
navigation and page boundaries must exist. Do not hide everything behind one
tabbed page.

Recommended component split:

```text
AppShell
ProjectSubnav
ProjectCockpit
ProjectHeader
QualityMetricStrip
AgentDagMiniMap
AgentDagCanvas
ProvenanceMiniRail
ProvenanceGraphCanvas
ClaimsTable
ClaimInspector
ConfidenceBreakdown
SemanticEdgeSummary
SupportingEvidenceList
SourceEvidenceLibrary
SourceTable
SourceSnapshotPanel
EvidenceSpanPreview
ClaimReviewWorkbench
ClaimFilters
ReportStudio
EvaluationDashboard
StatusChip
EvidenceChip
```

Visual requirements:

- Match `observability-ui-design.md`.
- Light background `#F6F7F9`.
- Deep teal primary.
- Dense, professional, table-first UI.
- No marketing hero.
- No chatbot UI.
- No generic white-card dashboard.
- Graph/canvas visual language is required for DAG and provenance. A vertical
  timeline or pill chain is not enough.

Acceptance criteria:

- The app has multiple first-class routes or primary views for Cockpit,
  Sources, Claims, DAG, and Provenance. A single all-in-one project detail page
  is not accepted.
- Project Cockpit is a control plane, not a warehouse of every object. It shows
  project header, quality metric strip, Agent DAG mini-map, high-priority
  claims, selected claim preview, and compact provenance signal.
- Source & Evidence Library is its own audit view: source table on the left,
  selected SourceSnapshot and EvidenceSpan preview on the right, with used-by
  AtomicFacts/Claims/ReportBlocks.
- Claim Review Workbench is its own review view: filters, dense claims table,
  right-side Claim Inspector, confidence breakdown, support/refute/qualify
  evidence, findings, TraceValidator result, and publication actions.
- Agent DAG Canvas is a real canvas/graph-like surface with the 11 accepted
  A+B agents as boxes and semantic edges between them. A vertical timeline alone
  fails acceptance.
- Provenance Graph Canvas is a real canvas/graph-like surface centered on a
  selected claim or report block. It shows:
  `SourceSnapshot -> EvidenceSpan -> AtomicFact -> Claim -> ReportBlock`,
  plus TraceValidationResult/ReviewFinding/ModelRun when available.
- Semantic edge colors/classes are visible:
  `SUPPORTS`, `REFUTES`, `QUALIFIES`, `LINEAGE`, and `VALIDATED_BY`.
- Claims table shows status, confidence, evidence count, counter evidence,
  freshness, source quality, and findings.
- All core data comes from the accepted A+B read model. Do not fake static UI
  data in place of ProjectRepository data.
- Desktop screenshots exist for Cockpit, Sources, Claims, DAG, and Provenance.
- Mobile screenshots exist for Cockpit and Claim Review.
- No page has incoherent text overlap, horizontal body overflow, or a buried
  desktop inspector below the fold.
- Counts and statuses are consistent across views.

Explicit failure conditions:

- Only one project detail page exists.
- Source Library is only a section inside Cockpit.
- Claim Review is only a section inside Cockpit.
- Agent DAG is only a timeline, with no box-and-line canvas.
- Provenance is only a text or pill chain, with no graph/rail audit surface.
- Claim Inspector is below the fold on desktop review pages.
- Browser screenshots are not provided.
- The UI looks like a generic admin dashboard of white cards and tables.

Verification:

```bash
npm test --workspace @rivalscope/web
npm run typecheck
npm run dev --workspace @rivalscope/web
```

Then open the app in the browser and verify:

- Desktop: Cockpit, Sources, Claims, DAG, Provenance.
- Mobile: Cockpit, Claims.

### Module D: Model Gateway Skeleton

Goal:

Add the model gateway contracts and mock model runtime without depending on a
real provider yet.

Files:

- Add: `packages/agents/src/model/model-client.ts`
- Add: `packages/agents/src/model/model-gateway.ts`
- Add: `packages/agents/src/model/mock-model-client.ts`
- Add: `packages/agents/src/model/model-run-record.ts`
- Add: `packages/agents/src/model/prompt-template.ts`
- Add: `packages/agents/src/runtime/role-contract-validator.ts`
- Add: `packages/agents/src/runtime/evidence-reference-validator.ts`
- Modify: `packages/agents/src/index.ts`
- Modify: `packages/db/prisma/schema.prisma` if `ModelRun` not added in Module A.

Important:

- Implement mock first.
- Do not require API keys.
- Do not connect a real provider until mock path and tests are stable.

Acceptance criteria:

- Tests cover invalid JSON, schema failure, role contract failure, evidence id
  failure, retry limit, and successful structured output.
- ModelRunRecord is created for mock model calls.
- Extractor/Analyst can use mock model gateway path without changing artifact
  contracts.

Verification:

```bash
npm test --workspace @rivalscope/agents
npm run typecheck
```

### Module E: Graph Audit Views

Goal:

Add Agent DAG Canvas and Provenance Graph Canvas as audit views.

Files:

- Add components under `apps/web/app/projects/[projectId]/components/graph/`
- Add route or tab for:
  - Agent DAG Canvas
  - Provenance Graph Canvas
- Consider React Flow only if it is worth dependency cost. A static SVG/HTML
  graph is acceptable for first demo if polished and clickable.

Acceptance criteria:

- Agent DAG Canvas shows typed nodes and semantic edges:
  `artifact_flow`, `review_feedback`, `targeted_research`,
  `publication_gate`, `validated_by`.
- Provenance Graph Canvas centers on a selected claim and shows backward and
  forward lineage.
- Clicking a node updates the inspector.
- Graph is an audit feature, not decorative.

Verification:

```bash
npm run typecheck
```

Manual browser verification required.

### Module F: Evaluation Dashboard Demo

Goal:

Show repeatable benchmark comparison using deterministic fixture results.

Files:

- Add: `packages/evals` or start with `apps/web/lib/eval-fixtures.ts` if faster.
- Add UI components for Evaluation Dashboard.
- Add persistence later if needed.

Acceptance criteria:

- Baseline table compares:
  - `single_llm_report`
  - `standard_rag_report`
  - `linear_agent_pipeline`
  - `rivalscope_full_system`
- RivalScope scores best on trust and traceability.
- Seeded defects table is consistent with catch rate.
- Critical failures do not contradict high overall score.

Verification:

```bash
npm run typecheck
```

Manual browser verification required.

## 5. What To Delete Or Ignore

Do not delete working code prematurely. Replace old MVP surfaces only after the
new surface is wired.

Safe to remove or replace during implementation:

- Old UI markup in `apps/web/app/projects/[projectId]/page.tsx` once Project
  Cockpit components are ready.
- Old blue-centric design tokens in `apps/web/app/globals.css`.
- Old simplistic `createAnalysisWorkflowAgents` behavior after deterministic
  demo agents are added.
- Old `source_chunks` artifact usage after snapshot/span artifacts are wired.

Do not remove yet:

- `Source`, `SourceChunk`, `Fact`, and current join tables in Prisma until a
  migration path is complete.
- Existing workflow tests.
- Existing agent/tool interface tests.

Ignore or gitignore:

- `.next/`
- `node_modules/`

## 6. Recommended Next Execution Plan

For the next implementation session, do not attempt all modules.

Module A+B is already accepted. Do not rebuild it unless a regression appears.

Start with:

```text
Module C: Multi-Page Observability UI
```

Then stop and verify. Only after independent acceptance should anyone move to
Module D/E/F.

Why:

- A+B already creates the final-shaped data needed by the UI.
- The first UI attempt failed because it collapsed the product into one page.
- Rebuilding C now converts the accepted evidence pipeline into a competition
  demo surface.
- It keeps the work scoped and reviewable.

Concrete first task:

```text
Replace the single-page project detail composition with the route/view split in
Module C:
Cockpit, Sources, Claims, Report, Evaluation, Agent DAG, Provenance.
```

Then:

```text
Build Source & Evidence Library and Claim Review Workbench against
ProjectRepository.get read-model data.
```

Then:

```text
Build Agent DAG Canvas and Provenance Graph Canvas with box-and-line graph
language, not only timelines or pills.
```

## 7. Definition Of Done For The First Finished Slice

The first slice is done only when all are true:

- A new demo project can run offline.
- The run produces final-shaped evidence artifacts.
- Claims cite evidence spans, not only source chunks.
- Confidence breakdown exists for claims.
- Trace validation result exists.
- Review findings exist and are linked to claims or report blocks.
- Project Cockpit shows meaningful data from the accepted A+B read model.
- Source & Evidence Library shows snapshots and evidence highlights.
- Tests pass.
- Typecheck passes.
- Browser screenshot matches the UI direction in `observability-ui-design.md`.

Current status note:

```text
Module A+B is accepted. Module C first attempt is rejected because it collapsed
the UI into one project detail page. Rebuild Module C as a multi-page
observability UI before entering Module D/E/F.
```

## 8. Handoff Summary For A New Agent

If starting a new conversation, give the new agent this instruction:

```text
Read AGENTS.md, docs/current-status.md, and docs/implementation-handoff-plan.md
first. Do not create new module plans. Module A+B is accepted. Use TDD. Keep
existing workflow/agent interfaces where useful. Do not touch external/. Do not
edit .next/. Do not enter Module D/E/F.

Rebuild Module C: Multi-Page Observability UI. Use the accepted A+B data model
and persistence contract as the baseline:
SourceSnapshot -> EvidenceSpan -> AtomicFact -> Claim -> ReportBlock, with
TraceEdge, TraceValidationResult, ReviewFinding, and ModelRun readback.

Hard requirements:
- Do not collapse everything into one `/projects/[projectId]` page.
- Build first-class routes or primary views for Cockpit, Sources, Claims, DAG,
  and Provenance.
- Agent DAG must be a box-and-line canvas, not only a vertical timeline.
- Provenance must be a graph/rail audit surface, not only text or pills.
- Validate with desktop and mobile browser screenshots.

Do not rebuild or re-plan A+B unless a new regression appears.
```
