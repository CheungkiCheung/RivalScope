# RivalScope Current Status

## What Is Decided

RivalScope is positioned as an auditable competitive intelligence operations
console, not a black-box AI report generator.

The AI-native operating principle is now explicit:

```text
Execution speed is not the moat. Durable, adversarial, auditable decision
quality is the moat.
```

That means RivalScope must preserve context between agent sessions, keep
deterministic validation beside model-backed work, and treat Skeptic, Critic,
TraceValidator, evals, and human review as core product behavior.

Core decided modules:

- Source Tooling: adapter-based evidence acquisition.
- Model Gateway: provider-neutral structured model gateway.
- Observability UI: competitive intelligence operations console.
- Master plan: [master-plan.md](master-plan.md).
- Execution handoff: [implementation-handoff-plan.md](implementation-handoff-plan.md).
- Root agent context: [../AGENTS.md](../AGENTS.md).

## What To Do Next

Do not make more module plans right now.

Current execution status:

```text
Module A+B is accepted.
Module C / UI first attempt exists but is not accepted.
Do not proceed to Module D/E/F.
```

The next execution session should rework Module C, not start a new module. It
must read:

1. [implementation-handoff-plan.md](implementation-handoff-plan.md)
2. [source-tooling-design.md](source-tooling-design.md)
3. [observability-ui-design.md](observability-ui-design.md)
4. [architecture.md](architecture.md)

## Module C Design Rejection

The first Module C implementation connected to the A+B read model, but it does
not meet the intended Competitive Intelligence Operations Console standard.
Treat it as a data-wiring prototype, not as accepted UI.

Observed issues from code review and product/design expectations:

1. Visual quality is below the approved generated-image direction.
   - The current workbench reads as basic white cards and stacked tables.
   - It lacks the dense, polished, operations-console hierarchy expected for
     the competition demo.

2. The layout does not create a strong first-viewport signal.
   - A judge should immediately understand: agent workflow, claims under
     review, confidence/trust, evidence lineage, and validation status.
   - The current page exposes those concepts, but the hierarchy is too flat and
     not memorable.

3. Provenance is present as text, not as a compelling audit surface.
   - The compact chain should feel like a lineage rail or graph-like audit
     object, not only repeated text rows.
   - Evidence spans, atomic facts, semantic edges, and report blocks need clear
     visual grouping.

4. Source & Evidence Library is not yet a real inspection experience.
   - It should resemble a source table plus selected snapshot/evidence preview.
   - Current cards do not provide enough enterprise review density or source
     metadata structure.

5. The UI likely passes render tests but not design acceptance.
   - Server-side render coverage is useful, but Module C acceptance requires
     browser screenshots across desktop and mobile.

6. The information architecture is wrong for the final product.
   - The current implementation collapses Cockpit, Claim Review, Source
     Library, Evidence Preview, Agent Timeline, and Trace status into one
     project page.
   - RivalScope needs multiple first-class routes or primary views, not one
     overloaded project detail page.

7. The graph/canvas requirement is missing.
   - Agent workflow is shown as a vertical timeline, not an Agent DAG Canvas.
   - Provenance is shown as pills/text, not a graph-like audit surface.

Required Module C rework direction:

- Preserve the accepted A+B data model and read path.
- Do not rewrite A+B.
- Replace the current visual composition if needed.
- Target the generated-image standard: enterprise tool, dense but elegant,
  clear panels, strong inspector, visible lineage, table-first workflow review.
- Use real A+B data, not static mock UI.
- Verify with browser screenshots, not only component tests.
- Do not collapse Module C into a single page.
- Build multiple first-class routes or primary views:
  Project Cockpit, Source & Evidence Library, Claim Review Workbench, Agent DAG
  Canvas, and Provenance Graph Canvas.
- Report Studio and Evaluation Dashboard can be demo-quality in this pass, but
  the navigation and page boundaries must exist.

Hard failure conditions:

- Only one project detail page exists.
- Source Library is only a section inside Project Cockpit.
- Claim Review is only a section inside Project Cockpit.
- Agent DAG is only a vertical timeline.
- Provenance is only a text/pill chain.
- Claim Inspector is buried below the fold on desktop.
- No desktop/mobile screenshots are provided.

## Module A+B Acceptance Record

Independent A+B review passed after the targeted blocker fix and real DB
contract verification.

Verified:

1. Counter-evidence trace semantics.
   - `SUPPORTS`, `REFUTES`, and `QUALIFIES` are now derived from atomic fact
     polarity, evidence span `spanType`, and claim verdict/status.
   - Supporting facts should no longer become `QUALIFIES` merely because a claim
     has counter evidence.

2. `ModelRun` input provenance.
   - The deterministic demo artifact shape is now `input: { claimIds: [...] }`.
   - Persistence should preserve the scored claim ids in `ModelRun.input`.

3. Real persistence/readback contract coverage.
   - A contract test now covers create project -> run deterministic demo
     workflow -> persist -> `ProjectRepository.get`.
   - It asserts source snapshots, evidence spans, atomic facts, claims, report
     blocks, trace validations, trace edges, and model runs are visible.
   - This test was executed against a real temporary Postgres database and
     passed with 10/10 tests.

4. Canonical demo fixtures no longer serialize hardcoded `project_1` for custom
   project ids.

5. Trace validation coherence.
   - Report blocks that cite an existing but unrelated evidence span should now
     fail validation.

Remaining acceptance gate:

```text
None for Module A+B.
```

Verification results from acceptance review:

- `npm test --workspace @rivalscope/core`: passed, 12/12 tests.
- `npm test --workspace @rivalscope/agents`: passed, 11/11 tests.
- `npm test --workspace @rivalscope/web`: passed, 9 passed / 1 skipped when
  `DATABASE_URL` was absent.
- `npm run typecheck`: passed.
- `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" npm run db:validate --workspace @rivalscope/db`:
  passed, Prisma schema valid.
- `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" npm test --workspace @rivalscope/web -- apps/web/lib/analysis-persistence.test.ts`:
  passed, 10/10 tests with real Prisma readback contract executed.

## Current Code Reality

Useful existing code:

- `packages/core/src/workflow.ts`
- `packages/agents/src/agent.ts`
- `packages/agents/src/workflow-runner.ts`
- `packages/agents/src/artifacts.ts`
- `packages/db/src/repositories.ts`
- `apps/web/lib/run-analysis.ts`

Already upgraded by the current Module A+B implementation and targeted blocker
patches:

- `packages/core/src/evidence.ts`
- `packages/agents/src/analysis-agents.ts`
- `packages/agents/src/workflow-schemas.ts`
- `packages/db/prisma/schema.prisma`
- `apps/web/lib/analysis-persistence.ts`
- `packages/db/src/repositories.ts`

Still not in current scope:

- `apps/web/app/projects/[projectId]/page.tsx`
- `apps/web/app/globals.css`

Do not touch:

- `external/`
- `.next/`

## First Slice Definition

The first finished slice must produce:

```text
SourceSnapshot
  -> EvidenceSpan
  -> AtomicFact
  -> Claim
  -> ConfidenceBreakdown
  -> ReviewFinding
  -> TraceValidationResult
  -> ReportBlock
```

This should run offline with deterministic fixtures before adding real web
scraping or real LLM calls.

## Exact Next Instruction For Verification Session

```text
Module A+B is accepted.
Module C first attempt is not accepted; rework Module C UI first.
Do not touch external/.
Do not edit .next/.

Use Module A+B as the data and persistence baseline:
SourceSnapshot -> EvidenceSpan -> AtomicFact -> Claim -> ReportBlock,
with TraceEdge, TraceValidationResult, ReviewFinding, and ModelRun readback.

Do not create new planning modules.
Do not enter Module D/E/F.

Rework Module C: Multi-Page Observability UI.
The current implementation should be treated as a data-wiring prototype, not
accepted design. Do not keep its single-page information architecture.

Acceptance requirements:
1. Build multiple first-class routes or primary views:
   - Project Cockpit
   - Source & Evidence Library
   - Claim Review Workbench
   - Agent DAG Canvas
   - Provenance Graph Canvas
   - Report Studio and Evaluation Dashboard may be demo-quality but must have
     route/view boundaries.
2. Project Cockpit is only the control plane, not the whole product.
3. Source Library must be its own audit view with source table plus selected
   snapshot/evidence preview.
4. Claim Review must be its own review view with filters, dense claims table,
   and right-side inspector.
5. Agent DAG Canvas must show boxes and connecting semantic edges for the 11
   A+B agents. A timeline alone fails.
6. Provenance Graph Canvas must show:
   SourceSnapshot -> EvidenceSpan -> AtomicFact -> Claim -> ReportBlock,
   plus TraceValidationResult/ReviewFinding/ModelRun where available.
7. Claims table must be dense and professional.
8. Inspector must visually separate confidence, semantic evidence edges,
   TraceValidator, findings, provenance, and actions.
9. Use A+B read model data only; do not fake the UI with static data.
10. Validate with browser screenshots:
    - desktop: Cockpit, Sources, Claims, DAG, Provenance
    - mobile: Cockpit, Claims
```
