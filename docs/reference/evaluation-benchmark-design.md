# RivalScope Evaluation Benchmark Design

## Purpose

RivalScope should not be evaluated only by whether it can generate a fluent
competitive analysis report. The benchmark must prove that the system can
produce useful business conclusions through a traceable, auditable, and
repeatable multi-agent workflow.

There is no widely accepted public benchmark specifically for "competitive
analysis agents". The strongest strategy is to build an industry-aligned
benchmark: adopt public RAG, factuality, agent trajectory, and LLM evaluation
methods, then extend them with competitive-intelligence-specific metrics.

## Design Name

Industry-Aligned Evaluation Benchmark.

This means the evaluation suite should be recognizable to reviewers who know
RAGAS, DeepEval, TruLens, FEVER, FActScore, OpenAI Evals, LangSmith, Langfuse,
Phoenix, AWS Bedrock, and Azure AI Foundry, while still measuring the special
requirements of competitive intelligence.

## North Star

The benchmark should answer five questions:

1. Did RivalScope retrieve and preserve the right evidence?
2. Are final claims faithful to cited evidence?
3. Did the multi-agent DAG follow the expected role and tool trajectory?
4. Did the confidence and provenance systems block risky output?
5. Are the final insights and recommendations actually useful for product and
   strategy decisions?

The competition message is:

```text
RivalScope is not just an AI report generator.
It is a measurable business intelligence production line.
```

## Industry Alignment

### RAG Evaluation

Use established RAG metrics to evaluate the evidence retrieval and generation
layers:

- RAGAS: context precision, context recall, faithfulness, answer relevancy,
  factual correctness, and agentic metrics.
- DeepEval: faithfulness, answer relevancy, contextual precision, contextual
  recall, contextual relevancy, and custom G-Eval-style rubrics.
- TruLens RAG Triad: context relevance, groundedness, and answer relevance.
- ARES: context relevance, answer faithfulness, and answer relevance.

RivalScope mapping:

- Context precision maps to whether collected evidence spans are relevant to
  the competitor, dimension, and claim.
- Context recall maps to whether the system found the required evidence for a
  benchmark question.
- Faithfulness and groundedness map to whether claims and report blocks are
  supported by cited evidence spans.
- Answer relevance maps to whether the report addresses the requested analysis
  dimensions.

### Enterprise And Platform Evaluation

Align with production evaluation products and platform practices:

- AWS Bedrock RAG Evaluation: context relevance, context coverage,
  correctness, completeness, faithfulness, citation precision, and citation
  coverage.
- Azure AI Foundry RAG evaluators: retrieval quality, groundedness, relevance,
  response completeness, and correctness.
- OpenAI Evals and graders: datasets, model graders, deterministic Python
  graders, score-model graders, and multi-grader aggregation.
- Langfuse: traces, datasets, experiments, LLM-as-judge evaluation, human
  annotation, and observation-level evaluation.
- Phoenix and Arize: tracing-backed RAG evaluation, hallucination evaluation,
  retrieval relevance, and debugging why generated answers are unsupported.
- LangSmith and AgentEvals: agent trajectory evaluation through deterministic
  matching and LLM-as-judge over tool-call paths.

RivalScope mapping:

- The benchmark should be dataset-first, not demo-first.
- Every run should be evaluated both as a final report and as a trace.
- Deterministic graders should check schemas, citations, lineage, role
  contracts, and DAG transitions.
- LLM judges should be reserved for judgment-heavy dimensions such as insight
  usefulness, strategic nuance, and recommendation actionability.

### Factuality And Attribution Research

Use academic factuality methods as the backbone of claim-level evaluation:

- FEVER: classifies claims as supported, refuted, or not enough information
  using evidence sentences.
- CFEVER: Chinese FEVER-style fact extraction and verification, useful if the
  system later evaluates Chinese market sources.
- FActScore: decomposes long-form generation into atomic facts and computes
  the percentage supported by reliable sources.
- SAFE: uses search-augmented fact checking for long-form factuality.
- RARR: researches attribution for generated text and revises unsupported
  content while preserving the original answer where possible.

RivalScope mapping:

- Claims must be decomposed into atomic facts before scoring.
- Each atomic fact receives a verdict: `supported`, `refuted`,
  `insufficient_evidence`, or `not_checkable`.
- Unsupported claims must be routed to revision, targeted research,
  hypothesis-only output, or removal.
- Revision quality should be measured, not assumed.

## Benchmark Layers

### Layer 1: RAG Grounding Eval

This layer evaluates source collection, retrieval, and evidence selection.

Metrics:

- `context_precision`: share of retrieved evidence spans that are relevant.
- `context_recall`: share of required gold evidence found by the system.
- `source_diversity`: number of independent source families supporting key
  dimensions.
- `source_quality_weighted_recall`: recall weighted by primary, official,
  reputable media, user-generated, or unknown source reliability.
- `freshness_fit`: whether evidence freshness matches the claim type.
- `citation_precision`: cited spans actually support the cited claim.
- `citation_coverage`: final claims and report blocks include citations.

Deterministic checks:

- Every `EvidenceSpan` links to a valid `SourceSnapshot`.
- Every cited source snapshot is immutable and has retrieval metadata.
- No final claim cites a deleted, missing, or unrelated span.
- Source snapshots preserve URL, title, publisher, retrieved time, and content
  hash.

### Layer 2: Claim Factuality Eval

This layer evaluates whether the system's business claims are true, bounded,
and supported.

Metrics:

- `claim_support_rate`: percentage of atomic claims marked supported.
- `unsupported_published_claim_rate`: unsupported final claims divided by all
  final claims.
- `refuted_claim_escape_rate`: refuted claims that still reach final report.
- `high_confidence_precision`: precision of claims with confidence above the
  publication threshold.
- `low_confidence_containment_rate`: low-confidence claims routed away from
  the main report.
- `contradiction_catch_rate`: seeded contradictions detected by Critic,
  Skeptic, or Trace Validator.
- `caveat_preservation_rate`: claims with evidence limitations keep their
  caveats in the final report.
- `overclaim_detection_rate`: strategic conclusions that exceed evidence are
  flagged.

Verdict labels:

```text
supported
refuted
insufficient_evidence
not_checkable
```

Publication rules:

- `supported` claims may be published if confidence passes the type-specific
  threshold.
- `insufficient_evidence` claims may only appear as hypotheses or open
  questions.
- `refuted` claims must not appear in final recommendations.
- `not_checkable` claims require human approval or removal.

### Layer 3: Agent Trajectory Eval

This layer evaluates whether the multi-agent workflow behaved correctly.

Metrics:

- `required_node_coverage`: expected DAG nodes completed.
- `role_violation_count`: agents wrote artifacts outside their contract.
- `tool_policy_violation_count`: agents used tools they were not allowed to
  use.
- `artifact_contract_pass_rate`: outputs passed schema validation.
- `feedback_route_accuracy`: low-quality claims were routed to the right
  revision path.
- `branch_isolation_success`: failed competitor branches did not erase
  successful branches.
- `checkpoint_resume_success`: resumed workflows preserve prior artifacts.
- `critic_effectiveness`: percentage of injected defects caught by review
  agents.
- `trace_completeness_rate`: each final conclusion has a complete lineage from
  source snapshot to report block.

Trajectory matching modes:

- Strict match: required for deterministic unit-style workflows.
- Unordered match: useful for parallel competitor research where order does not
  matter.
- Superset match: the workflow must include required tools but may call extra
  tools.
- Subset match: the workflow must avoid unnecessary or disallowed tools.
- Rubric judge: used when there are multiple valid research paths.

### Layer 4: Competitive Intelligence Eval

This layer measures whether RivalScope produces analysis that a product team
would actually trust and use.

Metrics:

- `dimension_coverage`: required dimensions such as product capability,
  pricing, enterprise readiness, customer segment, positioning, GTM, and risk
  are covered.
- `comparison_specificity`: the report compares competitors directly instead
  of describing each one in isolation.
- `strategic_insight_density`: number of evidence-backed insights per report
  section.
- `recommendation_actionability`: recommendations include owner, action,
  rationale, expected impact, and evidence.
- `decision_relevance`: output helps a PM, founder, strategy analyst, or
  product researcher make a concrete decision.
- `uncertainty_handling`: the report separates facts, inferred insights,
  hypotheses, and open questions.
- `differentiation_quality`: the analysis identifies defensible product or
  market differences rather than generic summaries.
- `risk_awareness`: weaknesses, missing evidence, and possible counter-claims
  are included.

Judging method:

- Use rubric-based LLM judges for first-pass scoring.
- Calibrate judges with a small human-labeled set.
- Keep deterministic gates for citations, schemas, provenance, and role
  contracts.
- Store judge prompt version, model, temperature, inputs, outputs, and score
  rationale for every evaluation.

## Baseline Variants

The benchmark should compare RivalScope against progressively stronger
baselines:

1. `single_llm_report`
   - One prompt generates the full report from raw source text or search
     snippets.
   - Expected to be fluent but weak on traceability and defect containment.

2. `standard_rag_report`
   - Retrieval plus generation with citations.
   - Expected to improve grounding but lack role separation, feedback loops,
     and trajectory control.

3. `linear_agent_pipeline`
   - Collector -> Extractor -> Analyst -> Writer -> Critic.
   - Expected to show agent specialization but limited branch parallelism and
     weaker recovery.

4. `rivalscope_full_system`
   - Typed DAG, shared evidence state, role contracts, confidence gates,
     provenance graph, Trace Validator, and evaluation loop.
   - This is the target system.

The first-place story depends on showing that each added layer improves a
measurable failure mode, not just architectural complexity.

## Benchmark Cases

Start with small, repeatable cases that can run offline.

### Case A: AI Coding Tools

Competitors:

- Cursor
- GitHub Copilot
- Claude Code
- Trae

Dimensions:

- IDE integration.
- Agent mode.
- Codebase understanding.
- Pricing.
- Enterprise readiness.
- Developer experience.

Why this case is useful:

- The domain is familiar to AI engineering judges.
- Public documentation and pricing pages are available.
- Claims often go stale, so freshness and citation handling matter.

### Case B: AI Search And Research Tools

Competitors:

- Perplexity
- ChatGPT search/research features.
- Gemini research features.
- Genspark or similar AI research products.

Dimensions:

- Search grounding.
- Citation behavior.
- Long-form report quality.
- Source transparency.
- Team/enterprise readiness.

Why this case is useful:

- It directly tests citation quality and source reliability.
- It makes hallucination and attribution failures visible.

### Case C: Content Creation And Video Tools

Competitors:

- CapCut.
- Runway.
- Canva.
- Descript or similar editing tools.

Dimensions:

- Creation workflow.
- Collaboration.
- AI editing features.
- Export/distribution.
- Pricing and target users.

Why this case is useful:

- ByteDance-related product context makes the business story more relevant.
- The system must handle both product pages and media/news sources.

### Case D: Seeded Internal Fixture

Create synthetic competitor pages with known facts, contradictions, stale
pricing, and misleading claims.

Why this case is useful:

- It runs without network.
- It provides gold labels for context recall and claim verification.
- It enables deterministic regression tests.

## Seeded Defects

The benchmark should include injected defects to measure whether RivalScope
catches real failures:

- Missing evidence span.
- Claim cites a span from the wrong competitor.
- Claim cites a span that mentions the topic but does not support the claim.
- Report section contains an uncited claim.
- Evidence says price is monthly, report claims annual.
- Source is stale but claim is time-sensitive.
- Two sources conflict and the report hides the conflict.
- Writer uses a rejected claim.
- Collector emits a claim even though its role only allows source artifacts.
- Analyst overstates a weak signal as a market trend.
- Recommendation uses unsupported causal language.
- Trace contains a broken `SourceSnapshot -> EvidenceSpan -> Claim` lineage.

## Scoring Model

Use separate scores instead of one opaque overall grade.

```text
trust_score = 0.35 * grounding_score
            + 0.30 * factuality_score
            + 0.20 * provenance_score
            + 0.15 * confidence_calibration_score

insight_score = 0.30 * dimension_coverage
              + 0.25 * comparison_specificity
              + 0.20 * strategic_insight_density
              + 0.15 * recommendation_actionability
              + 0.10 * uncertainty_handling

agentops_score = 0.25 * required_node_coverage
               + 0.20 * artifact_contract_pass_rate
               + 0.20 * role_contract_compliance
               + 0.15 * feedback_route_accuracy
               + 0.10 * branch_isolation_success
               + 0.10 * cost_latency_stability

overall_score = 0.45 * trust_score
              + 0.30 * insight_score
              + 0.20 * agentops_score
              + 0.05 * efficiency_score
```

First-prize positioning should emphasize that `trust_score` is weighted highest.
This matches the competition's likely concern: can the system produce business
analysis that is not only impressive, but auditable and safe to rely on?

## Eval Data Model

Each benchmark case should be stored as structured data:

```ts
type BenchmarkCase = {
  id: string;
  name: string;
  domain: string;
  competitors: string[];
  requiredDimensions: string[];
  fixtureSources: FixtureSource[];
  goldEvidence: GoldEvidenceSpan[];
  goldClaims: GoldClaim[];
  seededDefects: SeededDefect[];
  expectedTrajectory: ExpectedTrajectoryRule[];
  judgeRubrics: JudgeRubric[];
};

type GoldClaim = {
  id: string;
  claimText: string;
  competitorId?: string;
  dimension: string;
  verdict: "supported" | "refuted" | "insufficient_evidence" | "not_checkable";
  requiredEvidenceSpanIds: string[];
  forbiddenEvidenceSpanIds?: string[];
  claimType: "fact" | "comparison" | "trend" | "recommendation" | "risk";
};

type ExpectedTrajectoryRule = {
  id: string;
  mode: "strict" | "unordered" | "subset" | "superset" | "rubric";
  requiredNodes?: string[];
  allowedTools?: string[];
  forbiddenTools?: string[];
  requiredArtifacts?: string[];
};
```

## Eval Dashboard

The product UI should expose evaluation as a reviewer-facing surface:

- Case selector.
- Baseline comparison table.
- Overall, trust, insight, agentops, and efficiency scores.
- RAG grounding breakdown.
- Claim factuality confusion matrix.
- Confidence calibration curve.
- Provenance broken-link list.
- Seeded defect catch table.
- Agent role violation table.
- DAG trajectory visualization.
- Cost, latency, retry, and failure summary.
- Before/after report diff for revision loops.

This turns evaluation into a competition demo advantage. Judges should be able
to click a report claim, inspect the evidence, see the confidence reason, and
then see that the same quality standard is measured across benchmark runs.

## Implementation Roadmap

### P0

- Create `packages/evals`.
- Add offline fixture benchmark cases.
- Implement deterministic graders for schemas, citations, evidence chains,
  provenance graph completeness, role contract violations, and DAG node
  coverage.
- Add seeded defect tests for unsupported claims, missing dimensions, wrong
  citations, stale evidence, and rejected claims.
- Output JSON and Markdown summaries from a local eval command.

### P1

- Add LLM-as-judge rubrics for insight quality, recommendation actionability,
  overclaiming, and uncertainty handling.
- Add baseline runners for `single_llm_report`, `standard_rag_report`,
  `linear_agent_pipeline`, and `rivalscope_full_system`.
- Add confidence calibration metrics and bucketed reliability plots.
- Add eval result persistence and UI review page.

### P2

- Add live-source benchmark mode with source snapshot freezing.
- Add human annotation workflow for judge calibration.
- Add regression gates in CI.
- Add cost and latency optimization targets.
- Add cross-model comparisons for agent roles and judge roles.

## Relationship To Core Designs

This benchmark depends on the previously frozen designs:

- Competitive knowledge schema defines the objects being evaluated.
- Agent role contracts define allowed and forbidden behavior.
- DAG orchestration defines the trajectory surface.
- Confidence scoring defines publication thresholds and calibration metrics.
- Provenance graph defines trace completeness and citation validity.

The benchmark is the proof layer for all of them.

## Final Decision

Freeze this as the evaluation strategy:

```text
Industry-Aligned Evaluation Benchmark

Definition:
A repeatable benchmark suite that evaluates final report quality, evidence
support, citation precision, provenance completeness, confidence calibration,
agent trajectory correctness, role-contract compliance, critic/skeptic
effectiveness, business insight usefulness, cost, latency, and stability.

It aligns with established RAG, factuality, agent trajectory, and LLM-as-judge
evaluation methods, then extends them with competitive-intelligence-specific
metrics such as strategic overclaim detection, caveat preservation,
claim-level provenance completeness, and recommendation actionability.
```

## Reference Links

- [RAGAS metrics](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/)
- [DeepEval RAG evaluation](https://deepeval.com/docs/getting-started-rag)
- [DeepEval faithfulness](https://deepeval.com/docs/metrics-faithfulness)
- [TruLens RAG Triad](https://www.trulens.org/getting_started/quickstarts/quickstart/)
- [ARES paper](https://arxiv.org/abs/2311.09476)
- [AWS Bedrock RAG evaluation metrics](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-evaluation-metrics.html)
- [Azure AI Foundry RAG evaluators](https://learn.microsoft.com/en-us/azure/foundry/concepts/evaluation-evaluators/rag-evaluators)
- [OpenAI graders](https://developers.openai.com/api/docs/guides/graders)
- [OpenAI Evals API](https://developers.openai.com/api/reference/resources/evals)
- [Langfuse LLM-as-a-Judge](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge)
- [Langfuse evaluation concepts](https://langfuse.com/docs/evaluation/core-concepts)
- [Phoenix RAG evaluation](https://arize.com/docs/phoenix/cookbook/evaluation/evaluate-rag)
- [Phoenix evaluators](https://arize.com/docs/phoenix/evaluation/concepts-evals/evaluators)
- [LangChain Agent Evals](https://docs.langchain.com/oss/javascript/langchain/test/evals)
- [LangSmith trajectory evaluations](https://docs.langchain.com/langsmith/trajectory-evals)
- [FEVER dataset](https://www.amazon.science/code-and-datasets/fever-fact-extraction-and-verification)
- [CFEVER dataset](https://ikmlab.github.io/CFEVER/)
- [FActScore paper](https://arxiv.org/abs/2305.14251)
- [SAFE paper](https://arxiv.org/abs/2403.18802)
- [RARR paper](https://arxiv.org/abs/2210.08726)
