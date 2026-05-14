# Entailment Eval Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone entailment evaluation harness so RivalScope can measure whether cited evidence actually supports a competitive-intelligence claim.

**Architecture:** Create a deterministic offline entailment evaluator in `@rivalscope/evals` with an interface shaped like a future LLM/NLI judge. Keep Claim Trust compatible by continuing to use deterministic scoring, but expose label-level outcomes (`entailed`, `partial`, `unsupported`, `contradicted`) and benchmark summaries so semantic support becomes independently measurable.

**Tech Stack:** TypeScript, Vitest, existing `@rivalscope/core` claim/fact/source-chunk schema, existing eval package exports.

---

## File Structure

- Create `packages/evals/src/entailment.ts`: deterministic entailment evaluator and benchmark runner.
- Create `packages/evals/src/entailment.test.ts`: unit tests for entailment labels and benchmark metrics.
- Modify `packages/evals/src/index.ts`: export entailment APIs.
- Modify `packages/evals/src/claim-trust.ts`: use the entailment evaluator for the existing `semanticSupport` metric while preserving current penalty behavior.
- Modify `packages/evals/src/claim-trust.test.ts`: assert over-strong claims expose unsupported entailment reasons.
- Modify `docs/top3-execution-harness.md` and `docs/next-stage-plan.md`: mark Phase 4 harness as underway/implemented and explain the next LLM/NLI step.

## Task 1: Standalone Entailment Evaluator

**Files:**
- Create: `packages/evals/src/entailment.ts`
- Create: `packages/evals/src/entailment.test.ts`
- Modify: `packages/evals/src/index.ts`

- [ ] **Step 1: Write failing tests**

Add tests that assert:

- a directly supported pricing claim is `entailed`;
- an over-strong cheapest/guarantee claim is `unsupported`;
- a cancellation/refund contradiction is `contradicted`;
- benchmark metrics count labels and compute accuracy against expected labels.

Run:

```bash
npm test -- packages/evals/src/entailment.test.ts
```

Expected: FAIL because `./entailment` does not exist.

- [ ] **Step 2: Implement deterministic evaluator**

Implement:

```ts
export type EntailmentLabel = "entailed" | "partial" | "unsupported" | "contradicted";

export function evaluateClaimEntailment(input: {
  claim: Claim;
  facts: Fact[];
  chunks: SourceChunk[];
}): ClaimEntailmentResult
```

Use token overlap for support and explicit lexical contradiction pairs for `refund`/`no refund`, `free`/`paid`, `supports`/`does not support`.

- [ ] **Step 3: Implement benchmark runner**

Implement:

```ts
export function runEntailmentBenchmark(cases: EntailmentBenchmarkCase[]): EntailmentBenchmarkSummary
```

Return total, passed, failed, accuracy, and per-label counts.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm test -- packages/evals/src/entailment.test.ts
```

Expected: PASS.

## Task 2: Claim Trust Integration

**Files:**
- Modify: `packages/evals/src/claim-trust.ts`
- Modify: `packages/evals/src/claim-trust.test.ts`

- [ ] **Step 1: Write failing Claim Trust assertion**

Extend the over-strong semantic-gap test so `result.reasons` contains an entailment label line such as:

```text
Entailment label is unsupported.
```

Run:

```bash
npm test -- packages/evals/src/claim-trust.test.ts -t "semantically support"
```

Expected: FAIL because Claim Trust does not yet expose entailment labels.

- [ ] **Step 2: Use evaluator inside Claim Trust**

Replace the internal semantic-support implementation with `evaluateClaimEntailment`.

Preserve:

- `metrics.semanticSupport` remains a number from 0 to 1;
- existing `insufficient_semantic_support` penalty code remains unchanged;
- existing scores stay broadly compatible.

- [ ] **Step 3: Run targeted Claim Trust tests**

Run:

```bash
npm test -- packages/evals/src/claim-trust.test.ts
```

Expected: PASS.

## Task 3: Docs And Verification

**Files:**
- Modify: `docs/top3-execution-harness.md`
- Modify: `docs/next-stage-plan.md`

- [ ] **Step 1: Update docs**

Record that semantic support now has a standalone entailment harness, benchmark metrics, and a clean path to LLM/NLI replacement.

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
