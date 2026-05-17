# RivalScope DAG Agent Orchestration Design

## Purpose

This document freezes the multi-agent orchestration plan for RivalScope.

The design name is:

```text
Typed DAG Orchestration with Shared Evidence State
```

Chinese positioning:

```text
基于共享证据状态的类型化 DAG Agent 编排
```

RivalScope should not be a linear prompt chain or an uncontrolled agent chat room. It should be a deterministic research workflow where specialized agents run as typed DAG nodes, exchange structured artifacts, and write every important output into the shared evidence state.

## North Star

The orchestration layer answers:

```text
Who does what, in what order, with which inputs, producing which artifacts,
under which quality gates, and with what retry/feedback behavior?
```

The system should combine:

```text
Explicit DAG control plane
+ specialized agent nodes
+ structured artifact contracts
+ shared evidence/provenance state
+ parallel research branches
+ generator-verifier review loops
+ confidence gates
+ Trace Validator publication gates
+ observable AgentRun and ToolCall records
```

## External Pattern Decisions

### Anthropic Multi-Agent Coordination Patterns

Use Anthropic's coordination patterns as design language:

| Pattern | RivalScope use |
| --- | --- |
| Generator-verifier | Analyst generates claims; FactCheck, Skeptic, and Critic agents verify, challenge, and revise them. |
| Orchestrator-subagent | Workflow Orchestrator owns the goal and DAG; specialized agents execute bounded nodes. |
| Agent teams | Use only for clearly independent parallel work such as per-competitor research or per-dimension analysis. |
| Message bus | Not a P0 control plane; use lightweight events only for quality-triggered follow-up tasks. |
| Shared-state | Core pattern. Agents collaborate through Evidence Graph, Artifact Store, Claim Registry, and Review Finding Store. |

Design rule:

```text
Use the simplest coordination pattern that fits each part of the task.
```

Do not add more agent autonomy where a typed workflow node is enough.

### Claudecode-Inspired Task Lifecycle

The `CheungkiCheung/claudecode` design is most useful as task infrastructure inspiration, not as a direct architecture to copy.

Borrow these ideas:

- Agents and tools run as explicit tasks.
- Tasks have ids, types, statuses, output files/offsets, terminal-state checks, and kill/cancel behavior.
- Tools are filtered by permission context.
- Agent/subagent work has budgets, abort controllers, and observable outputs.
- Background/teammate work is tracked separately from the main conversation.

RivalScope mapping:

```text
claudecode Task        -> RivalScope WorkflowNodeRun / AgentTask
claudecode Tool        -> RivalScope Tool<I, O>
claudecode task output -> RivalScope Artifact + AgentRun + ToolCall records
permission context     -> per-agent tool capability policy
budget/max turns       -> node budget, workflow budget, and loop guard
```

### Google ADK

Borrow the distinction between:

- Sequential workflows.
- Parallel workflows.
- Loop workflows.
- Shared session/state.

RivalScope DAG should contain all three execution semantics:

```text
Sequential:
  plan -> collect -> snapshot -> extract

Parallel:
  per-competitor collection
  per-source fetching
  per-dimension analysis

Loop:
  generate -> verify -> revise
  low-confidence claim -> collect_more -> re-score
```

### Microsoft Agent Framework

Borrow orchestration vocabulary:

- Sequential.
- Concurrent.
- Handoff.
- Human-in-the-loop approval.

RivalScope should not use group chat as the main architecture. Human review belongs at high-risk gates:

- Low-confidence high-impact claims.
- Contradicted strategic claims.
- Recommendations with major product or business implications.

### LangGraph

Borrow graph-state thinking:

- Central workflow state.
- Nodes update well-defined state slices.
- Checkpoints and resumability.
- Interrupts for human approval.
- Retry policies.

RivalScope does not need to migrate to LangGraph for the competition MVP. The current runner can evolve toward the same properties.

### OpenAI Agents SDK And Coze Loop

Use the product-layer categories:

- Agent definitions.
- Running agents.
- Orchestration.
- Guardrails.
- Results and state.
- Observability.
- Workflow evaluations.

Coze Loop's AgentOps framing is especially relevant to the ByteDance competition: traces, model calls, tool calls, intermediate results, evals, and monitoring should be product surfaces, not hidden logs.

## Non-Goals

Do not build these for the next stage:

- A free-form autonomous planner that invents arbitrary workflows.
- A group-chat agent room where agents negotiate the whole process.
- A universal agent marketplace.
- A full framework migration before the current runner is proven insufficient.
- Infinite research loops without budget, iteration, and quality guards.

## Hybrid Architecture

The final architecture should be:

```text
Deterministic main DAG
+ parallel competitor/source branches
+ dimension-level synthesis branches
+ generator-verifier quality gates
+ targeted research sub-DAGs for weak claims
+ shared evidence state
+ trace and confidence publication gates
```

High-level flow:

```text
plan_research
  -> collect_sources_by_competitor
  -> snapshot_sources
  -> extract_evidence_spans
  -> generate_atomic_facts
  -> synthesize_candidate_claims_by_dimension
  -> fact_check_claims
  -> skeptic_review
  -> source_quality_review
  -> score_confidence
  -> approve_or_route_claims
  -> write_report
  -> trace_validate
  -> publish_or_request_revision
```

The main path is not linear. It is a DAG with fan-out, fan-in, and conditional feedback.

## DAG Topology

Example for three competitors and four analysis dimensions:

```text
                         plan_research
                               |
        ------------------------------------------------
        |                       |                      |
 collect_notion_sources  collect_yuque_sources  collect_confluence_sources
        |                       |                      |
 snapshot_notion_sources snapshot_yuque_sources snapshot_confluence_sources
        |                       |                      |
 extract_notion_facts    extract_yuque_facts    extract_confluence_facts
        |                       |                      |
        ---------------- shared evidence state ---------
                               |
        ------------------------------------------------
        |                       |                      |
 analyze_ai_capability   analyze_pricing       analyze_enterprise_readiness
        |                       |                      |
        ---------------- candidate claims --------------
                               |
        ------------------------------------------------
        |                       |                      |
 fact_check_claims       skeptic_review        source_quality_review
        |                       |                      |
        ---------------- confidence_gate ---------------
                         |                 |
                 approved_claims    needs_more_evidence
                         |                 |
                   write_report     targeted_research_subdag
                         |                 |
                   trace_validate <---------
                         |
                publish_or_request_revision
```

## Agent Roles

### Workflow Orchestrator

Owns the DAG run. It schedules nodes, checks readiness, handles retries, records state transitions, and routes feedback actions.

It should not generate business analysis directly.

### Research Planner Agent

Input:

- Project goal.
- Competitors.
- Required dimensions.
- Existing sources.

Output:

- `ResearchPlan`.
- Source targets by competitor and dimension.
- Quality gates and expected artifacts.

### Collector Agent

Input:

- `ResearchPlan`.
- Competitor.
- Source category.

Output:

- `Source` candidates.
- Tool calls for search and fetch.
- Collection warnings.

### Snapshot Tool / Snapshot Agent

Input:

- `Source`.

Output:

- Immutable `SourceSnapshot`.
- Content hash.
- Cleaned text.
- Optional screenshot.
- Parser metadata.

### Extract Agent

Input:

- `SourceSnapshot`.
- Analysis dimensions.

Output:

- `EvidenceSpan[]`.
- Extraction warnings.
- Extraction confidence.

### Fact Agent

Input:

- `EvidenceSpan[]`.

Output:

- `AtomicFact[]`.
- `EvidenceSpan -> AtomicFact` lineage edges.

### Analyst Agent

Input:

- `AtomicFact[]`.
- Competitor and dimension context.

Output:

- Candidate `Claim[]`.
- `AtomicFact -> Claim` lineage edges.

### FactCheck Agent

Input:

- Candidate claims.
- Cited facts and evidence spans.

Output:

- `VerificationResult[]`.
- Supported/refuted/not-enough-info verdicts.

### Skeptic Agent

Input:

- Candidate claims.
- Source plan.
- Existing evidence graph.

Output:

- Counter-evidence.
- Caveats.
- Alternative explanations.
- `refutes` and `qualifies` edges.

### Source Quality Agent

Input:

- Sources, snapshots, evidence spans.

Output:

- Source reliability and freshness assessments.
- Source independence clusters.

### Confidence Scorer

Input:

- Claims.
- Verification results.
- Source quality results.
- Counter-evidence.

Output:

- Claim confidence.
- Publication status.
- Route action: publish, publish_with_caveat, revise, collect_more, hypothesis_only, reject.

### Writer Agent

Input:

- Approved claims.
- Insights.
- Recommendations.
- Report outline.

Output:

- `ReportBlock[]`.
- `Claim -> ReportBlock` lineage edges.

### Critic Agent

Input:

- Report blocks.
- Claims.
- Provenance graph.
- Confidence results.

Output:

- Review findings.
- Required revisions.
- Missing dimensions.
- Overclaiming flags.

### Trace Validator

Input:

- Report blocks.
- Lineage graph.
- Confidence states.

Output:

- `complete_trace`, `partial_trace`, `weak_trace`, `broken_trace`, or `contradicted_trace`.
- Publication decision.

## Artifact Contracts

Agents exchange structured artifacts only. No node should depend on another agent's free-form prose.

Core artifacts:

```text
ResearchPlan
Source
SourceSnapshot
EvidenceSpan
AtomicFact
CandidateClaim
VerificationResult
CounterEvidence
SourceQualityAssessment
ConfidenceScore
Insight
Recommendation
ReportBlock
ReviewFinding
TraceValidationResult
RevisionDiff
```

Every artifact should include:

- id
- project id
- workflow run id
- producing node id
- producing agent run id
- created at
- schema version
- lineage edges or cited artifact ids

## Node State Machine

Recommended node states:

```text
pending
ready
running
succeeded
failed
blocked
cancelled
needs_revision
needs_more_evidence
skipped
```

Terminal states:

```text
succeeded
failed
blocked
cancelled
skipped
```

`needs_revision` and `needs_more_evidence` are not terminal. They create follow-up nodes or route back into existing nodes.

## Node Definition

```ts
interface WorkflowNodeDefinition {
  id: string;
  type: WorkflowNodeType;
  agentRole: AgentRole;
  dependsOn: string[];
  inputArtifactTypes: ArtifactType[];
  outputArtifactTypes: ArtifactType[];
  retryPolicy: RetryPolicy;
  timeoutMs: number;
  budget: NodeBudget;
  toolPolicy: ToolPolicy;
  blockingPolicy: BlockingPolicy;
}
```

## Agent Contract

```ts
interface Agent<I, O> {
  name: string;
  role: AgentRole;
  inputSchema: ZodSchema<I>;
  outputSchema: ZodSchema<O>;
  run(input: I, context: AgentContext): Promise<O>;
}
```

`AgentContext` should include:

- workflow run id
- node run id
- artifact store
- provenance graph writer
- tool registry
- tool policy
- model client
- abort signal
- budget tracker
- telemetry sink

## Tool Policy

Agents should not all have access to every tool.

Examples:

| Agent | Allowed tools |
| --- | --- |
| Research Planner | read project state, list existing sources |
| Collector | search, fetch URL |
| Snapshot | fetch URL, parse HTML/PDF, screenshot page |
| Extract | read snapshots, structured model call |
| Analyst | read facts, structured model call |
| Skeptic | search, fetch URL, read claims |
| Writer | read approved claims, structured model call |
| Critic | read report, claims, facts, graph |
| Trace Validator | read graph only |

This mirrors the claudecode-style idea that tool availability should be filtered by permission/capability context.

## Feedback Edges

Feedback edges are the difference between a report pipeline and an agent collaboration system.

Required feedback routes:

```text
FactCheck -> Analyst:
  claim is unsupported or logically inconsistent.

Skeptic -> Analyst:
  counter-evidence requires claim revision.

ConfidenceScorer -> Collector:
  high-value claim lacks enough evidence.

Critic -> Writer:
  report wording overclaims beyond approved claims.

TraceValidator -> Writer:
  report block cites missing or broken lineage.

TraceValidator -> Collector:
  missing SourceSnapshot or EvidenceSpan requires targeted repair.
```

Follow-up route actions:

```text
publish
publish_with_caveat
revise_claim
rewrite_report_block
collect_more_evidence
hypothesis_only
reject
human_review_required
```

## Targeted Research Sub-DAG

Low-confidence high-value claims should trigger bounded supplemental research:

```text
identify_missing_evidence
  -> search_targeted_sources
  -> fetch_targeted_sources
  -> snapshot_targeted_sources
  -> extract_targeted_evidence
  -> update_atomic_facts
  -> re_score_claim
  -> revise_or_publish
```

Hard guards:

- Maximum iterations.
- Maximum sources per claim.
- Maximum cost.
- Maximum wall-clock time.
- Stop when confidence no longer improves.
- Stop when trusted sources are exhausted.

## Workflow State

The shared state should look like:

```ts
interface WorkflowState {
  project: Project;
  competitors: Competitor[];
  dimensions: AnalysisDimension[];
  researchPlan?: ResearchPlan;
  sources: Source[];
  snapshots: SourceSnapshot[];
  evidenceSpans: EvidenceSpan[];
  atomicFacts: AtomicFact[];
  claims: Claim[];
  counterEvidence: CounterEvidence[];
  confidenceScores: ConfidenceScore[];
  insights: Insight[];
  recommendations: Recommendation[];
  reportBlocks: ReportBlock[];
  reviewFindings: ReviewFinding[];
  traceValidation?: TraceValidationResult;
}
```

Nodes should update only the state slices they own. The shared state is not a chat transcript.

## Observability

Every workflow execution should expose:

- DAG graph with node status.
- Branch-level status by competitor and dimension.
- AgentRun details.
- ToolCall details.
- Artifact input/output lists.
- Follow-up route actions.
- Retry and failure reasons.
- Budget and token usage.
- Trace Validator results.
- Confidence gate results.

This is a product surface, not an internal log.

## Evaluation Metrics

Trajectory metrics:

- Required node coverage.
- Parallel branch completion rate.
- Failed branch isolation.
- Retry success rate.
- Feedback-loop activation count.
- Unbounded loop prevention.
- Tool policy violations.
- Artifact schema validation failure rate.

Quality metrics:

- Claim support rate.
- Unsupported published claim rate.
- Contradiction catch rate.
- Citation coverage.
- Citation precision.
- Trace Validator pass rate.
- High-confidence precision.
- Report usefulness score.

## Implementation Priority

### P0: Controlled DAG With One Feedback Loop

1. Formalize `WorkflowNodeDefinition`.
2. Add node states: `needs_revision`, `needs_more_evidence`, `skipped`, `cancelled`.
3. Add structured `ResearchPlan`.
4. Add typed artifacts for the current flow.
5. Add AgentRun and ToolCall persistence hardening.
6. Add one real feedback loop: low-confidence or unsupported claim -> revision or hypothesis-only.
7. Show DAG node status in UI.

### P1: Parallel Research Branches

1. Add per-competitor collection branches.
2. Add per-competitor extraction branches.
3. Add per-dimension synthesis nodes.
4. Add branch-level failure isolation.
5. Add checkpoint/resume for partially completed workflow runs.
6. Show branch-level status in UI.

### P2: Quality-Gated Sub-DAGs

1. Add FactCheck, Skeptic, SourceQuality, and ConfidenceScorer as separate nodes.
2. Add targeted research sub-DAG for low-confidence high-value claims.
3. Add claim revision node and report rewrite node.
4. Add TraceValidator as a publication gate.
5. Add human review for contradicted or high-impact recommendations.

### P3: Competition Polish

1. Visualize fan-out/fan-in DAG.
2. Show selected claim path through DAG and Evidence Graph.
3. Add timeline showing AgentRun and ToolCall sequence.
4. Add demo state where a claim is rejected, revised, or sent to collect more evidence.
5. Add trajectory eval dashboard.

## Competition Demo

The strongest orchestration demo:

```text
1. User starts a project comparing Notion, Confluence, and Yuque.
2. DAG fans out by competitor and source type.
3. Extract/fact nodes build shared evidence state.
4. Dimension analysis nodes synthesize candidate claims.
5. FactCheck and Skeptic run in parallel.
6. ConfidenceScorer marks one claim as overconfident.
7. Targeted research sub-DAG searches for missing evidence.
8. Critic forces wording downgrade.
9. TraceValidator passes the revised claim.
10. UI shows the DAG path, Agent timeline, evidence graph, and final report sentence.
```

This proves RivalScope is not "AI writes a report." It is a controlled multi-agent research operating system.

## Relationship To Other Core Designs

```text
DAG Agent Orchestration:
  Who runs when, with what inputs, and what happens after quality gates.

Provenance Graph:
  Where every artifact came from and how it connects to the final report.

Confidence Scoring:
  How strongly the evidence supports each claim.

Trace Validator:
  Whether a claim/report block is allowed to publish.
```

Together:

```text
Typed DAG + Shared Evidence State + Claim Confidence + Trace Validation
= trustworthy competitive-intelligence agent system.
```

## Final Decision

Freeze this as the orchestration strategy:

```text
Typed DAG Orchestration with Shared Evidence State
```

Definition:

```text
Use an explicit DAG as the control plane. Run specialized agents as typed nodes.
Exchange only structured artifacts. Store every output in shared evidence/provenance
state. Use generator-verifier review loops, bounded targeted-research sub-DAGs,
confidence gates, and Trace Validator publication gates to make multi-agent work
observable, recoverable, and trustworthy.
```
