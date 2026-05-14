# Claim Trust Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist before/after Claim Trust deltas as first-class artifacts so repair improvements are inspectable, replayable, and demo-ready.

**Architecture:** Extend the DAG with a `trust_snapshot` node after `final_eval`. Add a `claim_trust_snapshot` artifact comparing the draft report before repair against the repaired report after `apply_repair`. Store per-claim trust scores, removed claims, remaining claims, and average trust delta. Surface this snapshot through the existing project repair summary and Repair Loop UI.

**Tech Stack:** TypeScript, Vitest, existing `@rivalscope/agents`, `@rivalscope/evals`, generic Prisma Artifact persistence, Next.js project page.

---

## File Structure

- Modify `packages/agents/src/artifacts.ts`: add `claim_trust_snapshot`.
- Modify `packages/agents/src/workflow-schemas.ts`: allow `claim_trust_snapshot`.
- Modify `packages/agents/src/analysis-agents.ts`: add `createClaimTrustSnapshotAgent()`.
- Modify `apps/web/lib/run-analysis.ts`: add `trust_snapshot` node after `final_eval`.
- Modify `packages/agents/src/workflow-runner.test.ts`: prove before/after trust snapshot captures removed weak claim and trust delta.
- Modify `apps/web/lib/project-repair-summary.ts`: parse latest `claim_trust_snapshot` alongside `final_eval`.
- Modify `apps/web/lib/project-repair-summary.test.ts`: assert summary exposes claim trust delta.
- Modify `apps/web/app/projects/[projectId]/page.tsx`: show claim trust delta in Repair Loop.
- Modify `docs/top3-execution-harness.md` and `docs/next-stage-plan.md`: mark snapshot milestone.

## Task 1: Trust Snapshot Artifact

**Files:**
- Modify: `packages/agents/src/artifacts.ts`
- Modify: `packages/agents/src/workflow-schemas.ts`
- Modify: `packages/agents/src/analysis-agents.ts`
- Test: `packages/agents/src/workflow-runner.test.ts`

- [ ] **Step 1: Write failing final-evaluator test**

Create a draft report with a supported claim and a weak unsupported/semantically weak claim. Create a repaired report where the weak claim is removed. Assert snapshot agent emits `claim_trust_snapshot` with:

- draft average trust lower than final average trust;
- removed claim listed;
- remaining claim listed;
- per-claim draft/final status.

Run:

```bash
npm test -- packages/agents/src/workflow-runner.test.ts -t "trust snapshot"
```

Expected: FAIL because the artifact kind and output are missing.

- [ ] **Step 2: Add artifact kind and schema enum**

Add `"claim_trust_snapshot"` to artifact kind and workflow schemas.

- [ ] **Step 3: Implement snapshot evaluation**

Add `createClaimTrustSnapshotAgent()` and register it as `trust_snapshot`.

The snapshot value should include:

```ts
{
  projectId: string;
  repairEvaluation: FinalEval;
  draftAverageTrust: number | null;
  finalAverageTrust: number | null;
  trustDelta: number | null;
  claims: Array<{
    claimId: string;
    dimension: string;
    statement: string;
    draftScore: number;
    finalScore: number | null;
    delta: number | null;
    status: "kept" | "removed";
    draftRiskLevel: string;
    finalRiskLevel: string | null;
    penalties: string[];
  }>;
}
```

Keep deterministic scoring using existing `evaluateClaimTrust`.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm test -- packages/agents/src/workflow-runner.test.ts -t "trust snapshot"
```

Expected: PASS.

## Task 2: Repair Summary UI

**Files:**
- Modify: `apps/web/lib/project-repair-summary.ts`
- Modify: `apps/web/lib/project-repair-summary.test.ts`
- Modify: `apps/web/app/projects/[projectId]/page.tsx`

- [ ] **Step 1: Write failing summary tests**

Update summary tests so the latest `claim_trust_snapshot` produces:

- `claimTrustDelta`;
- `draftAverageTrust`;
- `finalAverageTrust`;
- claim-level removed/kept rows.

- [ ] **Step 2: Parse snapshot**

Prefer latest `claim_trust_snapshot` and fall back to old `final_eval` artifacts for backward compatibility.

- [ ] **Step 3: Surface UI**

Add Repair Loop metrics:

- Trust Draft
- Trust Final
- Trust Delta

Show removed claim rows when present.

## Task 3: Docs And Verification

**Files:**
- Modify: `docs/top3-execution-harness.md`
- Modify: `docs/next-stage-plan.md`

- [ ] **Step 1: Update docs**

Record that before/after trust snapshots are now persistent artifacts. Remaining gap: seeded demo fixture with intentional weak claim and visible repair lift.

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

Expected: all commands exit 0; known moderate advisory may remain.
