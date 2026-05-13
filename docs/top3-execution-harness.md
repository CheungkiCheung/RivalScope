# RivalScope Top 3 Execution Harness

## Purpose

This document is the stable execution harness for RivalScope. It exists to prevent the project from drifting back into a normal MVP after long sessions, context compression, or incremental feature pressure.

The target is not "a working AI report generator." The target is a ByteDance top-tier competition project and an autumn-recruiting AI Agent engineering portfolio project.

## Product Thesis

RivalScope is a trusted competitive intelligence Agent OS.

It should not merely generate a report. It should:

1. Collect and normalize competitive evidence.
2. Convert evidence into structured facts and claims.
3. Quantify how trustworthy each claim is.
4. Detect missing evidence, weak citations, and risky conclusions.
5. Use evaluation results to drive repair and re-analysis.
6. Show the full reasoning trajectory to a human reviewer.

The core loop is:

```text
Observe -> Evaluate -> Diagnose -> Repair -> Re-evaluate -> Finalize
```

Any work that does not strengthen this loop is secondary.

## North Star

The north-star metric is Intelligence Quality Score, or IQS.

First implementation should be simple and deterministic. It can become more sophisticated later, but it must always be:

- Explainable.
- Testable offline.
- Visible in the product.
- Able to drive workflow decisions.

Target score decomposition:

```text
IQS =
  25% Evidence Grounding
+ 20% Dimension Coverage
+ 15% Source Quality
+ 15% Conflict Handling
+ 15% Report Utility
+ 10% Workflow Reliability
```

Current implementation covers the first part of this system:

- Evidence coverage.
- Citation validity.
- Required-dimension coverage.
- Golden trajectory regression.
- Project-page trajectory eval summary.

Next work must extend this into claim-level trust.

## Non-Negotiable Principles

1. **Evaluation before optimization.** Every major improvement needs a metric, test, and UI surface.
2. **Evidence before prose.** Final reports are secondary to evidence-backed claims.
3. **Deterministic by default.** Offline fixture and mock modes must keep tests stable.
4. **Real providers opt in.** Search/model providers must be behind environment configuration.
5. **No hidden magic.** Agent decisions, artifacts, tool calls, model calls, evals, and repairs must be observable.
6. **No broad rewrites.** Do not replace the explicit DAG control plane with a framework unless there is a precise reason.
7. **No average feature work.** Features that do not improve trust, observability, repair, or demo strength should be deferred.
8. **Quality gates are mandatory.** Do not call work complete without fresh verification.

## Top 3 Differentiators

The project must converge on four visible differentiators.

### 1. Claim Trust Graph

Every important report claim should become an inspectable trust node:

```text
ReportSection
  -> Claim
    -> Facts
      -> SourceChunks
        -> Sources
```

Each claim node should show:

- Trust score.
- Risk level.
- Dimension.
- Evidence count.
- Source chunk count.
- Source diversity.
- Citation validity.
- Fact confidence.
- Critic impact.
- Trust reasons.

### 2. Structured Critic Findings

Critic output must become targetable product data, not only prose:

```text
finding.targetType = claim | fact | section | dimension | workflow
finding.targetId
finding.dimension
finding.category
finding.severity
finding.repairSuggestion
```

The UI should link findings to the exact object they criticize.

### 3. Eval-Guided Repair Loop

The system should show quality improvement, not just quality inspection:

```text
write_draft
-> evaluate_draft
-> critique_draft
-> repair_plan
-> repair_report
-> evaluate_final
```

The product should show:

```text
Draft IQS: 63
Critic findings: 6
Repair actions: 4
Final IQS: 88
```

### 4. Routed Research DAG

The workflow should become branch-aware:

```text
collect_sources
-> extract_by_competitor
-> analyze_by_dimension
-> synthesize_claims
-> write_report
-> adversarial_review
-> repair
-> final_eval
```

Branch status and branch-level evidence gaps should be visible.

## Phase Order

Do not reorder without a clear reason.

### Phase 1: Claim Trust Score + Claim Trust Graph

Goal: create the metric and UI base for all future optimization.

Required deliverables:

- `evaluateClaimTrust` in `@rivalscope/evals`.
- Claim trust types and deterministic scoring.
- Tests for high-trust and low-trust claims.
- Web project summary builder for claim trust graph.
- Project-page Claim Trust Graph panel.
- Documentation explaining the scoring formula.

First scoring formula:

```text
ClaimTrust =
  30% Citation Validity
+ 25% Evidence Strength
+ 20% Source Traceability
+ 15% Fact Confidence
+ 10% Source Diversity
- Penalties
```

Initial penalties:

- No cited facts.
- Unknown facts.
- Missing source chunks.
- Low fact confidence.
- Single-source evidence.
- High-severity critic finding, once structured findings exist.

Phase 1 completion gate:

- A reviewer can open a project page and inspect every claim's trust score and supporting facts/source chunks.
- Duplicate facts/chunks do not inflate trust.
- Trust scoring is covered by deterministic unit tests.

### Phase 2: Structured Critic Targeting

Goal: make review findings actionable and machine-usable.

Required deliverables:

- Finding target fields in artifact schemas and persistence where needed.
- Critic emits targetable findings.
- UI links findings to claim/fact/section targets.
- Claim trust score consumes critic severity penalties.
- Tests for targeted findings and trust penalty impact.

Phase 2 completion gate:

- Clicking or inspecting a finding reveals the object being criticized.
- High-severity findings reduce trust score.

### Phase 3: Eval-Guided Repair Loop

Goal: prove multi-agent collaboration improves quality.

Required deliverables:

- Repair plan artifact.
- Repair agent or deterministic repair module.
- Workflow nodes for draft eval, critique, repair, and final eval.
- Repair history UI.
- Score delta metrics.

Phase 3 completion gate:

- Demo can show draft score, repair actions, and final score.
- Unsupported claims can be removed or downgraded.
- Missing dimensions can trigger explicit repair tasks or gaps.

### Phase 4: Routed Research DAG

Goal: show real multi-agent workflow decomposition.

Required deliverables:

- Research plan artifact.
- Branch nodes by competitor and/or dimension.
- Branch-level statuses.
- Branch-level eval gaps.
- Synthesis node.

Phase 4 completion gate:

- A failed branch does not erase successful branches.
- UI can explain which competitor/dimension branch lacks evidence.

### Phase 5: Delivery And Demo Hardening

Goal: turn the system into a competition-ready product.

Required deliverables:

- Markdown and JSON report export.
- Evidence appendix.
- Stable seeded demo project.
- Deployment.
- Demo script.
- README competition narrative.

Phase 5 completion gate:

- A fresh judge can open the deployed demo and understand the differentiator in under one minute.

## Metric Priority

Optimize in this order:

```text
P0: Claim Trust Score
P0: Evidence Coverage
P0: Citation Validity
P0: Required Dimension Coverage
P1: Source Diversity
P1: Source Traceability
P1: Critic Finding Impact
P1: Eval Score Improvement After Repair
P2: Source Authority
P2: Conflict Risk
P2: Report Utility
P2: Latency / Token Cost
```

Do not spend major implementation time on P2 before P0 is visible in the product.

## Per-Module Work Rule

Every metric or module should ship with:

1. Formula or decision rule.
2. Unit tests.
3. UI representation.
4. Documentation.
5. Verification commands.

If one of these is missing, the module is not complete.

## Default Verification Gate

Before commit and push, run:

```bash
npm run typecheck
npm test
npm run eval:golden
DATABASE_URL="postgresql://postgres:postgres@localhost:15432/rivalscope?schema=public" npm run db:validate --workspace @rivalscope/db
npm run build --workspace @rivalscope/web
git diff --check
npm audit --audit-level=high
```

Known current audit note:

- `npm audit --audit-level=high` exits 0 but reports a moderate Next/PostCSS advisory.
- Do not run `npm audit fix --force` casually because it attempts a breaking downgrade to `next@9.3.3`.

For frontend-visible changes, also verify a local page:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:15432/rivalscope?schema=public" npm run dev --workspace @rivalscope/web -- --port 3100
curl -sS -o /tmp/rivalscope_project.html -w "%{http_code}\n" http://localhost:3100/projects/<projectId>
```

The expected status is `200`; grep for the new UI labels.

If the local database is missing newer tables, sync the development database:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:15432/rivalscope?schema=public" npm run db:push --workspace @rivalscope/db
```

Use this only for local development database sync.

## Branch And Commit Rule

Use a dedicated branch per coherent milestone:

```text
codex/<short-milestone-name>
```

Commit messages should use conventional style:

```text
feat: add claim trust scoring
test: cover claim trust edge cases
docs: add top three execution harness
```

Prefer small milestone branches that can be reviewed independently.

## Stop Conditions

Stop and ask for direction only when:

- A product-direction decision affects Top 3 positioning.
- A real external provider/API key is required.
- A schema migration risks destructive local or remote data changes.
- Verification repeatedly fails and the root cause is unclear.
- A new feature would violate the phase order in this harness.

Do not stop merely because a task is large. Break it into the next testable milestone.

## Deferred Until P0 Is Visible

These are not priorities until Claim Trust Graph is in the product:

- Multi-user permissions.
- Agent marketplace.
- Low-code DAG editor.
- Complex PDF design.
- Broad crawler platform.
- Homepage polish.
- Framework rewrite.
- Prompt template library.

## Next Immediate Milestone

The next implementation milestone is Phase 1:

```text
Claim Trust Score + Claim Trust Graph
```

Start with deterministic eval code and tests in `packages/evals`, then build the web summary and UI. Do not start repair loop or routed DAG until claim trust is visible and tested.
