# Eval-Guided Repair Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic repair loop that turns critic findings into auditable repair actions, produces a repaired report, and emits before/after quality delta artifacts for judge-visible optimization.

**Architecture:** Extend the existing agent DAG from `extract -> analyze -> write -> critique` to `extract -> analyze -> write -> critique -> repair -> apply_repair -> final_eval`. The repair planner never invents evidence; it turns critic findings into auditable actions. The apply-repair node removes unsafe report references, while the final evaluator reads repair artifacts and the repaired report to produce a compact quality delta for UI and documentation.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, Prisma repositories, existing `@rivalscope/agents`, `@rivalscope/evals`, and `@rivalscope/db` packages.

---

## File Structure

- Modify `packages/agents/src/artifacts.ts`: add `repair_result` and `final_eval` artifact kinds.
- Modify `packages/agents/src/workflow-schemas.ts`: allow the two new artifact kinds through agent I/O validation.
- Modify `packages/agents/src/analysis-agents.ts`: export repair/final-eval types and add `createRepairPlannerAgent()`, `createApplyRepairAgent()`, and `createFinalEvaluatorAgent()`.
- Modify `packages/agents/src/workflow-runner.test.ts`: add RED/GREEN tests for repair behavior and seven-node DAG integration.
- Modify `apps/web/lib/run-analysis.ts`: extend the production workflow nodes to include `repair`, `apply_repair`, and `final_eval`.
- Modify `apps/web/lib/run-analysis.test.ts`: assert the production DAG shape includes the repair loop.
- Modify `packages/db/src/repositories.ts`: include recent generic artifacts on `ProjectRepository.get()`.
- Create `apps/web/lib/project-repair-summary.ts`: parse persisted artifacts into a UI-safe repair summary.
- Create `apps/web/lib/project-repair-summary.test.ts`: verify artifact parsing and delta behavior.
- Modify `apps/web/app/projects/[projectId]/page.tsx`: show Quality Delta and Repair History.
- Modify `docs/top3-execution-harness.md` and `docs/next-stage-plan.md`: record Phase 3 state and next risks.

## Task 1: Agent-Level Repair Artifacts

**Files:**
- Modify: `packages/agents/src/artifacts.ts`
- Modify: `packages/agents/src/workflow-schemas.ts`
- Modify: `packages/agents/src/analysis-agents.ts`
- Test: `packages/agents/src/workflow-runner.test.ts`

- [ ] **Step 1: Write the failing repair-agent tests**

Add tests that construct facts, claims, a draft report, and targeted critic findings. Assert:

- high-severity `unsupported_claim` or `unknown_fact` findings targeting a claim remove that claim from repaired report sections;
- missing dimensions become unresolved repair actions without inventing new claims;
- repair output includes `draftQualityScore`, `plannedQualityScore`, `delta`, and action records.

Run:

```bash
npm test --workspace @rivalscope/agents -- workflow-runner.test.ts -t "repair agent"
```

Expected: FAIL because `createRepairPlannerAgent`, `createApplyRepairAgent`, and artifact kinds do not exist.

- [ ] **Step 2: Add artifact kinds and schema entries**

Add `"repair_result"` and `"final_eval"` to both the TypeScript `ArtifactKind` union and Zod enums.

- [ ] **Step 3: Implement minimal repair agent**

Implement `createRepairPlannerAgent()` in `packages/agents/src/analysis-agents.ts`:

- read latest `review_findings`;
- collect high-severity claim findings in `unsupported_claim | unknown_fact`;
- record actions:
  - `remove_claim_from_report` for each removed claim;
  - `mark_dimension_gap` for each missing dimension finding;
  - `keep_with_warning` for high-severity section findings that cannot be fixed without evidence;
- output `repair_result`.

Implement `createApplyRepairAgent()`:

- read latest `claims`, `report`, and `repair_result`;
- remove planned unsafe claim ids from each section's `claimIds`;
- rewrite section body by removing lines that exactly equal removed claim statements;
- output a fresh repaired `report` artifact with `repair.appliedActionIds` and `repair.removedClaimIds`.

- [ ] **Step 4: Run repair-agent tests**

Run:

```bash
npm test --workspace @rivalscope/agents -- workflow-runner.test.ts -t "repair agent"
```

Expected: PASS.

## Task 2: Final Eval Node and DAG Integration

**Files:**
- Modify: `packages/agents/src/analysis-agents.ts`
- Modify: `apps/web/lib/run-analysis.ts`
- Modify: `apps/web/lib/run-analysis.test.ts`
- Test: `packages/agents/src/workflow-runner.test.ts`

- [ ] **Step 1: Write failing workflow tests**

Add tests proving the seven-node DAG emits a final `final_eval` artifact and keeps node order:

```text
extract -> analyze -> write -> critique -> repair -> apply_repair -> final_eval
```

Run:

```bash
npm test --workspace @rivalscope/agents -- workflow-runner.test.ts -t "repair loop"
npm test --workspace @rivalscope/web -- run-analysis.test.ts
```

Expected: FAIL until agents and nodes are registered.

- [ ] **Step 2: Implement final evaluator**

Implement `createFinalEvaluatorAgent()`:

- read latest `report`;
- read latest `review_findings`;
- read latest `repair_result`;
- if the latest report includes repair metadata, calculate `draftQualityScore`, `repairedQualityScore`, and `delta`;
- output `final_eval` with `status`, `draftQualityScore`, `repairedQualityScore`, `delta`, `actions`, and `unresolvedGaps`.

- [ ] **Step 3: Register agents and extend workflow nodes**

Update `createAnalysisWorkflowAgents()` to include `repair`, `apply_repair`, and `final_eval`.

Update `buildMvpWorkflowNodes()` in `apps/web/lib/run-analysis.ts` to return seven nodes.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm test --workspace @rivalscope/agents -- workflow-runner.test.ts
npm test --workspace @rivalscope/web -- run-analysis.test.ts
```

Expected: PASS.

## Task 3: Persisted UI Summary

**Files:**
- Modify: `packages/db/src/repositories.ts`
- Create: `apps/web/lib/project-repair-summary.ts`
- Create: `apps/web/lib/project-repair-summary.test.ts`
- Modify: `apps/web/app/projects/[projectId]/page.tsx`

- [ ] **Step 1: Write failing project summary tests**

Create `project-repair-summary.test.ts` with persisted artifact records shaped like Prisma `Artifact` rows. Assert the summary picks the latest `final_eval`, exposes score delta, actions, and unresolved gaps, and returns `not_started` when absent.

Run:

```bash
npm test --workspace @rivalscope/web -- project-repair-summary.test.ts
```

Expected: FAIL because helper does not exist.

- [ ] **Step 2: Include recent artifacts in project get**

Add `artifacts: { orderBy: { createdAt: "desc" }, take: 30 }` to `ProjectRepository.get()`.

- [ ] **Step 3: Implement repair summary helper**

Parse `final_eval` artifact values defensively. Return:

```ts
{ status: "not_started"; draftQualityScore: null; repairedQualityScore: null; delta: null; actions: []; unresolvedGaps: [] } |
{ status: "improved" | "unchanged"; draftQualityScore: number; repairedQualityScore: number; delta: number; actions: RepairActionSummary[]; unresolvedGaps: string[] }
```

- [ ] **Step 4: Surface UI**

Add:

- metric tile: `Repair Delta`;
- card: `Repair Loop`, showing draft score, repaired score, action count, and unresolved gaps.

- [ ] **Step 5: Run web tests**

Run:

```bash
npm test --workspace @rivalscope/web -- project-repair-summary.test.ts run-analysis.test.ts
```

Expected: PASS.

## Task 4: Docs and Full Verification

**Files:**
- Modify: `docs/top3-execution-harness.md`
- Modify: `docs/next-stage-plan.md`

- [ ] **Step 1: Update docs**

Record Phase 3 implementation, current limitations, and next optimization target:

- deterministic repair only;
- no semantic evidence support checking yet;
- next phase should add semantic entailment/evidence sufficiency eval and source-quality-weighted repair.

- [ ] **Step 2: Run full verification gate**

Run:

```bash
npm run typecheck
npm test
npm run eval:golden
DATABASE_URL="postgresql://postgres:postgres@localhost:15432/rivalscope?schema=public" npm run db:validate --workspace @rivalscope/db
npm run build --workspace @rivalscope/web
git diff --check
npm audit --audit-level=high
```

Expected: all commands exit 0. Audit may still report the known moderate Next/PostCSS advisory but must not fail at high severity.

- [ ] **Step 3: Commit and push**

Run:

```bash
git status --short
git add packages/agents/src/artifacts.ts packages/agents/src/workflow-schemas.ts packages/agents/src/analysis-agents.ts packages/agents/src/workflow-runner.test.ts apps/web/lib/run-analysis.ts apps/web/lib/run-analysis.test.ts packages/db/src/repositories.ts apps/web/lib/project-repair-summary.ts apps/web/lib/project-repair-summary.test.ts 'apps/web/app/projects/[projectId]/page.tsx' docs/top3-execution-harness.md docs/next-stage-plan.md docs/superpowers/plans/2026-05-14-eval-guided-repair-loop.md
git commit -m "feat: add eval guided repair loop"
git push -u origin codex/eval-guided-repair-loop
```

Expected: branch pushed to `git@github.com:CheungkiCheung/RivalScope.git`.

## Self-Review

- Spec coverage: covers repair actions, repaired output, final evaluation delta, UI visibility, docs, and verification.
- Placeholder scan: no `TBD` or unspecified implementation steps remain.
- Type consistency: artifact kinds are `repair_result` and `final_eval`; repaired reports carry `repair.appliedActionIds` so final evaluation can distinguish planned actions from applied actions.
