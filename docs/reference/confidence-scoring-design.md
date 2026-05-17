# RivalScope Confidence Scoring Design

## Purpose

This document freezes the confidence and provenance design for RivalScope's AI-driven competitor analysis agent system.

The goal is not to let an LLM self-report how confident it feels. RivalScope should compute claim confidence from the evidence state around each conclusion:

```text
Claim confidence = evidence quality + support strength + source independence + freshness + consistency - contradiction risk - inference difficulty
```

The confidence score is a workflow control signal, not decorative metadata. It decides whether a claim can enter the final report, must be downgraded to a hypothesis, needs more research, or should be rejected.

## North Star

RivalScope should behave like an auditable competitive-intelligence production line:

```text
Source -> Snapshot -> EvidenceSpan -> AtomicFact -> Claim -> Insight -> Recommendation -> ReportBlock
```

Every analytical claim in the final report must be traceable back to concrete evidence spans and agent review decisions. A report conclusion without evidence is invalid.

## Design Positioning

This module is one of the championship-level differentiators for the ByteDance competition theme. It directly supports:

- Claim-level provenance.
- Observable agent decision-making.
- Cross-agent critique and revision loops.
- Transparent confidence explanations.
- Guardrails against hallucinated or overconfident market analysis.

The design should be framed as `Claim-level Evidence Confidence`, not a generic "confidence score."

## Research Foundations

The implementation can cite these public research and industry patterns:

- FEVER-style fact verification: classify claims as `SUPPORTED`, `REFUTED`, or `NOT_ENOUGH_INFO`.
- FActScore-style decomposition: split long report text into atomic facts before evaluation.
- Google AIS-style attribution: judge whether generated statements are attributable to identified sources.
- RAGAS / ARES-style RAG evaluation: evaluate groundedness, context relevance, context precision, and answer faithfulness.
- SAFE-style search-augmented factuality checking: verify long-form generated content with retrieved evidence.
- RARR-style research-and-revision: revise generated text after unsupported claims are detected.
- Large vendor RAG eval patterns from Azure, AWS, OpenAI, and observability/eval systems such as Coze Loop: separate groundedness, citation coverage, retrieval quality, traceability, and workflow evaluation.

These references are backing ideas, not dependencies. The first implementation should use typed artifacts, deterministic rules, and LLM judges only where semantic support checks are needed.

## Core Principle

Do not ask the model:

```text
How confident are you?
```

Ask the system:

```text
What evidence supports this claim?
What evidence refutes it?
Are the sources reliable, fresh, independent, and direct?
Does the evidence cover every atomic part of the claim?
Did a critic agent challenge the wording?
Should this claim be published, revised, downgraded, or blocked?
```

## Entity Model

### Source

A source is a document, page, file, dataset, or external record collected during research.

```json
{
  "source_id": "S-001",
  "url": "https://example.com/pricing",
  "title": "Pricing",
  "source_type": "official_pricing_page",
  "publisher": "competitor_official",
  "retrieved_at": "2026-05-15T10:30:00+08:00",
  "published_at": null,
  "content_hash": "sha256:...",
  "snapshot_id": "SN-001",
  "reliability_score": 0.92
}
```

### EvidenceSpan

An evidence span is the exact part of a source used by a fact or claim.

```json
{
  "evidence_id": "E-041",
  "source_id": "S-001",
  "quote": "Enterprise plan includes SSO, audit logs, and advanced admin controls.",
  "location": {
    "css_selector": "#enterprise-plan",
    "text_offset_start": 1280,
    "text_offset_end": 1364
  },
  "evidence_type": "direct_text",
  "extracted_by": "collector_agent",
  "extraction_confidence": 0.94
}
```

### AtomicFact

Atomic facts are small factual statements extracted from evidence spans or decomposed from a claim.

```json
{
  "fact_id": "F-003",
  "statement": "Competitor A offers SSO in its Enterprise plan.",
  "competitor_id": "competitor_a",
  "dimension": "enterprise_readiness",
  "evidence_ids": ["E-041"],
  "verdict": "SUPPORTED",
  "support_prob": 0.91,
  "refute_prob": 0.03,
  "not_enough_info_prob": 0.06
}
```

### Claim

A claim is a report-level conclusion. It can be factual, comparative, trend-based, strategic, or recommendation-oriented.

```json
{
  "claim_id": "C-017",
  "claim_type": "strategic_inference",
  "text": "Competitor A is strengthening its enterprise customer motion.",
  "entities": ["Competitor A"],
  "supporting_evidence_ids": ["E-041", "E-052", "E-068"],
  "contradicting_evidence_ids": ["E-073"],
  "confidence": 0.76,
  "confidence_level": "medium_high",
  "status": "passed_with_caveat",
  "generated_by": "analysis_agent",
  "reviewed_by": ["fact_check_agent", "skeptic_agent"]
}
```

## Claim Types And Evidence Gates

Different claim types need different evidence thresholds.

| Claim type | Example | Minimum evidence gate |
| --- | --- | --- |
| Factual | "Competitor A supports SSO." | At least one high-quality direct source. |
| Comparative | "A has stronger admin controls than B." | Same-dimension evidence for both competitors. |
| Trend | "A is strengthening AI capabilities." | Multiple recent signals or time-based evidence. |
| Strategic inference | "A is moving from SMB toward Enterprise." | At least two independent signal types plus skeptic review. |
| Recommendation | "We should prioritize enterprise governance." | Must inherit support from one high-confidence insight or two medium-confidence insights. |

Rules:

- Factual claims should not rely on weak proxy signals when direct evidence is available.
- Strategic claims must be phrased with calibrated language unless evidence is very strong.
- Recommendations cannot be free-floating; they must cite upstream insights and business impact.

## Evidence Score

Each evidence span receives an `EvidenceScore`.

```text
EvidenceScore =
  SourceReliability
* EvidenceDirectness
* Freshness
* ExtractionConfidence
* Accessibility
```

### Source Reliability Priors

| Source class | Initial range |
| --- | --- |
| Official docs, pricing pages, changelogs, filings, financial reports | 0.90 - 0.98 |
| Official blogs, press releases, customer stories, job posts | 0.78 - 0.90 |
| Credible media, analyst reports, trusted databases | 0.65 - 0.82 |
| User reviews, forums, social posts, third-party blogs | 0.45 - 0.70 |
| Aggregators, second-hand summaries, unclear sources | 0.25 - 0.50 |

Source reliability is claim-dependent. An official pricing page is strong evidence for product packaging. A press release is weaker evidence for market success because it may reflect marketing intent rather than external validation.

### Evidence Directness

| Directness | Score guideline |
| --- | --- |
| Direct explicit statement | 0.90 - 1.00 |
| Structured page or table extraction | 0.75 - 0.90 |
| Multi-signal proxy evidence | 0.55 - 0.75 |
| Weak proxy signal | 0.35 - 0.55 |
| Pure inference | 0.10 - 0.35 |

## Freshness

Freshness should use a half-life model:

```text
freshness = exp(-age_days / half_life_days)
```

Suggested half-lives:

| Evidence type | Half-life |
| --- | --- |
| Pricing page | 30 - 60 days |
| Feature documentation | 90 - 180 days |
| Job posting signal | 30 - 90 days |
| Product changelog | 90 - 180 days |
| Strategic positioning page | 180 days |
| Company background information | 365 days |

If `published_at` is unavailable, use `retrieved_at` and store a snapshot hash.

## Atomic Fact Verification

Every generated report block should be decomposed into atomic facts before final publication.

Verifier output:

```json
{
  "fact_id": "F-003",
  "verdict": "SUPPORTED",
  "support_prob": 0.91,
  "refute_prob": 0.03,
  "not_enough_info_prob": 0.06,
  "evidence_ids": ["E-021", "E-044"],
  "reason": "Two source spans directly show that the feature exists."
}
```

Allowed verdicts:

- `SUPPORTED`
- `PARTIALLY_SUPPORTED`
- `REFUTED`
- `NOT_ENOUGH_INFO`

`NOT_ENOUGH_INFO` must be treated as a first-class result, not a failure. A good research system should be comfortable saying "we do not know yet."

## Claim Confidence Formula

Support strength should accumulate across independent evidence without simple addition, so duplicated articles do not inflate confidence.

```text
SupportStrength =
  1 - product(1 - support_prob_i * evidence_weight_i)

ContradictionStrength =
  1 - product(1 - refute_prob_j * evidence_weight_j)
```

Recommended first-pass formula:

```text
ClaimConfidence =
Calibrate(
  0.22 * SupportStrength
+ 0.16 * SourceReliability
+ 0.14 * EvidenceDirectness
+ 0.12 * EvidenceCoverage
+ 0.10 * SourceIndependence
+ 0.08 * Freshness
+ 0.08 * Consistency
+ 0.05 * ExtractionConfidence
+ 0.05 * ReviewerAgreement
- 0.18 * ContradictionStrength
- 0.10 * InferencePenalty
)
```

Use `clamp(0, 1)` for the MVP. Later, replace `Calibrate(...)` with a learned or fitted calibration layer.

Important: these weights are expert priors, not final truth. They should be calibrated against a small human-labeled claim set.

## Independence And Evidence Clustering

Do not count five reposts of the same announcement as five independent sources.

Group evidence into clusters:

```text
Cluster A: official announcement
Cluster B: pricing page
Cluster C: help-center docs
Cluster D: job posting
Cluster E: user review themes
```

Only independent clusters should materially increase support. Same-origin copies should mainly increase confidence that the source was captured correctly, not that the market claim is true.

## Contradiction Handling

The skeptic agent must actively search for counter-evidence and alternative explanations.

Contradiction outcomes:

| Outcome | Meaning | Workflow action |
| --- | --- | --- |
| Strong contradiction | Reliable evidence directly refutes the claim. | Reject claim. |
| Medium contradiction | Claim is partly true but wording is too strong. | Revise wording and lower confidence. |
| Weak contradiction | Evidence adds nuance but does not overturn claim. | Pass with caveat. |
| No contradiction found | No meaningful counter-evidence found. | Continue, but do not treat absence of contradiction as proof. |

Example:

```text
Original claim:
Competitor A has fully shifted from SMB to Enterprise.

Counter-evidence:
The website still heavily promotes free and low-cost team plans, and customer stories remain SMB-heavy.

Revised claim:
Competitor A is strengthening enterprise readiness while still preserving a PLG and SMB growth path.
```

## Confidence Levels

Expose both score and level.

| Level | Score range | Meaning |
| --- | --- | --- |
| High | 0.85 - 1.00 | Direct, fresh, independent, consistent evidence with no meaningful contradiction. |
| Medium | 0.65 - 0.84 | Sufficient evidence, but some inference, limited sources, or mild contradiction. |
| Low | 0.45 - 0.64 | Weak or indirect evidence. Treat as a hypothesis. |
| Rejected | < 0.45 | Evidence is insufficient or contradictory. Do not publish as a conclusion. |

## Publication Gates

Suggested gates for the report writer:

```text
Factual claim:
  confidence >= 0.75

Comparative claim:
  confidence >= 0.78
  and same-dimension evidence exists for all compared competitors

Trend claim:
  confidence >= 0.70
  and at least two time-based or recent signal clusters exist

Strategic inference:
  confidence >= 0.72
  and independent_signal_types >= 2
  and skeptic_review_status != "not_reviewed"

Recommendation:
  cites at least one high-confidence insight
  or cites at least two medium-confidence insights
```

If a claim is valuable but under-supported, route it to `hypothesis_only` or `needs_more_research` instead of deleting it silently.

## Workflow Integration

Confidence must control the DAG.

```text
analysis_agent generates candidate claims
  -> fact_check_agent verifies atomic facts
  -> skeptic_agent searches for counter-evidence
  -> confidence_scorer computes score and status
  -> critic_agent decides publish / revise / downgrade / reject / collect_more
  -> writer_agent uses only approved or caveated claims
```

Actions:

- `publish`: claim may enter final report.
- `publish_with_caveat`: claim may enter final report with limitation language.
- `revise`: claim wording is too strong; send back to analysis or writer.
- `collect_more`: high-value claim lacks enough evidence; trigger research branch.
- `hypothesis_only`: keep in "signals to validate" section, not core analysis.
- `reject`: block from report.

## UI Requirements

The report should show a compact confidence marker:

```text
Competitor A is strengthening enterprise readiness. [0.76 medium-high | 3 support | 1 counter-signal]
```

Expanding the marker should show:

- Supporting evidence spans.
- Contradicting evidence spans.
- Source classes and freshness.
- Score breakdown.
- Agent decisions and review outcomes.
- Final wording changes caused by critique.

Example expanded explanation:

```text
Score: 0.76
Status: passed_with_caveat

Support:
1. Official pricing page shows Enterprise plan.
2. Help docs mention SSO, audit logs, admin roles.
3. Job posting seeks Enterprise Account Executive.

Counter-signal:
1. Customer stories and templates remain SMB-heavy.

Why this wording:
The system replaced "fully shifted to Enterprise" with "strengthening enterprise readiness" because the counter-signal shows the SMB path remains active.
```

## Observability Requirements

Store and display:

- Agent input and output artifacts.
- Tool calls used to collect evidence.
- Evidence spans selected by extractors.
- Atomic fact verification results.
- Claim score breakdowns.
- Skeptic findings.
- Critic decisions.
- Revision diffs.
- Duration, cost, token use, retries, and errors.

Do not expose hidden chain-of-thought. Expose decision summaries, evidence, score inputs, and review outcomes.

## Evaluation And Calibration

The MVP can use rule-based weights. To make the system credible, create a small calibration set:

```text
50 - 100 competitor-analysis claims
Human labels:
  SUPPORTED
  PARTIALLY_SUPPORTED
  REFUTED
  NOT_ENOUGH_INFO
```

Evaluate:

- High-confidence precision: among claims scored >= 0.85, how many humans accept?
- Unsupported claim rate: how many published claims are unsupported?
- Citation coverage: how many report claims have evidence?
- Citation precision: how many citations actually support the cited claim?
- Contradiction catch rate: how often skeptic catches seeded counter-evidence?
- Calibration error: do 0.80 claims succeed about 80% of the time?
- Revision effectiveness: do revised claims become more accurate and less overconfident?

Later calibration options:

- Logistic regression over scoring features.
- Isotonic regression for score calibration.
- Per-claim-type thresholds learned from labeled data.

## Implementation Roadmap

### MVP

1. Extend evidence types with source reliability, evidence spans, and claim status.
2. Add claim type-specific thresholds.
3. Add atomic fact verification artifacts.
4. Implement rule-based confidence scoring.
5. Add critic gates for low-confidence, unsupported, and contradicted claims.
6. Show claim confidence and evidence expansion in the report UI.

### Strong Competition Version

1. Add skeptic agent with explicit counter-evidence search.
2. Add evidence clustering for source independence.
3. Add `collect_more` branch when valuable claims lack support.
4. Add revision diffs from overclaim to calibrated claim.
5. Add evaluation dashboard with high-confidence precision, citation coverage, unsupported claim rate, and contradiction catch rate.
6. Add a demo case where one strong-sounding claim is rejected or downgraded because of counter-evidence.

## Demo Moment

The strongest demo should show the system refusing to overclaim.

Flow:

```text
1. Analyst proposes: "Competitor A has fully shifted from SMB to Enterprise."
2. Fact checker finds support: Enterprise plan, SSO docs, enterprise sales hiring.
3. Skeptic finds counter-signal: SMB templates, free plan emphasis, SMB-heavy customer stories.
4. Scorer lowers confidence and flags wording as too strong.
5. Writer revises: "Competitor A is strengthening enterprise readiness while preserving its SMB growth path."
6. UI shows the evidence chain, counter-signal, score breakdown, and revision diff.
```

This demonstrates confidence as a product behavior: the system knows when to speak carefully.

## Final Decision

Freeze this as the main confidence strategy:

```text
Claim-level Evidence Confidence
```

Definition:

```text
Use claim-level evidence graphs, atomic fact verification, FEVER-style verdicts,
source and evidence quality scoring, contradiction penalties, and claim-type gates
to decide which competitor-analysis conclusions can be published.
```

The scheme is strong enough to be a first-prize-level module. It becomes first-place competitive when combined with:

- A real multi-agent DAG.
- Evidence graph UI.
- Agent run observability.
- Strong business insight generation.
- Repeatable eval dashboard.
