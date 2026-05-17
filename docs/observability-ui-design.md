# RivalScope Observability UI Design

## Purpose

The RivalScope UI is not a report viewer. It is the control plane for an
auditable multi-agent competitive intelligence workflow.

The UI must let a judge or product user answer:

```text
What did the agents do?
Which sources were collected?
Which exact evidence supports this claim?
How was confidence calculated?
What did the Critic, Skeptic, and TraceValidator catch?
How does RivalScope compare with weaker baselines?
```

The UI should make RivalScope feel like an intelligence operations console, not
a chatbot and not a marketing dashboard.

The AI-native product lesson is that a pretty generated report is cheap. The UI
must prove the harder thing: the system can preserve evidence, challenge itself,
show its work, and help a human make a better decision.

## Design Name

Competitive Intelligence Operations Console.

Chinese positioning:

```text
竞品情报作战台
```

Final product principle:

```text
Tables handle review at scale.
Inspectors explain the selected object.
Graphs explain lineage and workflow relationships.
Reports communicate the final decision.
```

## Visual Direction

Use a calm enterprise SaaS style:

- Background: `#F6F7F9`.
- Work surfaces: white.
- Primary: deep teal for trusted evidence and primary actions.
- Secondary: muted blue-gray for workflow and neutral controls.
- Warning: amber for caveats, weak evidence, and needs-review states.
- Danger: red for refuted claims, blocked traces, and high-risk findings.
- Success: green for validation and approved states.

Avoid:

- marketing landing-page composition
- large hero sections
- decorative gradients
- AI glow
- futuristic dark dashboards
- oversized cards
- decorative graph backgrounds
- chat-first UI

Prefer:

- dense tables
- tabs
- status chips
- evidence chips
- right-side inspectors
- drawers
- timelines
- graph canvases
- compact typography
- enterprise workflow spacing

Typography should stay compact:

- 12-13px for metadata and tables.
- 14px for primary UI text.
- 16px for section body copy.
- 20-24px for page titles.

## Global Navigation

Top navigation should be consistent across pages:

- RivalScope logo.
- `New Analysis`.
- `Run Demo Case`.
- `Docs`.
- `Benchmark`.
- Notifications.
- User avatar.

The main product should open directly into working surfaces. Do not add a
marketing homepage.

## Information Architecture

Primary pages:

1. Home / Project Workspace.
2. New Analysis Wizard.
3. Project Cockpit / Main Workbench.
4. Source & Evidence Library.
5. Claim Review Workbench.
6. Report Studio.
7. Evaluation Dashboard.
8. Agent DAG Canvas.
9. Provenance Graph Canvas.

The default demo path should start from Project Cockpit, not Home.

Hard IA rules:

- Do not collapse the product into one `/projects/[projectId]` page.
- Project Cockpit is the control plane and entry surface. It is not the full
  Source Library, full Claim Review, full Report Studio, full Evaluation view,
  or full graph explorer.
- Source & Evidence Library, Claim Review Workbench, Agent DAG Canvas, and
  Provenance Graph Canvas must be separate routes or first-class primary views.
- Report Studio and Evaluation Dashboard may start as demo-quality views, but
  they should still have clear route/view boundaries.
- If the UI only has one project detail page with many stacked sections, Module
  C is not accepted.

Recommended route map:

```text
/projects/[projectId]
  Project Cockpit / Main Workbench

/projects/[projectId]/sources
  Source & Evidence Library

/projects/[projectId]/claims
  Claim Review Workbench

/projects/[projectId]/report
  Report Studio

/projects/[projectId]/evaluation
  Evaluation Dashboard

/projects/[projectId]/dag
  Agent DAG Canvas

/projects/[projectId]/provenance
  Provenance Graph Canvas
```

Canvas language:

- Full canvas pages:
  - Agent DAG Canvas.
  - Provenance Graph Canvas.
- Embedded previews:
  - Project Cockpit should include an Agent DAG mini-map and a compact
    provenance preview.
  - Claim Review should include a selected-claim provenance rail.
  - Report Studio should expose evidence chips that open provenance details.
- A vertical workflow timeline is useful but does not replace Agent DAG Canvas.
- A text or pill chain is useful but does not replace Provenance Graph Canvas.
- Graph/canvas elements should be audit surfaces, not decoration.

## Page 1: Home / Project Workspace

Purpose:

Show that RivalScope is a real project workspace, not a single demo prompt.

Content:

- Project list with dense card/table hybrid rows.
- Project name and short description.
- Competitor chips.
- Dimension chips.
- Latest run status.
- Trust score.
- Claims count.
- Evidence count.
- Open findings.
- Last updated time.
- Trust trend.
- Recent runs sidebar.
- Trust / AgentOps summary sidebar.
- Demo datasets sidebar.

Recommended project rows:

- Enterprise AI Coding Assistants Q2 Review.
- AI Search & Research Tools Market Scan.
- Video Creation Platforms GTM Review.
- Developer Tooling Pricing Watch.
- Enterprise Browser Assistants Landscape.

Implementation note:

Rows should be compact enough to show multiple projects without scrolling too
much. Use a table-card hybrid, not big marketing cards.

## Page 2: New Analysis Wizard

Purpose:

Let users configure a competitive intelligence project and source strategy.

Structure:

Four-step wizard:

1. Scope.
2. Competitors.
3. Dimensions.
4. Source Strategy.

Fields:

- project name
- analysis goal
- target user / decision context
- competitor list
- primary competitor
- competitor aliases
- dimensions
- source strategy

Dimension options:

- Pricing.
- Positioning.
- Product Capability.
- Enterprise Readiness.
- GTM.
- Developer Experience.
- Risks.
- Security.
- Integrations.

Source strategy cards:

- Demo Fixture Sources.
- Public Web Search.
- Manual Seed URLs.
- Official Documentation.
- Pricing Pages.
- Changelogs.
- News / Reviews.
- Upload Notes.

Right sidebar:

- estimated DAG nodes
- expected source count
- evidence snapshot mode
- model mode: Mock / Real
- evaluation fixture toggle
- advanced options
- start analysis button

Demo defaults should be realistic:

```text
Estimated DAG nodes: 18-30
Expected sources: 40-80
```

Use larger numbers only when explicitly showing a benchmark/full run.

## Page 3: Project Cockpit / Main Workbench

Purpose:

The main demo page. It should combine Agent DAG visibility, claim review,
confidence, provenance, and validation.

Layout:

```text
Top Navigation
Project Header
Quality Metric Strip
Three-column Workbench
```

Project header:

- title
- status chip
- project id
- created by
- updated time
- competitor chips
- Run DAG
- Resume
- Evaluate
- Export Report

Metric strip:

- Run Status.
- Trust Score.
- Insight Score.
- AgentOps Score.
- Evidence Coverage.
- Claims Needing Attention.
- Cost.
- Latency.
- Last Run.

Three-column workbench:

- Left: Agent DAG Timeline.
- Center: tabbed workspace.
- Right: selected-object Inspector.

Tabs:

- Overview.
- Sources.
- Evidence.
- Claims.
- Report.
- Evaluation.
- Runs.

Default selected tab for the demo:

```text
Claims
```

Left Agent DAG Timeline:

- Research Planner.
- Collector.
- Snapshot Parser.
- Extractor.
- Knowledge Structurer.
- Analyst.
- Skeptic.
- Confidence Scorer.
- Writer.
- Critic.
- Trace Validator.

Each row should show:

- status.
- duration.
- retry count.
- artifact count.
- tool calls.
- model calls.

Right Inspector should adapt to selection:

- selected claim
- selected source
- selected evidence span
- selected DAG node
- selected model run
- selected tool call

Important:

Run status and node status must not conflict. If TraceValidator is still running,
the run status should be `Validating`, not `Completed`.

## Page 4: Source & Evidence Library

Purpose:

Prove that source acquisition is auditable.

Layout:

- Left: Source table.
- Right: selected SourceSnapshot and EvidenceSpan preview.

Source table columns:

- Title.
- Type.
- Competitor.
- Dimension.
- Trust Tier.
- Freshness.
- Policy Status.
- Snapshot Status.
- Duplicate Group.
- EvidenceSpan Count.

Source tags:

- official.
- pricing.
- docs.
- changelog.
- news.
- review.
- community.
- unknown.

Selected source panel:

- source title
- canonical URL
- final URL
- retrieved time
- content hash
- parser version
- fetch backend
- policy decision
- source quality
- duplicate/source family
- source type tags

Document preview:

- parsed text with highlighted EvidenceSpan ranges.
- EvidenceSpan tooltip with id, confidence, used-by counts, and provenance link.

Used-by section:

- AtomicFacts.
- Claims.
- ReportBlocks.

Source quality should eventually expose:

- authority
- freshness
- independence
- relevance

## Page 5: Claim Review Workbench

Purpose:

Review, filter, validate, and publish claim-level conclusions.

Layout:

- Left: collapsible claim filters.
- Center: dense claims table.
- Right: Claim Inspector.

Filter groups:

- competitor
- dimension
- support verdict
- confidence bucket
- has counter evidence
- has critic finding
- publication status

Claims table columns:

- Claim.
- Competitor.
- Dimension.
- Claim Type.
- Support Verdict.
- Confidence.
- Evidence Count.
- Counter Evidence.
- Source Quality.
- Freshness.
- Status.
- Findings.

Claim Inspector:

- claim id
- claim statement
- confidence score
- score factors
- support verdict
- provenance chain
- supporting evidence
- counter evidence
- Skeptic findings
- Critic findings
- TraceValidator result
- publication actions

Confidence score factors:

```text
+ Evidence Support
+ Source Quality
+ Evidence Directness
+ Source Independence
+ Freshness Fit
- Contradiction Penalty
= Confidence
```

Publication actions:

- Approve.
- Downgrade to Hypothesis.
- Request More Evidence.
- Remove from Report.

Actions should be state-aware:

- Approved claims show Reopen Review rather than a primary Approve button.
- Insufficient claims prioritize Request More Evidence and Publish as
  Hypothesis.
- Refuted claims prioritize Keep Rejected or Request Recheck.

## Page 6: Report Studio

Purpose:

Show the final report as a professional strategy report with claim-level
evidence, confidence, caveats, and trace validation.

Layout:

- Left: report document/editor.
- Right: current block Inspector.
- Bottom: revision status timeline.

Report sections:

- Executive Summary.
- Competitive Matrix.
- Key Findings.
- Dimension Deep Dives.
- Risks & Contradictions.
- Recommendations.
- Open Questions.
- Appendix: Evidence.

Each report block should show evidence chips:

- Claim id.
- Confidence.
- Evidence span count.
- Trace passed.
- Caveat.
- Counter evidence count.

Right Inspector:

- selected report block id
- linked claims
- confidence
- supporting evidence
- source snapshots
- critic findings
- TraceValidator result
- Open Provenance Graph button

Important:

Report Studio should feel like a strategy report editor, not only a report
outline. Use natural report paragraphs and tables, with compact metadata chips
attached to blocks.

## Page 7: Evaluation Dashboard

Purpose:

Prove RivalScope quality through repeatable benchmarks and baseline comparison.

Top controls:

- Benchmark case selector.
- Run Eval.
- Compare Baselines.
- Export Results.
- Dataset/version selector.

Summary metrics:

- Overall Score.
- Trust Score.
- Insight Score.
- AgentOps Score.
- Efficiency Score.
- Seeded Defect Catch Rate.
- Trace Completeness.

Baseline comparison rows:

- `single_llm_report`.
- `standard_rag_report`.
- `linear_agent_pipeline`.
- `rivalscope_full_system`.

Metric columns:

- Trust Score.
- Insight Score.
- AgentOps Score.
- Efficiency Score.
- Citation Precision.
- Citation Coverage.
- Claim Support Rate.
- Unsupported Published Claim Rate.
- Trace Completeness.
- Role Violations.
- Critic Catch Rate.
- Recommendation Actionability.

Seeded defects table:

- Injected defect.
- Caught by.
- Severity.
- Route.
- Passed / Failed.

Example defects:

- Wrong competitor citation.
- Stale pricing source.
- Unsupported recommendation.
- Writer used rejected claim.
- Prompt injection in source text.
- Broken provenance link.

Important:

Metrics must be internally consistent. If Seeded Defect Catch Rate is high, the
seeded defect table should mostly show Passed, not mostly Failed.

Use realistic finding counts:

```text
Open Eval Findings: 7
Critical: 0
High: 2
Medium: 5
Low: 0
```

Avoid presenting a high overall score alongside many critical failures.

## Page 8: Agent DAG Canvas

Purpose:

Visualize how specialized agents collaborate through a typed DAG.

Canvas nodes:

- Research Planner.
- Collector.
- Snapshot Parser.
- Extractor.
- Knowledge Structurer.
- Analyst.
- Skeptic.
- Confidence Scorer.
- Writer.
- Critic.
- Trace Validator.

Node cards show:

- agent name
- status
- duration
- input artifacts
- output artifacts
- tool calls
- model calls
- findings count

Edge types:

- `artifact_flow`
- `review_feedback`
- `targeted_research`
- `publication_gate`
- `validated_by`

Controls:

- search node
- status filter
- type filter
- agent filter
- legend
- zoom
- fit view
- minimap

Right Node Inspector:

- AgentRun.
- Input artifacts.
- Output artifacts.
- ModelRun.
- ToolCalls.
- Schema validation.
- Role contract validation.
- Warnings.
- Errors.

Status note:

If warning edges or unresolved gates remain, show `Completed with Warnings`,
`Needs Review`, or `Validating`, not plain `Completed`.

## Page 9: Provenance Graph Canvas

Purpose:

Audit how one report conclusion traces back to frozen evidence.

Default centered node:

```text
Claim CLM-0312
```

Backward lineage:

```text
SourceSnapshot
  -> EvidenceSpan
  -> AtomicFact
  -> Claim
```

Forward lineage:

```text
Claim
  -> Insight
  -> Recommendation
  -> ReportBlock
```

Review and validation nodes:

- SkepticFinding.
- CriticFinding.
- ConfidenceScore.
- TraceValidatorResult.
- CounterEvidence.

Node types:

- SourceSnapshot: document node.
- EvidenceSpan: quote node.
- AtomicFact: fact node.
- Claim: deep teal assertion node.
- Insight: blue node.
- Recommendation: action node.
- ReportBlock: document section node.
- Finding: amber/red warning node.
- TraceValidator: green shield/check node.

Edge labels:

- supports.
- refutes.
- derived_from.
- cites.
- validated_by.
- blocked_by.
- revised_to.

Controls:

- Depth: 1 / 2 / 3 / Full.
- Show toggles: Evidence, Facts, Claims, Findings, Report Blocks.
- Highlight: Supporting, Counter, Broken.
- Zoom.
- Fit view.
- Minimap.
- Search node.

Right Node Inspector:

- metadata.
- evidence quote.
- source URL.
- retrieved time.
- content hash.
- confidence contribution.
- used-by facts/claims/report blocks.

The graph must be a product feature for audit, not decorative background art.

## Core Interaction Patterns

### Table + Inspector

Primary review pages should use:

```text
left/center table
right inspector
```

This supports high-density review while keeping details available.

### Evidence Chips

Evidence chips appear beside claims and report blocks:

- claim id
- confidence
- evidence count
- trace status
- caveat / counter evidence count

Clicking a chip opens the provenance drawer or graph.

### Provenance Drawer

The drawer should show:

```text
ReportBlock -> Claim -> AtomicFact -> EvidenceSpan -> SourceSnapshot
```

It should include supporting evidence, counter evidence, review findings, and
TraceValidator status.

### Graph Canvas

Canvas views explain relationships:

- Agent DAG Canvas explains process.
- Provenance Graph Canvas explains evidence lineage.

Do not use graph canvases as decoration.

### Status Chips

Status chips must be consistent across pages and use the status taxonomy below.

## Status Taxonomy

Run status:

- Not Started.
- Running.
- Validating.
- Needs Review.
- Completed.
- Completed with Warnings.
- Failed.

Report status:

- Draft.
- Ready for Review.
- Approved.
- Published.
- Published with Caveats.

Claim status:

- Draft.
- Approved.
- Published.
- Published with Caveat.
- Hypothesis Only.
- Rejected.
- Needs More Evidence.

Trace status:

- Pending.
- Valid.
- Broken.
- Contradicted.
- Needs Review.

Support verdict:

- Supported.
- Partially Supported.
- Insufficient.
- Refuted.
- Not Checkable.

Policy status:

- Allowed.
- Needs Review.
- Blocked.

## Demo Data Consistency

Use consistent numbers across demo pages.

Recommended small demo run:

```text
Sources: 146
SourceSnapshots: 187
EvidenceSpans: 512
AtomicFacts: 231
Claims: 63
Findings: 47
ToolCalls: 1,024
Project run cost: $8.42
Latency: 18m 42s
```

Recommended benchmark run:

```text
Documents: 1,248
Claims: 6,341
Seeded defects: 12
Benchmark eval cost: $42.18
```

Do not mix small project run cost and full benchmark cost without labeling.

## Implementation Priority

### P0

- Project Cockpit with Claims tab.
- Agent DAG Timeline.
- Claim Inspector.
- Evidence chips.
- Compact provenance chain.
- Source & Evidence Library basic view.
- Report Studio basic view.

### P1

- Claim Review Workbench full-screen mode.
- SourceSnapshot metadata and EvidenceSpan highlighting.
- ModelRun / ToolCall observability detail.
- Evaluation Dashboard baseline table.
- Provenance Graph Canvas.
- Agent DAG Canvas.

### P2

- Human review queue.
- Snapshot diff.
- Confidence calibration charts.
- Prompt version evaluation comparison.
- Competitive Knowledge Map.
- Full graph search and filters.

## Demo Path

Recommended competition demo flow:

1. Open Project Cockpit.
2. Show Agent DAG Timeline and run status.
3. Open Sources tab and show SourceSnapshot + EvidenceSpan highlight.
4. Open Claims tab and select a claim.
5. Explain confidence breakdown and supporting/counter evidence.
6. Open Provenance Graph Canvas.
7. Open Agent DAG Canvas and show review feedback loops.
8. Open Report Studio and show evidence chips.
9. Open Evaluation Dashboard and compare RivalScope with baselines.

The story should be:

```text
We do not only generate a report.
We operate, inspect, validate, and evaluate an AI research workflow.
```

## Final Decision

Freeze this as the UI strategy:

```text
Competitive Intelligence Operations Console

Definition:
An enterprise-grade product interface for operating and auditing RivalScope's
multi-agent competitive intelligence workflow. The UI exposes project runs,
source snapshots, evidence spans, claims, confidence scoring, provenance,
review findings, report blocks, DAG execution, model/tool observability, and
evaluation benchmarks through dense tables, inspectors, evidence chips,
drawers, and graph canvases.
```
