# RivalScope Agent Role Contracts Design

## Purpose

This document freezes RivalScope's agent role contracts.

Agent role contracts are not prompt descriptions. They are runtime boundaries: each agent has explicit responsibilities, readable artifacts, writable artifacts, tool permissions, forbidden actions, quality gates, failure modes, provenance write requirements, and observability requirements.

The design name is:

```text
Agent Role Contracts
```

Chinese positioning:

```text
Agent 角色契约
```

## North Star

RivalScope's agents should collaborate through typed artifacts and shared evidence state, not through hidden free-form conversation.

Every agent run should answer:

```text
What did this agent read?
What was it allowed to do?
What did it write?
Which tools did it call?
Which contract gates did it pass or fail?
Which downstream artifacts depend on its output?
```

## Hard Rules

1. Each agent can only write the artifact types it owns.
2. Agents exchange schema-validated artifacts, not free-form conclusions.
3. Collector must not generate analytical claims.
4. Extractor must not fill in information that the source did not say.
5. Analyst must not create claims without cited facts or knowledge items.
6. Skeptic must not rewrite final reports; it writes counter-evidence, caveats, and open questions.
7. Writer can only use approved or `publish_with_caveat` claims and insights.
8. Critic must output `ReviewFinding`; it cannot silently fix problems.
9. TraceValidator must be deterministic and must not call an LLM.
10. Every AgentRun and ToolCall must be observable and linked to produced artifacts.

## Contract Template

Every role follows this template:

```text
Role
Purpose
Reads
Writes
Allowed tools
Forbidden actions
Input contract
Output contract
Quality gates
Failure conditions
Retry / timeout policy
Provenance requirements
Observability requirements
```

Type shape:

```ts
interface AgentRoleContract<I, O> {
  role: AgentRole;
  purpose: string;
  ownsArtifacts: ArtifactType[];
  readsArtifacts: ArtifactType[];
  inputSchema: ZodSchema<I>;
  outputSchema: ZodSchema<O>;
  allowedTools: ToolName[];
  forbiddenActions: string[];
  qualityGates: QualityGate[];
  failureModes: FailureMode[];
  retryPolicy: RetryPolicy;
  provenanceWrites: ProvenanceWritePolicy;
  confidenceImpact: ConfidenceImpactPolicy;
}
```

## Artifact Write Matrix

| Agent / Node | Can write | Must not write |
| --- | --- | --- |
| Research Planner | `ResearchPlan`, `SourceTarget`, `DimensionPlan` | `Claim`, `Insight`, `Recommendation`, `ReportBlock` |
| Collector | `SourceCandidate`, `CollectionWarning`, `ToolCall` | `EvidenceSpan`, `KnowledgeItem`, `Claim` |
| Snapshot | `SourceSnapshot`, `ParsedSourceText`, `SnapshotWarning` | `AtomicFact`, `Claim`, `Insight` |
| Extractor | `EvidenceSpan`, `AtomicFact`, `ExtractionWarning` | `Claim`, `Insight`, `Recommendation` |
| Knowledge Structuring | `KnowledgeItem`, specialized profiles | Strategic `Claim`, `Recommendation` |
| Analyst | `CandidateClaim`, `Insight` | `SourceSnapshot`, `EvidenceSpan`, `ReportBlock` |
| FactCheck | `VerificationResult` | `Claim`, `ReportBlock` |
| Skeptic | `CounterEvidence`, `Caveat`, `OpenQuestion`, `refutes` / `qualifies` edges | Final `ReportBlock`, silent claim mutation |
| Source Quality | `SourceQualityAssessment`, `EvidenceCluster` | `Claim`, `ReportBlock` |
| Confidence Scorer | `ConfidenceScore`, `PublicationStatus`, `RouteAction` | New `Claim`, new `EvidenceSpan` |
| Writer | `ReportBlock` | `EvidenceSpan`, `AtomicFact`, unsupported claims |
| Critic | `ReviewFinding`, `RevisionRequest` | Silent mutations, source snapshots |
| TraceValidator | `TraceValidationResult` | Any creative content |

## Global Quality Gates

### Schema Gate

- Every output must pass Zod/schema validation.
- Referenced artifact ids must exist.
- Enum values must be legal.
- Schema version must be present on major artifacts.

### Evidence Gate

- `AtomicFact` must cite at least one `EvidenceSpan`.
- `KnowledgeItem` must cite facts and evidence.
- `Claim` must cite `KnowledgeItem` or `AtomicFact`.
- `Insight` must cite claims.
- `Recommendation` must cite insights or claims.
- `ReportBlock` must cite approved claims.

### Publication Gate

- Rejected claims cannot enter final report.
- `hypothesis_only` claims can only appear in open questions or watchlist sections.
- `publish_with_caveat` claims must preserve caveat language.
- Strongly refuted claims must be rejected or revised.
- TraceValidator must pass before final publication.

## Research Planner Agent

### Purpose

Convert the user's analysis goal into a structured research plan and initial DAG branches.

### Reads

```text
AnalysisProject
CompetitorProfile
RequiredDimensions
ExistingKnowledgeSummary
```

### Writes

```text
ResearchPlan
SourceTarget[]
DimensionPlan[]
ExpectedArtifactChecklist
```

### Allowed Tools

```text
read_project_state
list_existing_sources
```

### Forbidden Actions

- Generate claims.
- Generate insights.
- Judge competitor strengths.
- Write report blocks.

### Output Contract

```json
{
  "research_plan_id": "rp_001",
  "project_id": "project_001",
  "competitors": ["notion", "confluence", "yuque"],
  "dimensions": [
    "ai_capability",
    "enterprise_readiness",
    "pricing_strategy",
    "gtm_motion"
  ],
  "source_targets": [
    {
      "competitor_id": "notion",
      "source_type": "official_pricing_page",
      "purpose": "pricing_and_packaging",
      "priority": "high"
    }
  ],
  "quality_gates": [
    "each_required_dimension_needs_at_least_one_claim",
    "strategic_inference_requires_skeptic_review"
  ]
}
```

### Quality Gates

- Must cover every required dimension.
- Each competitor must have at least three source target categories.
- Every source target must include purpose and priority.

### Failure Conditions

```text
missing_required_dimension
no_source_targets_for_competitor
invalid_source_priority
```

## Collector Agent

### Purpose

Find candidate public sources for the research plan.

### Reads

```text
ResearchPlan
SourceTarget
CompetitorProfile
```

### Writes

```text
SourceCandidate[]
ToolCall[]
CollectionWarning[]
```

### Allowed Tools

```text
search_web
search_domain
list_known_sources
```

### Forbidden Actions

- Generate evidence spans.
- Generate atomic facts.
- Summarize page content as fact.
- Generate claims.

### Output Contract

```json
{
  "source_candidates": [
    {
      "source_id": "src_001",
      "competitor_id": "notion",
      "url": "https://www.notion.com/pricing",
      "source_type": "official_pricing_page",
      "expected_use": "pricing_and_packaging",
      "priority": "high",
      "discovered_by_tool_call_id": "tc_001"
    }
  ],
  "warnings": []
}
```

### Quality Gates

- URL must be canonicalized.
- `source_type` must come from the source taxonomy.
- Every source candidate must cite `discovered_by_tool_call_id`.

### Failure Conditions

```text
no_sources_found
source_type_unknown
duplicate_only
```

## Snapshot Tool / Snapshot Agent

### Purpose

Turn a `SourceCandidate` into an immutable `SourceSnapshot`.

### Reads

```text
SourceCandidate
```

### Writes

```text
SourceSnapshot
ParsedSourceText
SnapshotWarning
```

### Allowed Tools

```text
fetch_url
parse_html
parse_pdf
screenshot_page
hash_content
```

### Forbidden Actions

- Generate facts.
- Generate claims.
- Modify source meaning.
- Drop parse warnings silently.

### Output Contract

```json
{
  "snapshot_id": "sn_001",
  "source_id": "src_001",
  "retrieved_at": "2026-05-16T00:30:00+08:00",
  "content_hash": "sha256:abc",
  "raw_storage_uri": "snapshots/sn_001/raw.html",
  "text_storage_uri": "snapshots/sn_001/clean.txt",
  "parser_version": "html-parser-v1.2.0",
  "warnings": []
}
```

### Quality Gates

- Must include `content_hash`.
- Must include `retrieved_at`.
- Must preserve raw or cleaned text.

### Failure Conditions

```text
fetch_failed
unsupported_content_type
empty_content
content_too_large
```

## Extractor Agent

### Purpose

Extract exact evidence spans and atomic facts from source snapshots.

### Reads

```text
SourceSnapshot
ParsedSourceText
AnalysisDimension
```

### Writes

```text
EvidenceSpan[]
AtomicFact[]
ExtractionWarning[]
```

### Allowed Tools

```text
read_snapshot
structured_llm_extract
table_parser
```

### Forbidden Actions

- Write claims.
- Write insights.
- Fill gaps from model knowledge.
- Turn inference into fact.

### Output Contract

```json
{
  "evidence_spans": [
    {
      "evidence_id": "ev_041",
      "snapshot_id": "sn_001",
      "quote": "Enterprise plan includes SSO, audit logs, and advanced admin controls.",
      "location": {
        "text_offset_start": 1280,
        "text_offset_end": 1364
      },
      "evidence_type": "direct_text",
      "extraction_confidence": 0.94
    }
  ],
  "atomic_facts": [
    {
      "fact_id": "fact_012",
      "statement": "Notion Enterprise plan includes SSO, audit logs, and advanced admin controls.",
      "evidence_ids": ["ev_041"],
      "dimension": "enterprise_readiness"
    }
  ]
}
```

### Quality Gates

- Every `AtomicFact` must cite at least one `EvidenceSpan`.
- Every `EvidenceSpan` must locate into a `SourceSnapshot`.
- Fact statements must be small, specific, and source-close.

### Failure Conditions

```text
evidence_span_without_snapshot
atomic_fact_without_evidence
unsupported_extraction
```

## Knowledge Structuring Agent

### Purpose

Map atomic facts into the Competitive Knowledge Schema.

### Reads

```text
AtomicFact
EvidenceSpan
AnalysisProject
CompetitorProfile
```

### Writes

```text
KnowledgeItem[]
ProductCapability[]
PricingProfile[]
EnterpriseReadinessProfile[]
CustomerSignal[]
```

### Allowed Tools

```text
schema_mapper
structured_llm_classify
```

### Forbidden Actions

- Generate strategic claims.
- Generate recommendations.
- Ignore `unknown`, `not_found`, or `conflicting` states.

### Output Contract

```json
{
  "knowledge_items": [
    {
      "id": "ki_001",
      "competitor_id": "notion",
      "type": "enterprise_readiness",
      "dimension": "security_and_admin",
      "statement": "Notion Enterprise provides SSO, audit logs, and advanced admin controls.",
      "normalized_value": {
        "capability": "enterprise_identity_and_governance",
        "features": ["SSO", "audit_logs", "advanced_admin_controls"],
        "availability": "enterprise_plan"
      },
      "fact_ids": ["fact_012"],
      "evidence_ids": ["ev_041"],
      "confidence": 0.86
    }
  ]
}
```

### Quality Gates

- Every `KnowledgeItem` must cite `fact_ids` and `evidence_ids`.
- `type` must come from the taxonomy.
- `normalized_value` must match the selected type.

### Failure Conditions

```text
unknown_knowledge_type
missing_fact_reference
invalid_normalized_value
```

## Analyst Agent

### Purpose

Generate candidate claims and business insights from structured knowledge.

### Reads

```text
KnowledgeItem
AtomicFact
CompetitorProfile
AnalysisProject
```

### Writes

```text
CandidateClaim[]
Insight[]
```

### Allowed Tools

```text
structured_llm_reasoning
read_knowledge_base
```

### Forbidden Actions

- Use evidence-free assertions.
- Write report blocks.
- Create final publication status.
- Treat hypotheses as high-confidence claims.

### Output Contract

```json
{
  "claims": [
    {
      "claim_id": "claim_017",
      "claim_type": "strategic_inference",
      "dimension": "enterprise_readiness",
      "statement": "Notion is strengthening enterprise readiness while preserving PLG and SMB growth signals.",
      "knowledge_item_ids": ["ki_001", "ki_014"],
      "fact_ids": ["fact_012", "fact_013"],
      "supporting_evidence_ids": ["ev_041", "ev_052"],
      "status": "candidate"
    }
  ],
  "insights": [
    {
      "insight_id": "insight_001",
      "title": "Enterprise readiness is improving, but PLG remains core.",
      "claim_ids": ["claim_017"],
      "business_implication": "Enterprise evaluations may become more competitive."
    }
  ]
}
```

### Quality Gates

- Every claim must cite a `KnowledgeItem` or `AtomicFact`.
- `strategic_inference` claims must require Skeptic review.
- Every insight must cite at least one claim.

### Failure Conditions

```text
unsupported_claim
claim_without_knowledge_item
insight_without_claim
```

## FactCheck Agent

### Purpose

Judge whether candidate claims are supported by cited facts and evidence.

### Reads

```text
CandidateClaim
AtomicFact
EvidenceSpan
```

### Writes

```text
VerificationResult[]
```

### Allowed Tools

```text
read_evidence
structured_llm_judge
nli_checker_optional
```

### Forbidden Actions

- Rewrite claims.
- Generate new claims.
- Ignore cited evidence.

### Output Contract

```json
{
  "verification_results": [
    {
      "claim_id": "claim_017",
      "verdict": "PARTIALLY_SUPPORTED",
      "supported_fact_ids": ["fact_012", "fact_013"],
      "unsupported_parts": [
        "The evidence does not prove full enterprise customer shift."
      ],
      "reason": "Evidence supports enterprise-readiness strengthening but not full market transition."
    }
  ]
}
```

Allowed verdicts:

```text
SUPPORTED
PARTIALLY_SUPPORTED
REFUTED
NOT_ENOUGH_INFO
```

### Quality Gates

- Every verdict must include a reason.
- `PARTIALLY_SUPPORTED` must include unsupported parts.
- `REFUTED` must cite refuting evidence.

## Skeptic Agent

### Purpose

Actively search for counter-evidence, caveats, and alternative explanations.

### Reads

```text
CandidateClaim
KnowledgeItem
EvidenceGraph
SourcePlan
```

### Writes

```text
CounterEvidence[]
Caveat[]
OpenQuestion[]
refutes / qualifies lineage edges
```

### Allowed Tools

```text
search_web
fetch_url
read_evidence_graph
structured_llm_review
```

### Forbidden Actions

- Rewrite the final report.
- Delete claims.
- Search only for support.

### Output Contract

```json
{
  "counter_evidence": [
    {
      "claim_id": "claim_017",
      "evidence_id": "ev_073",
      "relation": "qualifies",
      "statement": "Customer stories remain SMB-heavy, so the claim should not say full enterprise shift.",
      "severity": "medium"
    }
  ],
  "open_questions": [
    {
      "question": "Has enterprise revenue share actually increased?",
      "missing_evidence_types": [
        "revenue_breakdown",
        "enterprise_customer_count"
      ]
    }
  ]
}
```

### Quality Gates

- Must attempt at least one counter-evidence strategy.
- Must output either concrete counter-evidence or `no_counter_evidence_found`.
- Must classify counter-evidence as `refutes` or `qualifies`.

## Source Quality Agent

### Purpose

Assess source reliability, freshness, and independence.

### Reads

```text
Source
SourceSnapshot
EvidenceSpan
```

### Writes

```text
SourceQualityAssessment
EvidenceCluster
```

### Allowed Tools

```text
domain_classifier
date_parser
source_clusterer
```

### Forbidden Actions

- Generate claims.
- Change evidence span text.

### Output Contract

```json
{
  "source_quality": [
    {
      "source_id": "src_001",
      "trust_tier": "official",
      "reliability_score": 0.92,
      "freshness": 0.91,
      "independence_cluster_id": "cluster_official_pricing"
    }
  ]
}
```

## Confidence Scorer

### Purpose

Compute claim confidence and publication status.

This should usually be a deterministic scoring node, not an LLM agent.

### Reads

```text
Claim
VerificationResult
SourceQualityAssessment
CounterEvidence
EvidenceGraph
```

### Writes

```text
ConfidenceScore
PublicationStatus
RouteAction
```

### Allowed Tools

```text
read_evidence_graph
score_confidence
```

### Forbidden Actions

- Generate new claims.
- Rewrite statements.
- Call external search tools.

### Output Contract

```json
{
  "claim_id": "claim_017",
  "confidence": 0.76,
  "level": "medium",
  "status": "publish_with_caveat",
  "route_action": "revise_wording",
  "score_breakdown": {
    "support_strength": 0.82,
    "source_reliability": 0.88,
    "evidence_directness": 0.8,
    "source_independence": 0.74,
    "freshness": 0.91,
    "contradiction_penalty": -0.11,
    "inference_penalty": -0.07
  }
}
```

### Quality Gates

- Must output score breakdown.
- Must output route action.
- Claims below threshold cannot be published.

## Writer Agent

### Purpose

Compose report blocks from approved claims, insights, and recommendations.

### Reads

```text
ApprovedClaim
Insight
Recommendation
AnalysisProject
ReportOutline
```

### Writes

```text
ReportBlock[]
```

### Allowed Tools

```text
structured_llm_write
read_approved_claims
```

### Forbidden Actions

- Use rejected claims.
- Put `hypothesis_only` claims in core conclusions.
- Add analytical judgments without claim support.
- Remove caveats required by the confidence scorer or critic.

### Output Contract

```json
{
  "report_blocks": [
    {
      "report_block_id": "rb_004",
      "section": "Enterprise Readiness",
      "text": "Notion is strengthening enterprise readiness, but the evidence does not yet prove a full shift to enterprise customers.",
      "claim_ids": ["claim_017"],
      "status": "draft"
    }
  ]
}
```

### Quality Gates

- Every report block must cite at least one claim.
- Caveated claims must keep limitation language.
- Raw source citations cannot replace claim citations.

## Critic Agent

### Purpose

Review whether the report is faithful to approved claims, confidence states, and evidence.

### Reads

```text
ReportBlock
Claim
Insight
Recommendation
ProvenanceGraph
ConfidenceScore
```

### Writes

```text
ReviewFinding[]
RevisionRequest[]
```

### Allowed Tools

```text
read_report
read_provenance_graph
structured_llm_review
```

### Forbidden Actions

- Silently edit the report.
- Overwrite claims.
- Lower TraceValidator requirements.

### Output Contract

```json
{
  "review_findings": [
    {
      "finding_id": "rf_008",
      "severity": "high",
      "target_type": "report_block",
      "target_id": "rb_004",
      "issue_type": "overclaiming",
      "statement": "Report says full enterprise shift, but approved claim only supports enterprise-readiness strengthening.",
      "required_action": "rewrite_report_block"
    }
  ]
}
```

### Quality Gates

- Every finding must include `target_id`.
- High-severity findings block publication.
- `required_action` must be routable by the DAG.

## TraceValidator

### Purpose

Deterministically validate report lineage before publication.

### Reads

```text
ReportBlock
Claim
KnowledgeItem
AtomicFact
EvidenceSpan
SourceSnapshot
LineageEdge
ConfidenceScore
```

### Writes

```text
TraceValidationResult
```

### Allowed Tools

```text
read_provenance_graph
validate_trace
```

### Forbidden Actions

- Generate content.
- Call LLMs.
- Bypass missing evidence.

### Output Contract

```json
{
  "report_block_id": "rb_004",
  "status": "complete_trace",
  "checks": [
    {
      "name": "report_block_has_claim",
      "passed": true
    },
    {
      "name": "claim_has_knowledge_item",
      "passed": true
    },
    {
      "name": "knowledge_item_has_evidence",
      "passed": true
    },
    {
      "name": "evidence_has_snapshot",
      "passed": true
    }
  ],
  "publish_allowed": true
}
```

Failure statuses:

```text
partial_trace
weak_trace
broken_trace
contradicted_trace
```

## AgentRun Observability

Every run must record:

```json
{
  "agent_run_id": "ar_001",
  "agent_role": "analyst",
  "workflow_run_id": "wr_001",
  "node_id": "analyze_enterprise_readiness",
  "input_artifact_ids": ["ki_001", "ki_014"],
  "output_artifact_ids": ["claim_017", "insight_001"],
  "tool_call_ids": ["tc_021"],
  "status": "succeeded",
  "started_at": "2026-05-16T00:00:00+08:00",
  "ended_at": "2026-05-16T00:00:12+08:00",
  "token_usage": {
    "input": 4200,
    "output": 900
  },
  "cost_usd": 0.04,
  "decision_summary": "Generated enterprise-readiness claim from pricing, docs, and hiring knowledge items."
}
```

Required fields:

- role
- workflow run id
- node id
- input artifact ids
- output artifact ids
- tool call ids
- status
- timing
- decision summary

## P0 Role Set

P0 should include:

```text
Research Planner
Collector
Extractor
Knowledge Structuring
Analyst
Skeptic
Confidence Scorer
Writer
Critic
TraceValidator
```

P0 can merge or defer:

```text
Snapshot as a tool, not a separate agent.
FactCheck inside Critic or Confidence Scorer.
SourceQuality inside Confidence Scorer.
```

## P1 Role Split

P1 should split out:

```text
Snapshot Agent
FactCheck Agent
Source Quality Agent
```

## P2 Role Extensions

P2 can add:

```text
Human Review Node
Eval Judge Agent
Report Export Agent
Monitoring Agent
```

## Relationship To Core Designs

```text
Competitive Knowledge Schema:
  Defines what agents write.

DAG Agent Orchestration:
  Defines when agents run and how follow-up routes are scheduled.

Agent Role Contracts:
  Defines what each agent can read, write, call, and publish.

Provenance Graph:
  Records where each agent output came from.

Confidence Scoring:
  Decides whether claims are trustworthy enough to route forward.

Trace Validator:
  Blocks report publication if the evidence chain is broken.
```

## Final Decision

Freeze this as the role-boundary strategy:

```text
Agent Role Contracts
```

Definition:

```text
Each agent is a bounded role with explicit input artifact types, output artifact
types, tool permissions, forbidden actions, schema validation, quality gates,
failure modes, provenance write rules, and observability requirements. Agents
collaborate through typed artifacts and shared evidence state, not hidden
free-form conversation.
```
