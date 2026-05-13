# Structured Critic Targeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Critic findings from prose-only comments into targetable quality data that points to exact claims, facts, sections, dimensions, or workflow gaps, then make Claim Trust consume targeted high-severity findings.

**Architecture:** Extend the existing `ReviewFinding` artifact shape first, then persist the target fields in Prisma so the web UI can display them. Keep repair execution out of this phase; only record `repairSuggestion` as data. Add optional critic penalties to `evaluateClaimTrust` without changing the Phase 1 default behavior.

**Tech Stack:** TypeScript, Vitest, Prisma, Next.js server components, existing `@rivalscope/agents`, `@rivalscope/evals`, `@rivalscope/db`, and `@rivalscope/web`.

---

## Files

- Modify: `packages/agents/src/analysis-agents.ts`
- Modify: `packages/agents/src/workflow-runner.test.ts`
- Modify: `packages/evals/src/claim-trust.ts`
- Modify: `packages/evals/src/claim-trust.test.ts`
- Modify: `apps/web/lib/project-claim-trust.ts`
- Modify: `apps/web/lib/project-claim-trust.test.ts`
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `packages/db/src/repositories.ts`
- Modify: `apps/web/lib/analysis-persistence.ts`
- Modify: `apps/web/lib/analysis-persistence.test.ts`
- Modify: `apps/web/app/projects/[projectId]/page.tsx`
- Modify: `docs/top3-execution-harness.md`
- Modify: `docs/next-stage-plan.md`

## Target Field Contract

Use this artifact-level shape:

```ts
export type ReviewFindingTargetType =
  | "claim"
  | "fact"
  | "section"
  | "dimension"
  | "workflow";

export interface ReviewFinding {
  id: string;
  severity: "low" | "medium" | "high";
  category:
    | "unsupported_claim"
    | "unknown_fact"
    | "low_confidence"
    | "uncited_report_section"
    | "unknown_claim"
    | "missing_dimension";
  message: string;
  targetType: ReviewFindingTargetType;
  targetId: string;
  dimension?: string;
  repairSuggestion: string;
}
```

Database persistence should store the same target metadata:

```prisma
targetType       String?
targetId         String?
targetDimension  String?
repairSuggestion String?
```

Use nullable columns so existing local data remains compatible.

## Task 1: Make Critic Agent Emit Targeted Findings

**Files:**
- Modify: `packages/agents/src/analysis-agents.ts`
- Modify: `packages/agents/src/workflow-runner.test.ts`

- [ ] **Step 1: Write failing test expectations**

In `packages/agents/src/workflow-runner.test.ts`, inside the existing critic test, replace the string-only checks with targeted assertions:

```ts
    const review = output.value as {
      status: string;
      qualityScore: number;
      findings: Array<{
        severity: string;
        category: string;
        message: string;
        targetType: string;
        targetId: string;
        dimension?: string;
        repairSuggestion: string;
      }>;
    };

    expect(review.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "unsupported_claim",
          targetType: "claim",
          targetId: "claim_no_facts",
          dimension: "pricing",
          repairSuggestion:
            "Remove the claim or attach at least one valid supporting fact before publication."
        }),
        expect.objectContaining({
          category: "unknown_fact",
          targetType: "claim",
          targetId: "claim_unknown_fact",
          dimension: "positioning",
          repairSuggestion:
            "Replace unknown fact references with persisted facts or rerun extraction for this claim."
        }),
        expect.objectContaining({
          category: "low_confidence",
          targetType: "claim",
          targetId: "claim_low_confidence",
          dimension: "pricing",
          repairSuggestion:
            "Downgrade the claim wording or collect stronger evidence before keeping it in the report."
        }),
        expect.objectContaining({
          category: "uncited_report_section",
          targetType: "section",
          targetId: "section_summary",
          repairSuggestion:
            "Attach at least one evidence-backed claim to this section or remove the section."
        }),
        expect.objectContaining({
          category: "missing_dimension",
          targetType: "dimension",
          targetId: "developer_experience",
          dimension: "developer_experience",
          repairSuggestion:
            "Collect or synthesize evidence-backed claims for the missing required dimension."
        })
      ])
    );
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- packages/agents/src/workflow-runner.test.ts
```

Expected: fail because critic findings do not have target fields yet.

- [ ] **Step 3: Implement targeted critic output**

In `packages/agents/src/analysis-agents.ts`, update `ReviewFinding` and every `findings.push` inside `createCriticAgent` to include `targetType`, `targetId`, optional `dimension`, and `repairSuggestion`.

Target mapping:

- Unsupported claim: `targetType: "claim"`, `targetId: claim.id`, `dimension: claim.dimension`
- Unknown fact: `targetType: "claim"`, `targetId: claim.id`, `dimension: claim.dimension`
- Low confidence: `targetType: "claim"`, `targetId: claim.id`, `dimension: claim.dimension`
- Uncited report section: `targetType: "section"`, `targetId: section.id`
- Unknown claim in section: `targetType: "section"`, `targetId: section.id`
- Missing dimension: `targetType: "dimension"`, `targetId: dimension`, `dimension`

- [ ] **Step 4: Run focused test**

Run:

```bash
npm test -- packages/agents/src/workflow-runner.test.ts
```

Expected: pass.

## Task 2: Add Critic Penalty Support To Claim Trust

**Files:**
- Modify: `packages/evals/src/claim-trust.ts`
- Modify: `packages/evals/src/claim-trust.test.ts`

- [ ] **Step 1: Write failing test for targeted high-severity penalty**

Add this test to `packages/evals/src/claim-trust.test.ts`:

```ts
  it("applies targeted high-severity critic penalties to the matching claim", () => {
    const clean = evaluateClaimTrust({
      claim: {
        id: "claim_1",
        projectId: "project_1",
        dimension: "product_capabilities",
        statement: "Cursor combines paid plans with agentic coding workflows.",
        factIds: ["fact_1", "fact_2"],
        confidence: 0.86,
        kind: "single_competitor"
      },
      facts,
      chunks,
      sources
    });
    const penalized = evaluateClaimTrust({
      claim: {
        id: "claim_1",
        projectId: "project_1",
        dimension: "product_capabilities",
        statement: "Cursor combines paid plans with agentic coding workflows.",
        factIds: ["fact_1", "fact_2"],
        confidence: 0.86,
        kind: "single_competitor"
      },
      facts,
      chunks,
      sources,
      criticFindings: [
        {
          severity: "high",
          targetType: "claim",
          targetId: "claim_1",
          message: "Quality Agent flagged this claim."
        }
      ]
    });

    expect(penalized.score).toBe(clean.score - 15);
    expect(penalized.penalties).toContainEqual({
      code: "high_severity_critic_finding",
      points: 15,
      message: "Quality Agent flagged this claim."
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- packages/evals/src/claim-trust.test.ts
```

Expected: fail because `criticFindings` and `high_severity_critic_finding` do not exist.

- [ ] **Step 3: Implement optional critic penalty**

Update `ClaimTrustPenaltyCode`:

```ts
  | "high_severity_critic_finding";
```

Add input type:

```ts
export interface ClaimTrustCriticFinding {
  severity: "low" | "medium" | "high";
  targetType: "claim" | "fact" | "section" | "dimension" | "workflow";
  targetId: string;
  message: string;
}
```

Add optional `criticFindings?: ClaimTrustCriticFinding[]` to `EvaluateClaimTrustInput`.

In `buildPenalties`, add a `criticFindings` parameter and append one 15-point penalty for each high-severity finding where `targetType === "claim"` and `targetId === claim.id`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- packages/evals/src/claim-trust.test.ts
```

Expected: pass.

## Task 3: Persist Targeted Finding Fields

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `packages/db/src/repositories.ts`
- Modify: `apps/web/lib/analysis-persistence.ts`
- Modify: `apps/web/lib/analysis-persistence.test.ts`

- [ ] **Step 1: Write failing persistence test expectations**

In `apps/web/lib/analysis-persistence.test.ts`, update the successful persistence fixture for `review_findings` so at least one finding includes:

```ts
targetType: "claim",
targetId: "claim_temp_1",
dimension: "pricing",
repairSuggestion: "Attach stronger evidence before publishing."
```

Then assert `createReviewFindings` receives:

```ts
expect.objectContaining({
  targetType: "claim",
  targetId: "claim_temp_1",
  targetDimension: "pricing",
  repairSuggestion: "Attach stronger evidence before publishing."
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- apps/web/lib/analysis-persistence.test.ts
```

Expected: fail because persistence drops target fields.

- [ ] **Step 3: Update Prisma schema and repository types**

In `packages/db/prisma/schema.prisma`, add nullable fields to `ReviewFinding`:

```prisma
  targetType       String?
  targetId         String?
  targetDimension  String?
  repairSuggestion String?
```

In `packages/db/src/repositories.ts`, extend `CreateReviewFindingInput` with optional matching fields. `createMany` can pass them through directly.

- [ ] **Step 4: Update analysis persistence mapping**

In `apps/web/lib/analysis-persistence.ts`, extend the findings artifact type and map:

```ts
targetType?: string;
targetId?: string;
dimension?: string;
repairSuggestion?: string;
```

to:

```ts
targetType: finding.targetType,
targetId: finding.targetId,
targetDimension: finding.dimension,
repairSuggestion: finding.repairSuggestion
```

only when defined.

- [ ] **Step 5: Run focused tests and Prisma validation**

Run:

```bash
npm test -- apps/web/lib/analysis-persistence.test.ts
DATABASE_URL="postgresql://postgres:postgres@localhost:15432/rivalscope?schema=public" npm run db:validate --workspace @rivalscope/db
```

Expected: pass.

## Task 4: Show Targeted Findings In UI And Feed Claim Trust

**Files:**
- Modify: `apps/web/lib/project-claim-trust.ts`
- Modify: `apps/web/lib/project-claim-trust.test.ts`
- Modify: `apps/web/app/projects/[projectId]/page.tsx`

- [ ] **Step 1: Write failing project claim trust test**

Extend `ProjectClaimTrustReportSection` test data with `reviewFindings` input at the summary level:

```ts
reviewFindings: [
  {
    severity: "HIGH",
    targetType: "claim",
    targetId: "claim_1",
    message: "Quality Agent found a severe issue."
  }
]
```

Assert the summary score is reduced by 15 and node penalties include `high_severity_critic_finding`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- apps/web/lib/project-claim-trust.test.ts
```

Expected: fail because `reviewFindings` is not an accepted input.

- [ ] **Step 3: Implement review finding adapter**

Add optional `reviewFindings` input to `BuildProjectClaimTrustSummaryInput`. Map DB enum severity to lowercase and pass matching claim-target findings into `evaluateClaimTrust`.

- [ ] **Step 4: Display target data in Critic Findings panel**

In `apps/web/app/projects/[projectId]/page.tsx`, when rendering `latestFindings`, add target and repair suggestion lines:

```tsx
{finding.targetType && finding.targetId ? (
  <span className="muted">
    target {finding.targetType}:{finding.targetId}
  </span>
) : null}
{finding.repairSuggestion ? (
  <p className="muted">{finding.repairSuggestion}</p>
) : null}
```

Also pass `reviewFindings: latestFindings` into `buildProjectClaimTrustSummary`.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
npm test -- apps/web/lib/project-claim-trust.test.ts
npm run typecheck
```

Expected: pass.

## Task 5: Documentation And Full Verification

**Files:**
- Modify: `docs/top3-execution-harness.md`
- Modify: `docs/next-stage-plan.md`

- [ ] **Step 1: Update Phase 2 status**

Set Phase 2 / Updated Stage 2 status to:

```text
Status: implemented for targeted critic findings and Claim Trust penalty integration.
```

Add limitation:

```text
Current limitation: Phase 2 records repair suggestions but does not execute repair actions. Repair execution starts in Phase 3.
```

- [ ] **Step 2: Run full verification**

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

Expected:

- Typecheck passes.
- Tests pass.
- Golden eval passes.
- Prisma validation passes.
- Web build passes.
- Diff check passes.
- Audit exits 0 with the known moderate Next/PostCSS advisory only.

## Self-Review Checklist

- [ ] Critic findings all include target metadata.
- [ ] Target metadata persists to `ReviewFinding`.
- [ ] UI surfaces target metadata and repair suggestions.
- [ ] Claim Trust consumes matching high-severity claim findings.
- [ ] No repair action execution is introduced in Phase 2.
- [ ] Existing deterministic offline path remains default.
- [ ] Docs move next milestone to Eval-Guided Repair Loop only after implementation passes.
