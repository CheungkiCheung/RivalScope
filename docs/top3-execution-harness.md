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

## Current Top-3 Readiness Judgment

The current direction is worth continuing, but it is not enough to claim "guaranteed top 3."

The objective assessment is:

```text
Current readiness: about 7.6 / 10
Target readiness before final submission: 9.0+ / 10
```

The plan is strong because it already has explicit workflow control, typed artifacts, source attribution, critic review, evals, and observability. The main risk is not technical ambition. The main risk is that judges may perceive it as a polished AI report generator instead of an observable multi-agent intelligence system.

Therefore every milestone must make three judge-facing artifacts stronger:

1. **Agent Collaboration DAG**: specialized agents, handoffs, inputs, outputs, failures, and review loops are visible.
2. **Competitor Intelligence Schema**: agents share a domain-specific schema instead of passing generic prose.
3. **Claim Trust Graph with Repair Delta**: the system proves which claims are trustworthy, why, and how critique/repair improved them.

If a milestone does not improve at least one of these three artifacts, it is probably not top-3 work.

## External Pattern Baseline

RivalScope should borrow mature patterns from leading agent systems while keeping its own explicit control plane.

- OpenAI Agents SDK emphasizes agent handoffs, guardrails, and tracing of model calls, tool calls, handoffs, guardrails, and custom events.
- Anthropic's agent guidance emphasizes using simple, composable workflows before escalating to open-ended autonomy.
- LangGraph-style systems emphasize durable graph execution, checkpoints, and human-in-the-loop control.
- ByteDance DeerFlow demonstrates the competition-relevant shape of a long-horizon research harness: planning, specialized roles, tools, memory, subagents, and report generation.
- Langfuse-style observability shows that traces, datasets, experiments, and scores should be first-class system objects, not debug logs.

The resulting RivalScope principle:

```text
Use explicit typed workflows as the source of truth.
Expose agent collaboration and intelligence quality as product surfaces.
Avoid framework rewrites unless they improve visible quality, reliability, or evaluation.
```

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

## Judge-Facing Top-3 Proof

The final demo must make this story obvious within one minute:

```text
RivalScope is not a report generator.
It is an observable competitor-intelligence agent system where specialized agents
collect evidence, normalize it into a competitor schema, generate claims, challenge
each other, repair weak conclusions, and prove quality improvement with source-level
attribution.
```

The canonical demo should show:

```text
Input:
Analyze 3 competitors in one product category.

Agent flow:
Collector Agent -> Evidence Pack
Schema Agent -> Competitor Intelligence Profile
Analyst Agent -> Evidence-backed Claims
Writer Agent -> Draft Report
Quality Agent -> Targeted Findings
Repair Agent -> Revised Claims / Report
Final Evaluator -> IQS Delta

Visible proof:
Draft IQS: 60-70 range
Final IQS: 80+ range
At least 5 inspectable claim trust graphs
At least 1 repaired unsupported or weak claim
Every final claim traces to source chunks
```

Competition demo is ready only if:

1. A fresh judge understands the differentiator in under 60 seconds.
2. At least 3 competitors are analyzed through the schema.
3. At least 5 final claims have inspectable trust graphs.
4. At least 1 weak draft becomes stronger after critique and repair.
5. Every final claim has valid source attribution.
6. The DAG view shows at least 5 agent/node handoffs.
7. The README explains why this is an Agent collaboration system, not a report generator.
8. The product can show a before/after quality delta, not only a final report.

## Canonical Competitor Intelligence Schema

The competitor schema is the shared memory contract across agents. It should drive collection, extraction, analysis, coverage scoring, report structure, critic findings, and repair.

The canonical schema dimensions are:

```text
CompetitorIntelligenceProfile
  identity
  positioning
  product_capabilities
  pricing_and_packaging
  target_segments
  distribution_channels
  traction_signals
  technical_differentiators
  strategic_risks
  evidence_coverage
  claim_trust_summary
```

Each schema dimension should eventually carry:

- Competitor id and name.
- Dimension id.
- Normalized facts.
- Evidence source count.
- Source diversity.
- Source recency or freshness when available.
- Claim count.
- Average claim trust.
- Missing evidence gaps.
- Conflicting evidence risk.

Schema coverage is not a cosmetic report outline. It is the main way the system decides what evidence is missing and what the next agent should repair.

## Agent Collaboration Contract

The product must present specialized agents even when some implementations are deterministic or mock-backed.

| Agent | Input | Output | Quality Gate |
|---|---|---|---|
| Collector Agent | competitors, topic, research plan | sources, source chunks, tool calls | source coverage, fetch success, traceability |
| Schema Agent | source chunks, competitor list | normalized facts in the competitor schema | fact confidence, competitor allowlist, source chunk validity |
| Analyst Agent | facts, schema coverage | evidence-backed claims | claim trust, dimension coverage, fact references |
| Writer Agent | claims, schema profile | report sections | citation validity, claim references |
| Quality Agent | draft report, claim graph, eval summary | targeted findings | severity, target object, repair suggestion |
| Repair Agent | findings, draft artifacts, evidence gaps | repaired claims/report or explicit gaps | IQS delta, removed unsupported claims, unresolved risk list |
| Final Evaluator | final artifacts and trace | IQS and readiness summary | no unsupported final claims, demo gates |

Agent handoffs are product data. For each handoff the system should be able to show:

- Producing agent.
- Consuming agent.
- Artifact ids.
- Input/output schema.
- Quality gate result.
- Failure or retry state.

## Source Attribution Contract

Trust is only meaningful if attribution rules are explicit.

Final outputs must obey:

1. Every final claim cites at least one fact.
2. Every cited fact traces to at least one source chunk.
3. Every source chunk traces to a source URL or fixture source.
4. Duplicate chunks do not increase trust.
5. Unknown fact ids, claim ids, competitor ids, or source chunk ids cannot be silently accepted.
6. Claims with weak or missing evidence are downgraded, flagged, excluded, or routed to repair.
7. High-risk dimensions such as pricing, market share, legal claims, layoffs, and security claims require stricter trust gates.
8. Report export includes an evidence appendix.

This contract is testable and must be visible through Claim Trust Graph and Intelligence Trace.

## Intelligence Trace Surface

Observability is a product surface, not only debugging.

The project page should converge toward a single judge-facing surface called **Intelligence Trace**:

```text
Research Plan
-> Agent Collaboration DAG
-> Artifact Lineage
-> Competitor Schema Coverage
-> Claim Trust Graph
-> Quality Findings
-> Repair History
-> Final IQS
```

This surface is the answer to "why should anyone trust this analysis?"

## Non-Negotiable Principles

1. **Evaluation before optimization.** Every major improvement needs a metric, test, and UI surface.
2. **Evidence before prose.** Final reports are secondary to evidence-backed claims.
3. **Deterministic by default.** Offline fixture and mock modes must keep tests stable.
4. **Real providers opt in.** Search/model providers must be behind environment configuration.
5. **No hidden magic.** Agent decisions, artifacts, tool calls, model calls, evals, and repairs must be observable.
6. **No broad rewrites.** Do not replace the explicit DAG control plane with a framework unless there is a precise reason.
7. **No average feature work.** Features that do not improve trust, observability, repair, or demo strength should be deferred.
8. **Quality gates are mandatory.** Do not call work complete without fresh verification.
9. **Judge-visible before clever.** A sophisticated module that judges cannot see, inspect, or understand is not competition-ready.
10. **Schema before prose.** The competitor intelligence schema is the collaboration contract between agents.
11. **Repair must prove delta.** Critique is not enough; the system must show what changed and how IQS improved.

## Top 3 Differentiators

The project must converge on six visible differentiators.

### 1. Agent Collaboration DAG

The DAG must show the system is an Agent collaboration platform, not a single prompt pipeline:

```text
collect_by_competitor
-> schema_extract_by_competitor
-> analyze_by_dimension
-> write_draft
-> quality_review
-> repair_or_gap
-> final_eval
```

The first version can be thin and mapped onto current workflow nodes, but it must be visible early.

### 2. Competitor Intelligence Schema

All agents should converge on a domain schema rather than generic report text.

The schema should power:

- Research plan dimensions.
- Extraction targets.
- Coverage metrics.
- Claim dimensions.
- Report sections.
- Critic missing-dimension findings.
- Repair tasks.

### 3. Claim Trust Graph

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

### 4. Structured Critic Findings

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

### 5. Eval-Guided Repair Loop

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

### 6. Routed Research DAG

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

Do not reorder without a clear reason. However, each phase must expose a thin judge-visible trace of agent collaboration. Full routed execution can wait until Phase 4, but the visible Agent Collaboration DAG cannot wait until Phase 4.

### Phase 0.5: Harness Sharpening And Demo Contract

Goal: lock the competition narrative before new code.

Required deliverables:

- This harness includes current readiness, judge-facing proof, competitor schema, agent contract, and source attribution contract.
- `docs/next-stage-plan.md` reflects the same phase order.
- Phase 1 implementation plan exists before code changes.

Phase 0.5 completion gate:

- A future session can read this document and know what to build next without relying on conversation memory.

### Phase 1: Claim Trust Score + Claim Trust Graph + Thin Agent Trace

Goal: create the metric and UI base for all future optimization.

Status: implemented for deterministic scoring and first web surface.

Required deliverables:

- `evaluateClaimTrust` in `@rivalscope/evals`.
- Claim trust types and deterministic scoring.
- Tests for high-trust and low-trust claims.
- Web project summary builder for claim trust graph.
- Project-page Claim Trust Graph panel.
- Minimal Agent Collaboration Trace panel using current workflow/agent run data.
- Competitor schema dimension labels connected to trust summaries.
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
- The same page shows which agent created the claim path and which schema dimension it belongs to.

Current limitation: Claim Trust v1 is deterministic and structural. Semantic support checking, critic-impact penalties, persisted trust snapshots, and repair-loop deltas arrive in later phases.

### Phase 2: Structured Critic Targeting

Goal: make review findings actionable and machine-usable.

Status: implemented for targeted critic findings and Claim Trust penalty integration.

Required deliverables:

- Finding target fields in artifact schemas and persistence where needed.
- Critic emits targetable findings.
- UI links findings to claim/fact/section targets.
- Claim trust score consumes critic severity penalties.
- Findings distinguish unsupported claims, weak evidence, missing schema dimensions, conflicting evidence, and risky overconfidence.
- Tests for targeted findings and trust penalty impact.

Phase 2 completion gate:

- Clicking or inspecting a finding reveals the object being criticized.
- High-severity findings reduce trust score.

Current limitation: Phase 2 records repair suggestions but does not execute repair actions. Repair execution starts in Phase 3.

### Phase 3: Eval-Guided Repair Loop

Goal: prove multi-agent collaboration improves quality.

Status: implemented for deterministic repair execution and judge-visible repair delta.

Required deliverables:

- Done: add `repair_result` and `final_eval` artifacts.
- Done: add deterministic Repair Planner, Apply Repair, and Final Evaluator agents.
- Done: extend the workflow from `extract -> analyze -> write -> critique` to `extract -> analyze -> write -> critique -> repair -> apply_repair -> final_eval`.
- Done: repair high-severity targeted `unsupported_claim` / `unknown_fact` claim findings by removing unsafe claim references from the final report.
- Done: preserve missing dimensions as explicit unresolved gaps instead of inventing unsupported claims.
- Done: expose Repair Delta and Repair Loop actions on the project page.
- Done: persist repair/final-eval artifacts through the generic artifact store and load recent artifacts in `ProjectRepository.get()`.
- Partial: before/after IQS comparison exists for critic quality score delta; full Claim Trust before/after snapshots are still pending.

Phase 3 completion gate:

- Demo can show draft score, repair actions, and final score.
- Unsupported claims can be removed from the final report.
- Missing dimensions trigger explicit unresolved gaps.
- Targeted tests prove repair planning, application, final evaluation, and production DAG shape.

Current limitation: Phase 3 repair is deterministic and conservative. It removes unsafe claim references and records gaps, but does not yet perform semantic evidence sufficiency checks, source-authority weighting, LLM-backed evidence search, or persisted before/after Claim Trust snapshots. The next optimization should make repair target selection source-quality-aware and add a seeded demo case where one weak draft visibly improves while unresolved gaps remain honest.

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
P1: Semantic Evidence Support
P1: Source Authority
P2: Conflict Risk
P2: Report Utility
P2: Latency / Token Cost
```

Do not spend major implementation time on P2 before P0/P1 trust and repair metrics are visible in the product.

## Current Phase 3.5: Semantic Evidence And Source-Quality Repair

Status: implemented on top of the deterministic repair loop.

Purpose:

- Penalize structurally cited claims when the cited evidence does not lexically support the claim.
- Penalize claims that rely only on low-authority sources.
- Feed these trust penalties into Repair Planner so unsupported-but-cited claims can be removed instead of passing because references are syntactically valid.

Current deterministic formula additions:

- `semanticSupport`: overlap between meaningful claim tokens and cited fact/source-chunk tokens.
- `sourceAuthority`: explicit score based on source kind, HTTPS, official/docs/pricing/company URI signals, and local/manual-source penalties.

Current limitation: this is not full semantic entailment. It is an offline, explainable first gate for obvious hallucinated or over-strong claims. Later work should add LLM/NLI-style entailment checks behind eval fixtures and persist before/after Claim Trust snapshots.

## Current Phase 3.6: Claim Trust Snapshots

Status: implemented for generic artifact persistence and project-page repair summary.

Purpose:

- Persist before/after Claim Trust deltas as `claim_trust_snapshot` artifacts.
- Show draft average trust, final average trust, and trust delta in the Repair Loop.
- Record claim-level status: kept or removed.
- Preserve removed weak claims as audit evidence instead of only hiding them from the final report.

## Current Phase 3.7: Seeded Repair-Lift Demo

Status: implemented for deterministic workflow execution and new-project creation.

Purpose:

- Provide a stable judge/demo project path that intentionally includes one over-strong pricing claim.
- Prove the full loop repeatably: draft claim -> trust penalty -> repair action -> removed claim -> final eval delta -> persisted Claim Trust delta.
- Keep the demo explicit through `[demo:repair_lift]` in project description instead of depending on a model to accidentally produce a weak claim.
- Preserve default conservative behavior for non-demo projects.

Current limitation: the seeded demo proves the repair lift offline. Later work should add an LLM/NLI-backed entailment judge behind golden fixtures and compare deterministic lexical support against semantic adjudication.

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

The next implementation milestone is Phase 3:

```text
Eval-Guided Repair Loop
```

Start by adding a repair plan artifact and deterministic repair module that can remove or downgrade unsupported claims, then show draft IQS, repair actions, and final IQS.
