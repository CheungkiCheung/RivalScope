# RivalScope Provenance Graph Design

## Purpose

This document freezes the provenance design for RivalScope's AI-driven competitor analysis agent system.

Provenance is not a bibliography feature. It is the system that explains why a report conclusion was allowed to exist.

RivalScope should answer this question for every important report sentence:

```text
Which source snapshot, evidence span, atomic fact, claim, critique, agent run, and revision produced this conclusion?
```

The design name is:

```text
Claim-Centric Provenance Graph
```

Chinese positioning:

```text
结论中心证据图谱
```

## North Star

The final report must be auditable at claim level:

```text
ReportBlock
  -> Claim
  -> AtomicFact
  -> EvidenceSpan
  -> SourceSnapshot
  -> Source
```

The system must also expose how agents transformed the evidence:

```text
AgentRun
  -> ToolCall
  -> InputArtifact
  -> OutputArtifact
  -> ReviewFinding
  -> RevisedArtifact
```

Together these form three trace layers:

1. Data provenance: where the information came from.
2. Semantic provenance: how facts became conclusions.
3. Process provenance: how agents made, challenged, revised, and published decisions.

## Why URL Citations Are Not Enough

A URL is only an entry point. It is not stable evidence.

Problems with URL-only citations:

- Web pages change.
- Pricing pages and docs can be updated after analysis.
- A full page does not show which exact sentence supports a claim.
- Links do not distinguish fact, inference, insight, and recommendation.
- Links do not reveal counter-evidence or review decisions.

RivalScope must cite immutable snapshots and exact evidence spans, not just URLs.

## Core Lineage

The canonical lineage is:

```text
Source
  -> SourceSnapshot
  -> EvidenceSpan
  -> AtomicFact
  -> Claim
  -> Insight
  -> Recommendation
  -> ReportBlock
```

Meaning:

| Layer | Role |
| --- | --- |
| Source | The public source identity: URL, PDF, dataset, review page, filing, docs page. |
| SourceSnapshot | The immutable captured version of that source. |
| EvidenceSpan | The exact quote, table cell, screenshot region, PDF span, or review snippet used as evidence. |
| AtomicFact | A small fact directly supported by evidence. |
| Claim | A report-level conclusion produced from one or more facts. |
| Insight | A business interpretation of one or more claims. |
| Recommendation | A suggested action based on insights. |
| ReportBlock | The final report paragraph, table row, or section shown to the user. |

## Data Provenance Objects

### Source

```json
{
  "source_id": "S-001",
  "canonical_url": "https://competitor.com/pricing",
  "title": "Pricing",
  "source_type": "official_pricing_page",
  "publisher": "competitor_official",
  "trust_tier": "official",
  "first_seen_at": "2026-05-15T23:30:00+08:00",
  "last_seen_at": "2026-05-15T23:30:00+08:00"
}
```

### SourceSnapshot

Snapshots are immutable. Never overwrite a snapshot; create a new one when content changes.

```json
{
  "snapshot_id": "SN-001",
  "source_id": "S-001",
  "retrieved_at": "2026-05-15T23:30:00+08:00",
  "published_at": null,
  "content_hash": "sha256:abc...",
  "raw_storage_uri": "snapshots/SN-001/raw.html",
  "text_storage_uri": "snapshots/SN-001/clean.txt",
  "screenshot_uri": "snapshots/SN-001/page.png",
  "parser_version": "html-parser-v1.2.0",
  "collector_agent_run_id": "AR-collector-001"
}
```

Minimum snapshot fields:

- raw captured content
- cleaned text
- retrieval time
- content hash
- parser version
- collector agent run id

Nice-to-have fields:

- page screenshot
- HTTP headers
- robots/cache policy result
- canonical URL after redirects
- language and locale
- extraction warnings

### EvidenceSpan

Evidence spans should be precise enough to highlight the original supporting text.

```json
{
  "evidence_id": "E-041",
  "snapshot_id": "SN-001",
  "source_id": "S-001",
  "quote": "Enterprise plan includes SSO, audit logs, and advanced admin controls.",
  "normalized_text": "Enterprise plan includes SSO, audit logs, and advanced admin controls.",
  "location": {
    "css_selector": "#enterprise-plan",
    "text_offset_start": 1280,
    "text_offset_end": 1364
  },
  "evidence_type": "direct_text",
  "extracted_by_agent_run_id": "AR-extract-002",
  "extraction_confidence": 0.94
}
```

For PDFs, use page and bounding boxes. For tables, use row and column coordinates. For user reviews, use review id, author handle if safe to store, timestamp, and platform.

## Semantic Provenance Objects

### AtomicFact

Facts must stay close to what evidence directly says.

```json
{
  "fact_id": "F-012",
  "statement": "Competitor A's Enterprise plan includes SSO, audit logs, and advanced admin controls.",
  "competitor_id": "competitor_a",
  "dimension": "enterprise_readiness",
  "evidence_ids": ["E-041"],
  "generated_by_agent_run_id": "AR-fact-003",
  "verdict": "SUPPORTED"
}
```

### Claim

Claims are report-level conclusions. They may involve inference.

```json
{
  "claim_id": "C-017-v2",
  "previous_version_id": "C-017-v1",
  "statement": "Competitor A is strengthening enterprise readiness, but the evidence does not yet prove it has fully shifted to enterprise customers.",
  "claim_type": "strategic_inference",
  "fact_ids": ["F-012", "F-013", "F-014"],
  "supporting_evidence_ids": ["E-041", "E-052", "E-068"],
  "counter_evidence_ids": ["E-073"],
  "confidence": 0.76,
  "status": "published_with_caveat",
  "generated_by_agent_run_id": "AR-analysis-003",
  "reviewed_by_agent_run_ids": ["AR-skeptic-004", "AR-critic-005"]
}
```

### Insight

Insights explain why a claim matters for the business.

```json
{
  "insight_id": "I-006",
  "statement": "Competitor A is likely adding enterprise governance features before its enterprise motion fully matures.",
  "claim_ids": ["C-017-v2", "C-018"],
  "confidence": 0.74
}
```

### Recommendation

Recommendations must cite upstream insights, not raw sources.

```json
{
  "recommendation_id": "R-003",
  "statement": "Emphasize governance, security, and compliance positioning in enterprise sales materials.",
  "insight_ids": ["I-006"],
  "priority": "high"
}
```

### ReportBlock

Report blocks cite approved claims. They should not directly cite arbitrary URLs.

```json
{
  "report_block_id": "RB-004",
  "section": "Enterprise Readiness",
  "text": "Competitor A is strengthening enterprise readiness, but the evidence does not yet prove it has fully shifted to enterprise customers.",
  "claim_ids": ["C-017-v2", "C-018"],
  "confidence": 0.76,
  "status": "published_with_caveat"
}
```

## Edge Model

Use an append-only edge table to represent lineage.

```json
{
  "edge_id": "EDGE-001",
  "from_artifact_type": "evidence_span",
  "from_artifact_id": "E-041",
  "to_artifact_type": "atomic_fact",
  "to_artifact_id": "F-012",
  "relation": "supports",
  "weight": 0.94,
  "created_by_agent_run_id": "AR-fact-003",
  "created_at": "2026-05-15T23:34:12+08:00"
}
```

Recommended relations:

| Relation | Meaning |
| --- | --- |
| `supports` | Upstream artifact supports downstream artifact. |
| `refutes` | Upstream artifact contradicts downstream artifact. |
| `qualifies` | Upstream artifact weakens or limits downstream wording. |
| `derived_from` | Downstream artifact was produced from upstream artifacts. |
| `cited_by` | Upstream artifact is cited by a report block or claim. |
| `revised_to` | One artifact version was revised into another. |
| `requires_more_evidence` | Current support is insufficient and should trigger more research. |

Support-only provenance is not enough. Counter-evidence and caveats must be first-class edges.

## Process Provenance

### AgentRun

Every agent decision should be reconstructable from stored records.

```json
{
  "agent_run_id": "AR-analysis-003",
  "workflow_run_id": "WR-001",
  "agent_name": "analysis_agent",
  "agent_version": "analysis-agent-v0.3.0",
  "model": "gpt-5.4",
  "prompt_version": "analysis-prompt-v2",
  "input_artifact_ids": ["F-012", "F-013", "F-014", "F-015"],
  "output_artifact_ids": ["C-017-v1", "C-018"],
  "started_at": "2026-05-15T23:33:45+08:00",
  "ended_at": "2026-05-15T23:33:58+08:00",
  "status": "succeeded",
  "cost_usd": 0.04,
  "token_usage": {
    "input": 4200,
    "output": 900
  },
  "decision_summary": "Generated an enterprise-readiness claim from pricing, docs, and hiring signals, then preserved SMB caveat from customer-story evidence."
}
```

Do not expose hidden chain-of-thought. Store and show decision summaries, evidence inputs, outputs, critique findings, and revision diffs.

### ToolCall

```json
{
  "tool_call_id": "TC-091",
  "agent_run_id": "AR-collector-001",
  "tool_name": "fetch_url",
  "input": {
    "url": "https://competitor.com/pricing"
  },
  "output_artifact_ids": ["SN-001"],
  "status": "succeeded",
  "duration_ms": 842,
  "error": null
}
```

## Versioning Rules

Artifacts are immutable once published to the trace.

Rules:

- Do not overwrite claims, facts, insights, recommendations, or report blocks.
- Revisions create new artifact ids or version ids.
- Preserve `revised_to` / `revised_from` edges.
- Store the review finding that caused the revision.
- Store a compact revision diff for UI display.

Example:

```text
C-017-v1:
Competitor A has fully shifted to enterprise customers.

ReviewFinding RF-008:
Wording is too strong. Evidence supports enterprise-readiness strengthening but not a full customer-base shift.

C-017-v2:
Competitor A is strengthening enterprise readiness, but the evidence does not yet prove it has fully shifted to enterprise customers.
```

## Trace Validator

The Trace Validator is the publication gate. It should run before a report becomes final.

Required checks:

```text
ReportBlock must cite at least one Claim.
Claim must cite at least one AtomicFact or approved upstream Claim.
AtomicFact must cite at least one EvidenceSpan.
EvidenceSpan must cite one SourceSnapshot.
SourceSnapshot must cite one Source.
Strategic inference Claim must have skeptic review.
Recommendation must cite at least one Insight.
Insight must cite at least one Claim.
Strongly refuted Claim cannot enter the main report.
Low-confidence Claim can only enter a hypothesis or watchlist section.
```

Trace statuses:

| Status | Meaning | Action |
| --- | --- | --- |
| `complete_trace` | Full lineage exists and gates pass. | Can publish. |
| `partial_trace` | Some lineage exists but non-critical fields are missing. | Can publish only with caveat or internal-only status. |
| `weak_trace` | Evidence exists but is indirect or low confidence. | Hypothesis/watchlist only. |
| `broken_trace` | Required lineage is missing. | Block publication. |
| `contradicted_trace` | Strong counter-evidence exists. | Reject or require revision. |

## UI Design

### Report Evidence Chip

Every major report conclusion should show a compact marker:

```text
Competitor A is strengthening enterprise readiness. [0.76 | 3 support | 1 caveat | trace complete]
```

Clicking the marker opens the provenance drawer.

### Provenance Drawer

The drawer should show:

- Final report sentence.
- Claim id and status.
- Supporting evidence spans.
- Counter-evidence and caveats.
- Confidence breakdown link.
- Revision history.
- Agent review findings.
- Source snapshot metadata.

### Graph View

Graph view is the best answer to "how did this conclusion get produced?"

Recommended visible path when a claim is selected:

```text
Source -> SourceSnapshot -> EvidenceSpan -> AtomicFact -> Claim -> Insight -> Recommendation -> ReportBlock
```

Highlight selected paths and dim unrelated nodes. Show relation labels on edges: `supports`, `refutes`, `qualifies`, `derived_from`, and `revised_to`.

### Agent Timeline

Timeline view should show:

```text
23:30 Collector Agent fetched pricing page.
23:31 Extract Agent created evidence spans.
23:32 Fact Agent generated atomic facts.
23:33 Analyst Agent generated candidate claims.
23:34 Skeptic Agent found counter-evidence.
23:35 Critic Agent required wording revision.
23:36 Writer Agent published report block.
```

The timeline should link each event to AgentRun, ToolCall, and created artifacts.

### Design Reference

The preferred visual direction is a three-pane evidence workspace:

- Left: data provenance cards for Source, SourceSnapshot, and EvidenceSpan.
- Center: provenance graph for EvidenceSpan -> AtomicFact -> Claim -> Insight -> Recommendation -> ReportBlock.
- Right: process provenance with Agent timeline, AgentRun detail, and ToolCall detail.
- Bottom: Trace Validator result, selected edge detail, selected node detail, and optional confidence breakdown.

This layout is strongest as a demo/inspection screen. The normal user flow should still start from the final report and drill down into this graph.

## Demo Script

The strongest demo should show a claim being downgraded by evidence:

```text
1. Analyst Agent proposes:
   Competitor A has fully shifted to enterprise customers.

2. Supporting evidence exists:
   Enterprise plan, SSO docs, audit log docs, enterprise sales hiring.

3. Skeptic Agent finds caveat evidence:
   Customer stories and templates remain SMB-heavy.

4. Critic Agent rejects the overclaim:
   "Fully shifted" is too strong.

5. Writer Agent revises:
   Competitor A is strengthening enterprise readiness, but the evidence does not yet prove it has fully shifted to enterprise customers.

6. UI shows:
   Source snapshots, evidence spans, atomic facts, counter-evidence, revised claim, trace validator, and agent timeline.
```

This proves the system does not merely generate a report. It produces, challenges, revises, and audits competitive intelligence.

## Storage Plan

Use relational tables first. A graph database is not required for the competition MVP.

Recommended tables:

```text
sources
source_snapshots
evidence_spans
atomic_facts
claims
insights
recommendations
report_blocks
lineage_edges
agent_runs
tool_calls
review_findings
artifact_versions
```

The key table is `lineage_edges`. It lets the product answer:

- Which sources support this report block?
- Which claims depend on this source?
- Which claims have counter-evidence?
- Which AgentRun created this edge?
- Which artifacts were revised after critique?
- Which report blocks are blocked by broken lineage?

## Implementation Priority

### P0: Competition-Critical Trace

1. Add `SourceSnapshot`.
2. Add `EvidenceSpan`.
3. Add `AtomicFact`.
4. Add `ReportBlock -> Claim -> AtomicFact -> EvidenceSpan -> SourceSnapshot` lineage.
5. Add `lineage_edges`.
6. Add Trace Validator.
7. Add report evidence chips and provenance drawer.

### P1: Strong Differentiator

1. Add `refutes` and `qualifies` edges.
2. Add Claim version history.
3. Add ReviewFinding -> RevisedClaim relation.
4. Add Agent timeline.
5. Add ToolCall detail.
6. Add selected-claim graph view.

### P2: First-Place Polish

1. Add source screenshot and original text highlight.
2. Add full Evidence Graph view.
3. Add confidence breakdown in selected node detail.
4. Add broken-trace and contradicted-trace demo states.
5. Add exportable audit packet.
6. Add evaluation metrics for citation coverage, citation precision, broken trace rate, and contradiction catch rate.

## Interaction With Confidence Scoring

The provenance graph provides the evidence substrate. The confidence scorer uses it.

```text
Provenance graph answers:
Where did this conclusion come from?

Confidence scoring answers:
How strongly does the evidence support this conclusion?

Trace Validator answers:
Is this conclusion allowed to be published?
```

The two designs should be implemented together:

- Provenance graph stores SourceSnapshot, EvidenceSpan, facts, claims, edges, and review records.
- Confidence scoring computes support strength, contradiction strength, and publication status.
- Trace Validator enforces hard lineage and status gates.

## Final Decision

Freeze this as the provenance strategy:

```text
Claim-Centric Provenance Graph
```

Definition:

```text
Model every report conclusion as an auditable claim connected to immutable source snapshots,
exact evidence spans, atomic facts, counter-evidence, agent review records, revision history,
and final report blocks. Use Trace Validator to block unsupported, broken, or strongly
contradicted conclusions from publication.
```
