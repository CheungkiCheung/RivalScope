# RivalScope Competitive Knowledge Schema Design

## Purpose

This document freezes RivalScope's custom competitive-intelligence knowledge schema.

The schema is not a report outline and not just a database model. It is the shared intermediate language used by agents to turn public evidence into reusable competitor intelligence.

The design name is:

```text
Competitive Knowledge Schema
```

Chinese positioning:

```text
竞品知识 Schema
```

## North Star

All agents should collaborate through typed knowledge objects:

```text
SourceSnapshot
  -> EvidenceSpan
  -> AtomicFact
  -> KnowledgeItem
  -> Claim
  -> Insight
  -> Recommendation
  -> ReportBlock
```

This schema answers:

```text
What do we know about each competitor, in what structured category,
from which evidence, at what confidence level, and with what business implication?
```

## Design Principles

1. Separate fact from interpretation.
2. Separate product capability from business strategy.
3. Separate single-competitor knowledge from cross-competitor comparison.
4. Separate claims, insights, recommendations, and open questions.
5. Preserve evidence ids, provenance links, and confidence metadata on every object.
6. Never let low-confidence hypotheses masquerade as final conclusions.
7. Prefer explicit `unknown` / `not_found` / `conflicting` states over false certainty.
8. Make the schema useful to agents, UI, evals, and storage.

## Knowledge Layers

| Layer | Role |
| --- | --- |
| Project Context | Defines the analysis goal, subject product, competitors, dimensions, audience, and time window. |
| Competitor Identity | Defines stable competitor profiles, aliases, product lines, and comparison roles. |
| Product Knowledge | Captures capabilities, AI features, integrations, security, admin, and workflow coverage. |
| Market And Customer Knowledge | Captures ICP, customer segments, reviews, customer stories, and market signals. |
| GTM And Business Knowledge | Captures pricing, packaging, distribution, channels, partnerships, and growth motion. |
| Evidence-Backed Claims | Captures validated analytical conclusions. |
| Insights And Recommendations | Captures business interpretation and suggested actions. |
| Uncertainty And Open Questions | Captures low-confidence signals, missing evidence, and follow-up research needs. |

## Core Object Set

P0 object set:

```text
AnalysisProject
CompetitorProfile
SourceSnapshot
EvidenceSpan
AtomicFact
KnowledgeItem
Claim
Insight
Recommendation
OpenQuestion
ReportBlock
```

P1 adds specialized profiles:

```text
ProductCapability
PricingProfile
EnterpriseReadinessProfile
CustomerProfile
PositioningProfile
GTMProfile
CustomerSignal
MarketSignal
RiskSignal
OpportunitySignal
```

P2 adds higher-level analysis products:

```text
FeatureMatrix
CompetitorScorecard
StrategicRiskMap
OpportunityMap
CompetitiveTimeline
```

## AnalysisProject

The project defines what the agents should analyze.

```json
{
  "project_id": "project_001",
  "subject_product": {
    "name": "Feishu Docs",
    "category": "collaboration_and_knowledge_workspace",
    "description": "Enterprise collaboration document and knowledge workspace"
  },
  "competitors": ["notion", "confluence", "yuque"],
  "analysis_goal": "Compare AI capability, enterprise readiness, pricing strategy, and growth risk.",
  "required_dimensions": [
    "ai_capability",
    "enterprise_readiness",
    "pricing_strategy",
    "gtm_motion",
    "customer_segments",
    "strategic_risk"
  ],
  "report_audience": "product_strategy_team",
  "time_window": {
    "freshness_required_days": 180
  },
  "schema_version": "competitive-knowledge-v1"
}
```

The Research Planner Agent uses this object to create the source plan and DAG branches.

## CompetitorProfile

```json
{
  "competitor_id": "notion",
  "name": "Notion",
  "website": "https://www.notion.com",
  "category": "collaboration_workspace",
  "company_type": "private_company",
  "primary_markets": ["global", "north_america", "europe"],
  "product_lines": [
    {
      "product_line_id": "notion_workspace",
      "name": "Notion Workspace",
      "category": "docs_knowledge_project_management"
    }
  ],
  "aliases": ["Notion AI", "Notion Enterprise"],
  "comparison_role": "direct_competitor"
}
```

Allowed `comparison_role` values:

```text
direct_competitor
indirect_competitor
substitute
benchmark
adjacent_player
```

## KnowledgeItem

`KnowledgeItem` is the central intermediate object. It sits between atomic facts and analytical claims.

Atomic facts are small and close to source text. Claims are analytical conclusions. Knowledge items normalize facts into competitor-analysis categories.

Example:

```text
AtomicFact:
Notion Enterprise plan includes SSO.

KnowledgeItem:
Notion has enterprise identity-management capability.

Claim:
Notion is strengthening enterprise readiness while preserving PLG and SMB signals.
```

Schema:

```json
{
  "id": "ki_001",
  "project_id": "project_001",
  "competitor_id": "notion",
  "type": "enterprise_readiness",
  "dimension": "security_and_admin",
  "statement": "Notion Enterprise provides SSO, audit logs, and advanced admin controls.",
  "normalized_value": {
    "capability": "enterprise_identity_and_governance",
    "features": ["SSO", "audit_logs", "advanced_admin_controls"],
    "availability": "enterprise_plan"
  },
  "fact_ids": ["fact_012", "fact_013"],
  "evidence_ids": ["ev_041", "ev_052"],
  "confidence": 0.86,
  "freshness": 0.91,
  "source_reliability": 0.92,
  "created_by_agent_run_id": "ar_extract_002",
  "schema_version": "competitive-knowledge-v1"
}
```

## KnowledgeItem Taxonomy

P0 item types:

```text
product_capability
pricing_model
target_customer
positioning
gtm_motion
enterprise_readiness
ai_capability
integration_ecosystem
customer_signal
market_signal
risk_signal
opportunity_signal
```

Every `KnowledgeItem` must include:

- `project_id`
- `competitor_id`
- `type`
- `dimension`
- `statement`
- `fact_ids`
- `evidence_ids`
- `confidence`
- `schema_version`

## ProductCapability

Use this object when a capability deserves first-class modeling beyond a generic `KnowledgeItem`.

```json
{
  "id": "cap_001",
  "competitor_id": "notion",
  "category": "ai_capability",
  "capability_name": "AI writing and knowledge assistance",
  "description": "Notion AI supports writing, summarization, Q&A, and workspace knowledge retrieval.",
  "maturity": "medium_high",
  "availability": {
    "plans": ["business", "enterprise"],
    "add_on": true
  },
  "differentiation_level": "medium",
  "evidence_ids": ["ev_101", "ev_102"],
  "fact_ids": ["fact_201", "fact_202"],
  "confidence": 0.82
}
```

Capability categories:

```text
core_workflow
ai_capability
collaboration
knowledge_management
project_management
security
admin_governance
integration
automation
developer_platform
mobile
analytics
```

Maturity levels:

```text
unknown
basic
medium
medium_high
advanced
market_leading
```

Differentiation levels:

```text
commodity
parity
differentiated
strongly_differentiated
unclear
```

## EnterpriseReadinessProfile

Use non-binary states because public evidence often proves only "found" or "not found," not absolute support.

Allowed status values:

```text
supported
not_supported
claimed
not_found
unknown
conflicting
```

Schema:

```json
{
  "id": "ent_001",
  "competitor_id": "notion",
  "identity_security": {
    "sso": "supported",
    "scim": "unknown",
    "mfa": "supported",
    "domain_management": "supported"
  },
  "governance": {
    "audit_logs": "supported",
    "admin_roles": "supported",
    "workspace_controls": "supported",
    "data_retention": "unknown"
  },
  "compliance": {
    "soc2": "claimed",
    "gdpr": "claimed",
    "hipaa": "unknown"
  },
  "deployment": {
    "cloud": "supported",
    "private_cloud": "unknown",
    "on_premise": "not_found"
  },
  "enterprise_score": 0.74,
  "evidence_ids": ["ev_041", "ev_052", "ev_066"],
  "counter_evidence_ids": ["ev_073"],
  "confidence": 0.78
}
```

## PricingProfile

Pricing should capture packaging strategy, not just price.

```json
{
  "id": "pricing_001",
  "competitor_id": "notion",
  "pricing_model": "seat_based_subscription",
  "plans": [
    {
      "name": "Free",
      "target_segment": "individuals_and_small_teams",
      "price": {
        "amount": 0,
        "currency": "USD",
        "billing_period": "monthly"
      },
      "notable_limits": ["limited collaboration or workspace limits"],
      "included_capabilities": ["basic_workspace"]
    },
    {
      "name": "Enterprise",
      "target_segment": "large_organizations",
      "price": {
        "amount": null,
        "currency": "USD",
        "billing_period": "custom"
      },
      "notable_capabilities": ["SSO", "audit_logs", "advanced_security"]
    }
  ],
  "ai_packaging": {
    "type": "add_on",
    "included_in_plans": [],
    "evidence_ids": ["ev_111"]
  },
  "pricing_strategy_claims": [
    "free_to_team_expansion",
    "enterprise_feature_locking"
  ],
  "evidence_ids": ["ev_110", "ev_111"],
  "confidence": 0.84
}
```

Pricing strategy labels:

```text
free_to_team_expansion
enterprise_feature_locking
usage_based_expansion
seat_based_expansion
ai_add_on_monetization
bundled_suite_pricing
custom_enterprise_pricing
```

## CustomerProfile

```json
{
  "id": "customer_001",
  "competitor_id": "notion",
  "segments": [
    {
      "segment": "individual_creators",
      "evidence_strength": "medium",
      "signals": ["templates", "free_plan", "creator_marketing"]
    },
    {
      "segment": "smb_teams",
      "evidence_strength": "high",
      "signals": ["team_plan", "collaboration_templates", "customer_stories"]
    },
    {
      "segment": "enterprise",
      "evidence_strength": "medium_high",
      "signals": ["enterprise_plan", "security_docs", "enterprise_sales_hiring"]
    }
  ],
  "primary_icp_inference": "dual_motion_smb_and_enterprise",
  "confidence": 0.76,
  "supporting_claim_ids": ["claim_017"],
  "counter_evidence_ids": ["ev_073"]
}
```

ICP inference labels:

```text
individual_first
smb_first
enterprise_first
plg_to_enterprise
dual_motion_smb_and_enterprise
developer_led
creator_led
sales_led
unclear
```

## PositioningProfile

```json
{
  "id": "positioning_001",
  "competitor_id": "notion",
  "taglines": ["Your connected workspace"],
  "messaging_themes": [
    {
      "theme": "all_in_one_workspace",
      "frequency": "high",
      "evidence_ids": ["ev_201", "ev_202"]
    },
    {
      "theme": "ai_assisted_work",
      "frequency": "medium",
      "evidence_ids": ["ev_203"]
    }
  ],
  "positioning_claim": "Notion positions itself as a connected workspace rather than a narrow document editor.",
  "differentiation_axis": [
    "workspace_breadth",
    "template_ecosystem",
    "flexible_database"
  ],
  "confidence": 0.81
}
```

## GTMProfile

```json
{
  "id": "gtm_001",
  "competitor_id": "notion",
  "motion": {
    "plg": "strong",
    "sales_led": "growing",
    "partner_led": "unknown",
    "community_led": "strong"
  },
  "channels": [
    {
      "channel": "template_gallery",
      "role": "activation_and_distribution",
      "evidence_ids": ["ev_301"]
    },
    {
      "channel": "enterprise_sales",
      "role": "large_account_conversion",
      "evidence_ids": ["ev_302"]
    }
  ],
  "growth_signals": [
    {
      "signal": "enterprise_sales_hiring",
      "interpretation": "Increasing sales-led capacity",
      "evidence_ids": ["ev_302"],
      "confidence": 0.72
    }
  ],
  "gtm_inference": "plg_core_with_enterprise_sales_expansion",
  "confidence": 0.75
}
```

Motion strength values:

```text
none
weak
medium
strong
growing
declining
unknown
```

## CustomerSignal

```json
{
  "id": "cust_signal_001",
  "competitor_id": "notion",
  "signal_type": "user_review_theme",
  "theme": "flexibility_and_customization",
  "sentiment": "positive",
  "frequency": "high",
  "sample_size": 128,
  "source_distribution": {
    "g2": 80,
    "reddit": 30,
    "app_store": 18
  },
  "representative_evidence_ids": ["ev_401", "ev_402", "ev_403"],
  "confidence": 0.69
}
```

Customer signals are useful for pains, satisfaction, switching triggers, and perceived differentiation. They should usually carry lower confidence than official docs for factual capability claims.

## MarketSignal, RiskSignal, And OpportunitySignal

Risk example:

```json
{
  "id": "risk_001",
  "competitor_id": "notion",
  "risk_type": "enterprise_expansion_risk",
  "statement": "Notion's enterprise-readiness improvements may increase pressure on document collaboration tools in mid-market and enterprise accounts.",
  "risk_level": "medium_high",
  "time_horizon": "6_to_12_months",
  "affected_segments": ["mid_market", "enterprise"],
  "supporting_claim_ids": ["claim_017", "claim_022"],
  "counter_claim_ids": ["claim_018"],
  "confidence": 0.73
}
```

Opportunity example:

```json
{
  "id": "opp_001",
  "competitor_id": "notion",
  "opportunity_type": "positioning_gap",
  "statement": "If competitors emphasize workspace breadth, Feishu Docs can differentiate on enterprise-grade governance and integrated collaboration workflows.",
  "affected_segments": ["enterprise"],
  "supporting_claim_ids": ["claim_017", "claim_031"],
  "confidence": 0.71
}
```

## Claim

Claims are evidence-backed analytical conclusions. They should cite facts and knowledge items.

```json
{
  "claim_id": "claim_017",
  "project_id": "project_001",
  "competitor_ids": ["notion"],
  "claim_type": "strategic_inference",
  "dimension": "enterprise_readiness",
  "statement": "Notion is strengthening enterprise readiness while preserving PLG and SMB growth signals.",
  "knowledge_item_ids": ["ki_001", "ki_014", "ki_019"],
  "fact_ids": ["fact_012", "fact_013", "fact_014"],
  "supporting_evidence_ids": ["ev_041", "ev_052", "ev_068"],
  "counter_evidence_ids": ["ev_073"],
  "confidence": 0.76,
  "status": "published_with_caveat"
}
```

Claim types:

```text
factual
comparative
trend
strategic_inference
recommendation_support
uncertain_hypothesis
```

## Insight

Insights explain why claims matter.

```json
{
  "insight_id": "insight_001",
  "project_id": "project_001",
  "title": "Enterprise readiness is improving, but PLG remains core.",
  "statement": "Competitor A is adding enterprise governance capabilities while preserving SMB and PLG distribution signals.",
  "insight_type": "strategic_interpretation",
  "claim_ids": ["claim_017", "claim_018"],
  "business_implication": "It may pressure enterprise evaluations without requiring a full shift away from SMB acquisition.",
  "confidence": 0.74,
  "limitations": [
    "Public evidence does not prove enterprise revenue share has increased."
  ],
  "generated_by_agent_run_id": "ar_analysis_003"
}
```

Insight types:

```text
strategic_interpretation
competitive_threat
market_opportunity
positioning_gap
product_gap
pricing_pressure
gtm_shift
customer_pain
uncertain_signal
```

## Recommendation

Recommendations must cite upstream insights and claims.

```json
{
  "recommendation_id": "rec_001",
  "project_id": "project_001",
  "title": "Strengthen enterprise governance positioning",
  "statement": "In enterprise sales materials, emphasize permission governance, auditability, compliance, and migration support rather than only document editing features.",
  "recommendation_type": "positioning_and_sales_enablement",
  "priority": "high",
  "effort": "medium",
  "expected_impact": "medium_high",
  "insight_ids": ["insight_001"],
  "claim_ids": ["claim_017", "claim_018"],
  "confidence": 0.72,
  "risk_if_wrong": "May over-index on enterprise messaging if SMB remains the stronger acquisition path."
}
```

Recommendation types:

```text
product_roadmap
positioning
pricing
sales_enablement
gtm
partnership
customer_research
risk_monitoring
```

## OpenQuestion

Open questions are first-class outputs. They prevent weak hypotheses from being disguised as conclusions.

```json
{
  "open_question_id": "oq_001",
  "question": "Has Competitor A's enterprise customer revenue share increased in the last 12 months?",
  "why_it_matters": "This would determine whether enterprise-readiness signals are translating into commercial traction.",
  "related_claim_ids": ["claim_017"],
  "missing_evidence_types": [
    "revenue_breakdown",
    "enterprise_customer_count",
    "sales_pipeline_signal"
  ],
  "suggested_next_steps": [
    "Look for enterprise customer case studies",
    "Monitor hiring for enterprise sales roles",
    "Search analyst reports or interviews"
  ],
  "status": "needs_research"
}
```

## TypeScript Shape

```ts
export interface CompetitiveKnowledgeBase {
  project: AnalysisProject;
  competitors: CompetitorProfile[];
  productCapabilities: ProductCapability[];
  enterpriseReadiness: EnterpriseReadinessProfile[];
  pricingModels: PricingProfile[];
  customerProfiles: CustomerProfile[];
  positioningProfiles: PositioningProfile[];
  gtmProfiles: GTMProfile[];
  customerSignals: CustomerSignal[];
  marketSignals: MarketSignal[];
  riskSignals: RiskSignal[];
  opportunitySignals: OpportunitySignal[];
  claims: Claim[];
  insights: Insight[];
  recommendations: Recommendation[];
  openQuestions: OpenQuestion[];
}
```

## Agent Responsibilities

| Agent | Reads | Writes | Must not do |
| --- | --- | --- | --- |
| Research Planner | AnalysisProject, CompetitorProfile | ResearchPlan | Generate claims or recommendations. |
| Collector | ResearchPlan | Source candidates | Infer product strategy. |
| Snapshot | Source | SourceSnapshot | Summarize or analyze. |
| Extract | SourceSnapshot | EvidenceSpan, AtomicFact | Invent missing facts. |
| Knowledge Structuring | AtomicFact, EvidenceSpan | KnowledgeItem, specialized profiles | Make strategic claims without Analyst. |
| Analyst | KnowledgeItem, AtomicFact | Claim, Insight | Use evidence-free assertions. |
| Skeptic | Claim, Evidence Graph | CounterEvidence, OpenQuestion, caveats | Rewrite the report directly. |
| Confidence Scorer | Claim, evidence, source quality | ConfidenceScore, publication status | Create new unsupported claims. |
| Writer | Approved Claim, Insight, Recommendation | ReportBlock | Use rejected or hypothesis-only claims as main conclusions. |
| Critic | ReportBlock, Claim, Provenance Graph | ReviewFinding | Silently fix without recording review result. |

## Relationship To Core Designs

```text
Competitive Knowledge Schema:
  Defines what the system knows about competitors.

DAG Agent Orchestration:
  Defines which agent produces and reviews each knowledge object.

Provenance Graph:
  Defines where each knowledge object came from.

Confidence Scoring:
  Defines how strongly each object or claim is supported.

Trace Validator:
  Defines whether knowledge can be published in the report.
```

## Implementation Priority

### P0: Shared Knowledge Layer

1. Add `AnalysisProject` shape with required dimensions and report audience.
2. Add `CompetitorProfile`.
3. Add generic `KnowledgeItem`.
4. Add claim, insight, recommendation, and open-question objects with evidence and confidence fields.
5. Add schema version fields to all major artifacts.
6. Make Analyst and Writer consume `KnowledgeItem` / approved `Claim` instead of raw source text.

### P1: Specialized Profiles

1. Add `ProductCapability`.
2. Add `PricingProfile`.
3. Add `EnterpriseReadinessProfile`.
4. Add `CustomerProfile`.
5. Add `PositioningProfile`.
6. Add `GTMProfile`.
7. Add `CustomerSignal`, `RiskSignal`, and `OpportunitySignal`.

### P2: Analytical Products

1. Add feature/capability matrix.
2. Add competitor scorecard.
3. Add strategic risk map.
4. Add opportunity map.
5. Add competitive timeline.
6. Add benchmark-ready exports for evals.

## Demo Value

The schema should let the demo show:

```text
EvidenceSpan:
Enterprise plan includes SSO.

AtomicFact:
Notion Enterprise includes SSO.

KnowledgeItem:
Notion has enterprise identity-management capability.

Claim:
Notion is strengthening enterprise readiness while preserving SMB/PLG signals.

Insight:
Enterprise readiness is improving, but PLG remains core.

Recommendation:
Feishu Docs should emphasize governance, auditability, compliance, and migration support in enterprise sales materials.
```

This is the difference between a report generator and a reusable competitive-intelligence knowledge system.

## Final Decision

Freeze this as the knowledge strategy:

```text
Competitive Knowledge Schema
```

Definition:

```text
A typed intermediate knowledge layer that turns extracted evidence into reusable
competitor intelligence objects. It separates facts, structured knowledge items,
analytical claims, business insights, recommendations, and open questions while
preserving evidence ids, confidence scores, provenance links, agent run ids, and
schema versions for every object.
```
