import type {
  AtomicFact,
  Claim,
  EvidenceSpan,
  KnowledgeItem,
  ReportBlock,
  ReviewFinding,
  SourceSnapshot
} from "@rivalscope/core";

export interface DemoSourceCandidate {
  id: string;
  competitorId: string;
  url: string;
  title: string;
  snippet: string;
  sourceType: string;
  discoveryMethod: "seed_url" | "manual" | "agent_suggested";
  discoveredAt: string;
}

export interface DemoPolicyDecision {
  candidateId: string;
  status: "allowed" | "blocked" | "requires_review";
  reason: string;
  decidedAt: string;
}

export interface DemoParsedDocument {
  id: string;
  snapshotId: string;
  title: string;
  markdown: string;
  wordCount: number;
}

const fixtureProjectId = "__PROJECT_ID__";

export const demoSourceCandidates: DemoSourceCandidate[] = [
  {
    id: "candidate_cursor_pricing",
    competitorId: "Cursor",
    url: "https://cursor.com/pricing",
    title: "Cursor pricing",
    snippet: "Cursor publishes Pro, Team, and Enterprise packaging.",
    sourceType: "pricing_page",
    discoveryMethod: "seed_url",
    discoveredAt: "2026-05-11T00:00:00.000Z"
  },
  {
    id: "candidate_codex_docs",
    competitorId: "Codex",
    url: "https://openai.com/codex",
    title: "Codex product page",
    snippet: "Codex is positioned around delegated software engineering tasks.",
    sourceType: "product_page",
    discoveryMethod: "manual",
    discoveredAt: "2026-05-11T00:00:01.000Z"
  },
  {
    id: "candidate_trae_docs",
    competitorId: "Trae",
    url: "https://trae.ai/docs",
    title: "Trae docs",
    snippet: "Trae emphasizes IDE-centered AI assistance for development workflows.",
    sourceType: "docs_page",
    discoveryMethod: "agent_suggested",
    discoveredAt: "2026-05-11T00:00:02.000Z"
  },
  {
    id: "candidate_forum_price_rumor",
    competitorId: "Cursor",
    url: "https://community.example.com/cursor-discount-rumor",
    title: "Cursor discount rumor",
    snippet: "A community post claims Cursor discounts every enterprise deal.",
    sourceType: "community_post",
    discoveryMethod: "agent_suggested",
    discoveredAt: "2026-05-11T00:00:03.000Z"
  }
];

export const demoPolicyDecisions: DemoPolicyDecision[] = demoSourceCandidates.map(
  (candidate) => ({
    candidateId: candidate.id,
    status: "allowed",
    reason: "Public source; no login, personal data, or robots restriction in fixture.",
    decidedAt: "2026-05-11T00:00:10.000Z"
  })
);

export const demoSourceSnapshots: SourceSnapshot[] = [
  {
    id: "snapshot_cursor_pricing",
    projectId: fixtureProjectId,
    sourceId: "source_cursor_pricing",
    sourceKind: "url",
    title: "Cursor pricing",
    canonicalUrl: "https://cursor.com/pricing",
    retrievedAt: "2026-05-11T00:01:00.000Z",
    contentHash: "sha256:cursor-pricing-2026-05-11",
    rawText:
      "Cursor offers Pro for individuals and Team for organizations. Enterprise customers can request annual invoicing and security review. Cursor does not publish universal enterprise discount terms.",
    metadata: {
      sourceType: "pricing_page",
      publisher: "Cursor",
      qualityScore: 0.94,
      policyStatus: "allowed"
    }
  },
  {
    id: "snapshot_codex_product",
    projectId: fixtureProjectId,
    sourceId: "source_codex_product",
    sourceKind: "url",
    title: "Codex product page",
    canonicalUrl: "https://openai.com/codex",
    retrievedAt: "2026-05-11T00:01:10.000Z",
    contentHash: "sha256:codex-product-2026-05-11",
    rawText:
      "Codex helps delegate software engineering tasks to an AI coding agent. Teams can ask Codex to investigate, edit code, run tests, and prepare changes for review.",
    metadata: {
      sourceType: "product_page",
      publisher: "OpenAI",
      qualityScore: 0.91,
      policyStatus: "allowed"
    }
  },
  {
    id: "snapshot_trae_docs",
    projectId: fixtureProjectId,
    sourceId: "source_trae_docs",
    sourceKind: "url",
    title: "Trae docs",
    canonicalUrl: "https://trae.ai/docs",
    retrievedAt: "2026-05-11T00:01:20.000Z",
    contentHash: "sha256:trae-docs-2026-05-11",
    rawText:
      "Trae focuses on IDE-centered AI assistance for development workflows. The docs emphasize coding help, context awareness, and product engineering team workflows.",
    metadata: {
      sourceType: "docs_page",
      publisher: "Trae",
      qualityScore: 0.86,
      policyStatus: "allowed"
    }
  },
  {
    id: "snapshot_cursor_forum_rumor",
    projectId: fixtureProjectId,
    sourceId: "source_cursor_forum_rumor",
    sourceKind: "url",
    title: "Cursor discount rumor",
    canonicalUrl: "https://community.example.com/cursor-discount-rumor",
    retrievedAt: "2026-05-11T00:01:30.000Z",
    contentHash: "sha256:cursor-rumor-2026-05-11",
    rawText:
      "A community commenter says Cursor discounts every enterprise contract, but provides no contract evidence and no official source.",
    metadata: {
      sourceType: "community_post",
      publisher: "Community Example",
      qualityScore: 0.38,
      policyStatus: "allowed"
    }
  }
];

export const demoParsedDocuments: DemoParsedDocument[] = demoSourceSnapshots.map(
  (snapshot) => ({
    id: `parsed_${snapshot.id}`,
    snapshotId: snapshot.id,
    title: snapshot.title,
    markdown: snapshot.rawText,
    wordCount: snapshot.rawText.split(/\s+/).length
  })
);

export const demoEvidenceSpans: EvidenceSpan[] = [
  {
    id: "span_cursor_paid_plans",
    projectId: fixtureProjectId,
    snapshotId: "snapshot_cursor_pricing",
    sourceId: "source_cursor_pricing",
    text: "Cursor offers Pro for individuals and Team for organizations.",
    startOffset: 0,
    endOffset: 60,
    quoteHash: "sha256:span-cursor-paid-plans",
    spanType: "supporting",
    qualityScore: 0.94,
    capturedAt: "2026-05-11T00:02:00.000Z"
  },
  {
    id: "span_cursor_enterprise_review",
    projectId: fixtureProjectId,
    snapshotId: "snapshot_cursor_pricing",
    sourceId: "source_cursor_pricing",
    text: "Enterprise customers can request annual invoicing and security review.",
    startOffset: 61,
    endOffset: 130,
    quoteHash: "sha256:span-cursor-enterprise-review",
    spanType: "supporting",
    qualityScore: 0.92,
    capturedAt: "2026-05-11T00:02:05.000Z"
  },
  {
    id: "span_cursor_discount_counter",
    projectId: fixtureProjectId,
    snapshotId: "snapshot_cursor_pricing",
    sourceId: "source_cursor_pricing",
    text: "Cursor does not publish universal enterprise discount terms.",
    startOffset: 131,
    endOffset: 190,
    quoteHash: "sha256:span-cursor-discount-counter",
    spanType: "counter",
    qualityScore: 0.89,
    capturedAt: "2026-05-11T00:02:10.000Z"
  },
  {
    id: "span_codex_delegation",
    projectId: fixtureProjectId,
    snapshotId: "snapshot_codex_product",
    sourceId: "source_codex_product",
    text: "Codex helps delegate software engineering tasks to an AI coding agent.",
    startOffset: 0,
    endOffset: 70,
    quoteHash: "sha256:span-codex-delegation",
    spanType: "supporting",
    qualityScore: 0.91,
    capturedAt: "2026-05-11T00:02:15.000Z"
  },
  {
    id: "span_codex_review_flow",
    projectId: fixtureProjectId,
    snapshotId: "snapshot_codex_product",
    sourceId: "source_codex_product",
    text: "Teams can ask Codex to investigate, edit code, run tests, and prepare changes for review.",
    startOffset: 71,
    endOffset: 160,
    quoteHash: "sha256:span-codex-review-flow",
    spanType: "supporting",
    qualityScore: 0.9,
    capturedAt: "2026-05-11T00:02:20.000Z"
  },
  {
    id: "span_trae_ide_workflow",
    projectId: fixtureProjectId,
    snapshotId: "snapshot_trae_docs",
    sourceId: "source_trae_docs",
    text: "Trae focuses on IDE-centered AI assistance for development workflows.",
    startOffset: 0,
    endOffset: 68,
    quoteHash: "sha256:span-trae-ide-workflow",
    spanType: "supporting",
    qualityScore: 0.86,
    capturedAt: "2026-05-11T00:02:25.000Z"
  },
  {
    id: "span_trae_context",
    projectId: fixtureProjectId,
    snapshotId: "snapshot_trae_docs",
    sourceId: "source_trae_docs",
    text: "The docs emphasize coding help, context awareness, and product engineering team workflows.",
    startOffset: 69,
    endOffset: 155,
    quoteHash: "sha256:span-trae-context",
    spanType: "supporting",
    qualityScore: 0.84,
    capturedAt: "2026-05-11T00:02:30.000Z"
  },
  {
    id: "span_cursor_rumor",
    projectId: fixtureProjectId,
    snapshotId: "snapshot_cursor_forum_rumor",
    sourceId: "source_cursor_forum_rumor",
    text: "A community commenter says Cursor discounts every enterprise contract, but provides no contract evidence and no official source.",
    startOffset: 0,
    endOffset: 118,
    quoteHash: "sha256:span-cursor-rumor",
    spanType: "context",
    qualityScore: 0.38,
    capturedAt: "2026-05-11T00:02:35.000Z"
  }
];

export const demoAtomicFacts: AtomicFact[] = [
  {
    id: "atomic_fact_cursor_paid_plans",
    projectId: fixtureProjectId,
    competitorId: "Cursor",
    dimension: "pricing",
    statement: "Cursor offers Pro for individuals and Team for organizations.",
    evidenceSpanIds: ["span_cursor_paid_plans"],
    confidence: 0.92,
    polarity: "supports",
    extractedAt: "2026-05-11T00:03:00.000Z"
  },
  {
    id: "atomic_fact_cursor_enterprise_review",
    projectId: fixtureProjectId,
    competitorId: "Cursor",
    dimension: "enterprise_readiness",
    statement: "Cursor enterprise customers can request annual invoicing and security review.",
    evidenceSpanIds: ["span_cursor_enterprise_review"],
    confidence: 0.88,
    polarity: "supports",
    extractedAt: "2026-05-11T00:03:05.000Z"
  },
  {
    id: "atomic_fact_cursor_discount_counter",
    projectId: fixtureProjectId,
    competitorId: "Cursor",
    dimension: "pricing",
    statement: "Cursor does not publish universal enterprise discount terms.",
    evidenceSpanIds: ["span_cursor_discount_counter"],
    confidence: 0.82,
    polarity: "contradicts",
    extractedAt: "2026-05-11T00:03:10.000Z"
  },
  {
    id: "atomic_fact_codex_delegation",
    projectId: fixtureProjectId,
    competitorId: "Codex",
    dimension: "positioning",
    statement: "Codex is positioned around delegated software engineering tasks.",
    evidenceSpanIds: ["span_codex_delegation", "span_codex_review_flow"],
    confidence: 0.9,
    polarity: "supports",
    extractedAt: "2026-05-11T00:03:15.000Z"
  },
  {
    id: "atomic_fact_trae_ide",
    projectId: fixtureProjectId,
    competitorId: "Trae",
    dimension: "developer_experience",
    statement: "Trae emphasizes IDE-centered AI assistance for development workflows.",
    evidenceSpanIds: ["span_trae_ide_workflow", "span_trae_context"],
    confidence: 0.85,
    polarity: "supports",
    extractedAt: "2026-05-11T00:03:20.000Z"
  },
  {
    id: "atomic_fact_cursor_rumor",
    projectId: fixtureProjectId,
    competitorId: "Cursor",
    dimension: "pricing",
    statement: "A community commenter claims Cursor discounts every enterprise contract.",
    evidenceSpanIds: ["span_cursor_rumor"],
    confidence: 0.35,
    polarity: "context",
    extractedAt: "2026-05-11T00:03:25.000Z"
  }
];

export const demoKnowledgeItems: KnowledgeItem[] = [
  {
    id: "knowledge_cursor_pricing",
    projectId: fixtureProjectId,
    competitorId: "Cursor",
    dimension: "pricing",
    label: "Published packaging",
    summary: "Cursor publicly describes individual and team paid plans.",
    atomicFactIds: ["atomic_fact_cursor_paid_plans"],
    confidence: 0.9
  },
  {
    id: "knowledge_codex_positioning",
    projectId: fixtureProjectId,
    competitorId: "Codex",
    dimension: "positioning",
    label: "Delegated coding agent",
    summary: "Codex is framed as an agent that can investigate, edit, test, and prepare code changes.",
    atomicFactIds: ["atomic_fact_codex_delegation"],
    confidence: 0.89
  },
  {
    id: "knowledge_trae_developer_experience",
    projectId: fixtureProjectId,
    competitorId: "Trae",
    dimension: "developer_experience",
    label: "IDE workflow emphasis",
    summary: "Trae concentrates on IDE-centered workflow assistance for engineering teams.",
    atomicFactIds: ["atomic_fact_trae_ide"],
    confidence: 0.84
  }
];

export const demoClaims: Claim[] = [
  {
    id: "claim_cursor_paid_plans",
    projectId: fixtureProjectId,
    dimension: "pricing",
    statement: "Cursor has multiple paid plan types for individuals and organizations.",
    factIds: ["atomic_fact_cursor_paid_plans"],
    evidenceSpanIds: ["span_cursor_paid_plans"],
    confidence: 0.88,
    confidenceBreakdown: {
      evidenceStrength: 0.9,
      sourceQuality: 0.94,
      freshness: 0.92,
      corroboration: 0.72,
      counterEvidencePenalty: 0
    },
    sourceQuality: 0.94,
    freshness: 0.92,
    counterEvidenceCount: 0,
    kind: "single_competitor",
    type: "pricing",
    status: "approved",
    verdict: "supported"
  },
  {
    id: "claim_cursor_enterprise_discount",
    projectId: fixtureProjectId,
    dimension: "pricing",
    statement: "Cursor universally discounts enterprise contracts.",
    factIds: [
      "atomic_fact_cursor_rumor",
      "atomic_fact_cursor_discount_counter"
    ],
    evidenceSpanIds: ["span_cursor_rumor", "span_cursor_discount_counter"],
    confidence: 0.34,
    confidenceBreakdown: {
      evidenceStrength: 0.38,
      sourceQuality: 0.5,
      freshness: 0.86,
      corroboration: 0.18,
      counterEvidencePenalty: 0.42
    },
    sourceQuality: 0.5,
    freshness: 0.86,
    counterEvidenceCount: 1,
    kind: "single_competitor",
    type: "pricing",
    status: "rejected",
    verdict: "refuted"
  },
  {
    id: "claim_codex_delegated_workflow",
    projectId: fixtureProjectId,
    dimension: "positioning",
    statement: "Codex competes on delegated coding-agent workflow rather than only inline completion.",
    factIds: ["atomic_fact_codex_delegation"],
    evidenceSpanIds: ["span_codex_delegation", "span_codex_review_flow"],
    confidence: 0.86,
    confidenceBreakdown: {
      evidenceStrength: 0.88,
      sourceQuality: 0.91,
      freshness: 0.9,
      corroboration: 0.7,
      counterEvidencePenalty: 0
    },
    sourceQuality: 0.91,
    freshness: 0.9,
    counterEvidenceCount: 0,
    kind: "single_competitor",
    type: "positioning",
    status: "approved",
    verdict: "supported"
  },
  {
    id: "claim_trae_team_workflows",
    projectId: fixtureProjectId,
    dimension: "developer_experience",
    statement: "Trae may appeal most to product engineering teams that want IDE-local assistance.",
    factIds: ["atomic_fact_trae_ide"],
    evidenceSpanIds: ["span_trae_ide_workflow", "span_trae_context"],
    confidence: 0.62,
    confidenceBreakdown: {
      evidenceStrength: 0.72,
      sourceQuality: 0.86,
      freshness: 0.88,
      corroboration: 0.42,
      counterEvidencePenalty: 0
    },
    sourceQuality: 0.86,
    freshness: 0.88,
    counterEvidenceCount: 0,
    kind: "single_competitor",
    type: "capability",
    status: "needs_evidence",
    verdict: "needs_more_evidence"
  },
  {
    id: "claim_ai_coding_consolidation",
    projectId: fixtureProjectId,
    dimension: "positioning",
    statement: "The category may consolidate around auditable delegated coding workflows.",
    factIds: ["atomic_fact_codex_delegation", "atomic_fact_trae_ide"],
    evidenceSpanIds: ["span_codex_delegation", "span_trae_ide_workflow"],
    confidence: 0.55,
    confidenceBreakdown: {
      evidenceStrength: 0.64,
      sourceQuality: 0.88,
      freshness: 0.9,
      corroboration: 0.4,
      counterEvidencePenalty: 0.08
    },
    sourceQuality: 0.88,
    freshness: 0.9,
    counterEvidenceCount: 0,
    kind: "comparative",
    type: "positioning",
    status: "needs_review",
    verdict: "hypothesis"
  }
];

export const demoReviewFindings: ReviewFinding[] = [
  {
    id: "finding_cursor_discount_refuted",
    projectId: fixtureProjectId,
    severity: "medium",
    category: "counter_evidence",
    message:
      "The enterprise discount claim relies on a low-quality community source and is contradicted by official pricing copy.",
    targetType: "claim",
    targetId: "claim_cursor_enterprise_discount",
    agentName: "skeptic"
  },
  {
    id: "finding_trae_needs_more_sources",
    projectId: fixtureProjectId,
    severity: "low",
    category: "trace_gap",
    message:
      "The Trae workflow claim is plausible but should be corroborated with a second source before publication.",
    targetType: "claim",
    targetId: "claim_trae_team_workflows",
    agentName: "critic"
  }
];

export const demoReportBlocks: ReportBlock[] = [
  {
    id: "block_pricing",
    projectId: fixtureProjectId,
    title: "Pricing Signals",
    body:
      "Cursor publishes multiple paid plan types, but the universal enterprise discount claim should be rejected.",
    ordinal: 0,
    claimIds: ["claim_cursor_paid_plans", "claim_cursor_enterprise_discount"],
    evidenceSpanIds: [
      "span_cursor_paid_plans",
      "span_cursor_discount_counter",
      "span_cursor_rumor"
    ],
    status: "ready"
  },
  {
    id: "block_positioning",
    projectId: fixtureProjectId,
    title: "Workflow Positioning",
    body:
      "Codex is positioned around delegated coding-agent work, while Trae emphasizes IDE-local assistance.",
    ordinal: 1,
    claimIds: [
      "claim_codex_delegated_workflow",
      "claim_trae_team_workflows",
      "claim_ai_coding_consolidation"
    ],
    evidenceSpanIds: [
      "span_codex_delegation",
      "span_codex_review_flow",
      "span_trae_ide_workflow",
      "span_trae_context"
    ],
    status: "ready"
  }
];

export interface DemoFixtures {
  sourceCandidates: DemoSourceCandidate[];
  policyDecisions: DemoPolicyDecision[];
  sourceSnapshots: SourceSnapshot[];
  parsedDocuments: DemoParsedDocument[];
  evidenceSpans: EvidenceSpan[];
  atomicFacts: AtomicFact[];
  knowledgeItems: KnowledgeItem[];
  claims: Claim[];
  reviewFindings: ReviewFinding[];
  reportBlocks: ReportBlock[];
}

export function createDemoFixtures(targetProjectId: string): DemoFixtures {
  return {
    sourceCandidates: clone(demoSourceCandidates),
    policyDecisions: clone(demoPolicyDecisions),
    sourceSnapshots: remapProjectId(demoSourceSnapshots, targetProjectId),
    parsedDocuments: clone(demoParsedDocuments),
    evidenceSpans: remapProjectId(demoEvidenceSpans, targetProjectId),
    atomicFacts: remapProjectId(demoAtomicFacts, targetProjectId),
    knowledgeItems: remapProjectId(demoKnowledgeItems, targetProjectId),
    claims: remapProjectId(demoClaims, targetProjectId),
    reviewFindings: remapProjectId(demoReviewFindings, targetProjectId),
    reportBlocks: remapProjectId(demoReportBlocks, targetProjectId)
  };
}

function remapProjectId<T extends { projectId?: string }>(
  values: T[],
  targetProjectId: string
): T[] {
  return values.map((value) => ({
    ...clone(value),
    ...(value.projectId !== undefined ? { projectId: targetProjectId } : {})
  }));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
