# Seeded Repair Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic demo scenario where RivalScope generates an intentionally over-strong draft claim, removes it through the repair loop, persists a positive Claim Trust delta, and exposes the result in the project UI.

**Architecture:** Keep the default workflow conservative. Add an optional `demoScenario: "repair_lift"` flag to `analysis_requirements`; when present, the deterministic analyst appends one unsupported-by-semantics but cited claim so existing Claim Trust repair removes it. Add tests that run the full in-memory workflow and prove the `claim_trust_snapshot` artifact has a removed weak claim and positive trust delta.

**Tech Stack:** TypeScript, Vitest, Next.js server actions, existing `@rivalscope/agents`, `@rivalscope/evals`, generic artifact persistence.

---

## File Structure

- Modify `packages/agents/src/analysis-agents.ts`: accept optional `demoScenario` in analysis requirements and inject one deterministic weak comparative claim for `repair_lift`.
- Modify `packages/agents/src/workflow-runner.test.ts`: add full workflow test proving seeded repair lift produces a removed claim and positive trust delta.
- Modify `apps/web/lib/run-analysis.ts`: preserve optional `demoScenario` when building analysis requirements from project metadata.
- Modify `apps/web/lib/run-analysis.test.ts`: assert demo projects carry the scenario flag.
- Modify `apps/web/app/projects/new/page.tsx`: add a project creation mode that writes a recognizable repair-lift demo description.
- Modify `docs/top3-execution-harness.md` and `docs/next-stage-plan.md`: mark seeded repair demo fixture as implemented and describe how it supports judge-visible evidence.

## Task 1: Agent-Level Seeded Repair Lift

**Files:**
- Modify: `packages/agents/src/analysis-agents.ts`
- Test: `packages/agents/src/workflow-runner.test.ts`

- [ ] **Step 1: Write failing full-workflow test**

Add a test that creates source chunks for Cursor/Codex/Trae, adds `analysis_requirements` with `demoScenario: "repair_lift"`, runs the complete DAG through `trust_snapshot`, and asserts:

- workflow succeeds;
- claims include `claim_demo_overstated_pricing`;
- `final_eval.delta` is positive;
- `claim_trust_snapshot.trustDelta` is positive;
- the demo claim has `status: "removed"` and includes `insufficient_semantic_support`.

Run:

```bash
npm test -- packages/agents/src/workflow-runner.test.ts -t "seeded repair lift"
```

Expected: FAIL because the analyst does not yet read `demoScenario`.

- [ ] **Step 2: Implement demo scenario injection**

In `createAnalystAgent`, read optional `demoScenario` from `analysis_requirements`. In deterministic mode only, append:

```ts
{
  id: "claim_demo_overstated_pricing",
  projectId: input.projectId,
  dimension: "pricing",
  statement: "Cursor guarantees the cheapest enterprise contract for every buyer.",
  factIds: [firstPricingFact.id],
  confidence: 0.9,
  kind: "comparative"
}
```

Only append when:

- `demoScenario === "repair_lift"`;
- a pricing fact exists;
- the claim id is not already present.

- [ ] **Step 3: Run targeted agent test**

Run:

```bash
npm test -- packages/agents/src/workflow-runner.test.ts -t "seeded repair lift"
```

Expected: PASS.

## Task 2: Project Creation Flag

**Files:**
- Modify: `apps/web/lib/run-analysis.ts`
- Modify: `apps/web/lib/run-analysis.test.ts`
- Modify: `apps/web/app/projects/new/page.tsx`

- [ ] **Step 1: Write failing requirements test**

Add a `buildAnalysisRequirements` test that passes a project description containing `[demo:repair_lift]` and expects:

```ts
{
  demoScenario: "repair_lift"
}
```

Run:

```bash
npm test -- apps/web/lib/run-analysis.test.ts
```

Expected: FAIL because the requirement builder does not infer the scenario.

- [ ] **Step 2: Implement scenario extraction**

Update `buildAnalysisRequirements` to accept optional `description?: string | null` and include `demoScenario: "repair_lift"` when the description contains `[demo:repair_lift]`.

- [ ] **Step 3: Add UI creation control**

Add a compact checkbox to the new project form:

```tsx
<input id="repairLiftDemo" name="repairLiftDemo" type="checkbox" defaultChecked />
```

When checked, append `[demo:repair_lift]` to the stored description if it is not already present.

- [ ] **Step 4: Run targeted web tests**

Run:

```bash
npm test -- apps/web/lib/run-analysis.test.ts
```

Expected: PASS.

## Task 3: Docs And Verification

**Files:**
- Modify: `docs/top3-execution-harness.md`
- Modify: `docs/next-stage-plan.md`

- [ ] **Step 1: Update docs**

Record that the seeded repair-lift fixture is implemented and that it proves a repeatable weak-claim removal plus before/after trust delta.

- [ ] **Step 2: Full verification**

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

Expected: all commands exit 0; known moderate Next/PostCSS advisory may remain.
