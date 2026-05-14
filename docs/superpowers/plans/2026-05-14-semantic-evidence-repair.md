# Semantic Evidence Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic semantic evidence sufficiency and source-quality signals so Claim Trust and Repair Planning can distinguish structurally cited claims from genuinely supported claims.

**Architecture:** Keep the current explicit DAG and deterministic offline harness. Extend `evaluateClaimTrust` with source authority and lexical evidence-support metrics, surface those metrics in the project claim graph, and teach the Repair Planner to plan claim removal when a claim is structurally cited but semantically unsupported by its cited facts/source chunks.

**Tech Stack:** TypeScript, Vitest, existing `@rivalscope/evals`, `@rivalscope/agents`, and Next.js project summary helpers.

---

## File Structure

- Modify `packages/evals/src/claim-trust.ts`: add deterministic support/source-quality metrics and penalties.
- Modify `packages/evals/src/claim-trust.test.ts`: add RED/GREEN tests for unsupported cited claims and low-authority sources.
- Modify `apps/web/lib/project-claim-trust.ts`: expose new metrics/reasons automatically through existing trust node shape.
- Modify `apps/web/lib/project-claim-trust.test.ts`: assert UI summary carries semantic/source-quality metrics.
- Modify `packages/agents/src/analysis-agents.ts`: let Repair Planner compute claim trust and add `remove_claim_from_report` actions for high-risk semantic-support failures.
- Modify `packages/agents/src/workflow-runner.test.ts`: add repair planner tests for structurally cited but semantically unsupported claims.
- Modify `docs/top3-execution-harness.md` and `docs/next-stage-plan.md`: record this as the next Phase 3.5 quality hardening milestone.

## Task 1: Claim Trust Semantic And Source Quality Metrics

**Files:**
- Modify: `packages/evals/src/claim-trust.ts`
- Test: `packages/evals/src/claim-trust.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving:

- a claim with valid fact IDs but no meaningful token overlap with cited facts/chunks receives an `insufficient_semantic_support` penalty and high-risk score;
- a claim supported only by a low-authority source receives a `low_source_authority` penalty;
- a trusted official/source-like URL keeps high trust when semantic support is adequate.

Run:

```bash
npm test -- packages/evals/src/claim-trust.test.ts -t "semantic"
```

Expected: FAIL because metrics and penalties do not exist.

- [ ] **Step 2: Implement deterministic support scoring**

Add metrics:

```ts
semanticSupport: number;
sourceAuthority: number;
```

Use a transparent lexical heuristic:

- normalize lowercase tokens;
- remove short/common stop words;
- compare claim tokens against cited fact statements plus source chunk text;
- semantic support = matched claim tokens / claim tokens.

This is not LLM semantic entailment. It is a deterministic first gate for obviously unsupported generated claims.

- [ ] **Step 3: Implement source authority scoring**

Score source authority by kind and URI:

- `url` sources start higher than text/markdown/pdf fixtures;
- HTTPS official/documentation/pricing/docs/blog/company domains receive higher scores;
- local/demo/unknown sources remain usable but lower-authority.

Keep formula explicit and deterministic.

- [ ] **Step 4: Add penalties and scoring weight**

Add penalty codes:

- `insufficient_semantic_support`
- `low_source_authority`

Adjust weighted score to include semantic support and source authority without removing existing citation/traceability metrics.

- [ ] **Step 5: Run targeted tests**

Run:

```bash
npm test -- packages/evals/src/claim-trust.test.ts
```

Expected: PASS.

## Task 2: Repair Planner Uses Evidence-Aware Trust

**Files:**
- Modify: `packages/agents/src/analysis-agents.ts`
- Test: `packages/agents/src/workflow-runner.test.ts`

- [ ] **Step 1: Write failing repair planner test**

Create a claim that cites a valid fact/source chunk, but the claim says an unsupported stronger statement. Assert Repair Planner creates a `remove_claim_from_report` action with a reason that includes low semantic support.

Run:

```bash
npm test -- packages/agents/src/workflow-runner.test.ts -t "semantic support"
```

Expected: FAIL because Repair Planner does not inspect claim trust.

- [ ] **Step 2: Add optional trust-based repair actions**

In `createRepairPlannerAgent()`:

- read latest `claims`, `facts`, `source_chunks`, and optional `sources` if available;
- compute `evaluateClaimTrust` for each claim;
- when trust has `insufficient_semantic_support` or `low_source_authority` and score is high-risk, add `remove_claim_from_report` action unless one already exists for that claim;
- keep missing dimensions as unresolved gaps.

Do not invent claims or facts.

- [ ] **Step 3: Run repair tests**

Run:

```bash
npm test -- packages/agents/src/workflow-runner.test.ts -t "repair agent"
npm test -- packages/agents/src/workflow-runner.test.ts -t "semantic support"
```

Expected: PASS.

## Task 3: UI Summary And Docs

**Files:**
- Modify: `apps/web/lib/project-claim-trust.test.ts`
- Modify: `docs/top3-execution-harness.md`
- Modify: `docs/next-stage-plan.md`

- [ ] **Step 1: Add summary test assertions**

Assert trust nodes expose `metrics.semanticSupport`, `metrics.sourceAuthority`, and relevant penalty codes.

- [ ] **Step 2: Update docs**

Record current limitations:

- lexical support is not full entailment;
- no LLM judge by default;
- next step after this should persist before/after trust snapshots and add seeded demo fixture.

- [ ] **Step 3: Run full verification gate**

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

Expected: all commands exit 0. The known moderate Next/PostCSS advisory may still print but must not fail high-severity audit.
