import { describe, expect, it } from "vitest";
import {
  assertClaimEvidence,
  buildClaimLineage,
  buildEvidenceChain,
  validateTrace,
  type AtomicFact,
  type Claim,
  type EvidenceSpan,
  type Fact,
  type ReportBlock,
  type Source,
  type SourceChunk,
  type SourceSnapshot
} from "./evidence";

const source: Source = {
  id: "src_1",
  projectId: "project_1",
  kind: "url",
  title: "Cursor pricing",
  uri: "https://cursor.com/pricing",
  collectedAt: "2026-05-11T00:00:00.000Z"
};

const chunk: SourceChunk = {
  id: "chunk_1",
  sourceId: "src_1",
  ordinal: 0,
  text: "Cursor offers individual and team plans.",
  tokenCount: 8
};

const fact: Fact = {
  id: "fact_1",
  projectId: "project_1",
  competitorId: "cursor",
  dimension: "pricing",
  statement: "Cursor offers individual and team plans.",
  sourceChunkIds: ["chunk_1"],
  confidence: 0.9
};

describe("evidence tracing", () => {
  it("rejects claims that do not cite any facts", () => {
    const claim: Claim = {
      id: "claim_1",
      projectId: "project_1",
      dimension: "pricing",
      statement: "Cursor has multiple plan types.",
      factIds: [],
      confidence: 0.8,
      kind: "single_competitor"
    };

    expect(() => assertClaimEvidence(claim, [fact])).toThrow(
      "Claim claim_1 must cite at least one fact"
    );
  });

  it("rejects claims that cite unknown facts", () => {
    const claim: Claim = {
      id: "claim_1",
      projectId: "project_1",
      dimension: "pricing",
      statement: "Cursor has multiple plan types.",
      factIds: ["fact_missing"],
      confidence: 0.8,
      kind: "single_competitor"
    };

    expect(() => assertClaimEvidence(claim, [fact])).toThrow(
      "Claim claim_1 cites unknown fact fact_missing"
    );
  });

  it("builds a source-to-claim evidence chain", () => {
    const claim: Claim = {
      id: "claim_1",
      projectId: "project_1",
      dimension: "pricing",
      statement: "Cursor has multiple plan types.",
      factIds: ["fact_1"],
      confidence: 0.8,
      kind: "single_competitor"
    };

    const chain = buildEvidenceChain({
      claim,
      facts: [fact],
      chunks: [chunk],
      sources: [source]
    });

    expect(chain.claim.id).toBe("claim_1");
    expect(chain.facts).toHaveLength(1);
    expect(chain.chunks).toHaveLength(1);
    expect(chain.sources).toHaveLength(1);
    expect(chain.sources[0]?.uri).toBe("https://cursor.com/pricing");
  });
});

const snapshot: SourceSnapshot = {
  id: "snapshot_1",
  projectId: "project_1",
  sourceId: "source_cursor_pricing",
  sourceKind: "url",
  title: "Cursor pricing",
  canonicalUrl: "https://cursor.com/pricing",
  retrievedAt: "2026-05-11T00:00:00.000Z",
  contentHash: "sha256:cursor-pricing-2026-05-11",
  rawText: "Cursor offers individual Pro and Team plans. Enterprise buyers can request annual invoicing.",
  metadata: {
    sourceType: "pricing_page",
    publisher: "Cursor",
    qualityScore: 0.92
  }
};

const evidenceSpan: EvidenceSpan = {
  id: "span_1",
  projectId: "project_1",
  snapshotId: "snapshot_1",
  sourceId: "source_cursor_pricing",
  text: "Cursor offers individual Pro and Team plans.",
  startOffset: 0,
  endOffset: 44,
  quoteHash: "sha256:cursor-plans",
  spanType: "supporting",
  qualityScore: 0.92,
  capturedAt: "2026-05-11T00:01:00.000Z"
};

const atomicFact: AtomicFact = {
  id: "atomic_fact_1",
  projectId: "project_1",
  competitorId: "Cursor",
  dimension: "pricing",
  statement: "Cursor offers individual Pro and Team plans.",
  evidenceSpanIds: ["span_1"],
  confidence: 0.9,
  polarity: "supports",
  extractedAt: "2026-05-11T00:02:00.000Z"
};

describe("snapshot evidence tracing", () => {
  it("rejects claims that do not cite evidence spans", () => {
    const unsupportedClaim: Claim = {
      id: "claim_without_spans",
      projectId: "project_1",
      dimension: "pricing",
      statement: "Cursor has multiple paid plan types.",
      factIds: ["atomic_fact_1"],
      evidenceSpanIds: [],
      confidence: 0.82,
      confidenceBreakdown: {
        evidenceStrength: 0.8,
        sourceQuality: 0.92,
        freshness: 0.9,
        corroboration: 0.75,
        counterEvidencePenalty: 0.1
      },
      sourceQuality: 0.92,
      freshness: 0.9,
      counterEvidenceCount: 0,
      kind: "single_competitor",
      type: "capability",
      status: "needs_evidence",
      verdict: "needs_more_evidence"
    };

    expect(() => assertClaimEvidence(unsupportedClaim, [atomicFact], [evidenceSpan])).toThrow(
      "Claim claim_without_spans must cite at least one evidence span"
    );
  });

  it("builds SourceSnapshot -> EvidenceSpan -> AtomicFact -> Claim lineage", () => {
    const claim: Claim = {
      id: "claim_1",
      projectId: "project_1",
      dimension: "pricing",
      statement: "Cursor has multiple paid plan types.",
      factIds: ["atomic_fact_1"],
      evidenceSpanIds: ["span_1"],
      confidence: 0.82,
      confidenceBreakdown: {
        evidenceStrength: 0.8,
        sourceQuality: 0.92,
        freshness: 0.9,
        corroboration: 0.75,
        counterEvidencePenalty: 0.1
      },
      sourceQuality: 0.92,
      freshness: 0.9,
      counterEvidenceCount: 0,
      kind: "single_competitor",
      type: "capability",
      status: "approved",
      verdict: "supported"
    };

    const lineage = buildClaimLineage({
      claim,
      atomicFacts: [atomicFact],
      evidenceSpans: [evidenceSpan],
      sourceSnapshots: [snapshot]
    });

    expect(lineage.claim.id).toBe("claim_1");
    expect(lineage.atomicFacts.map((candidate) => candidate.id)).toEqual([
      "atomic_fact_1"
    ]);
    expect(lineage.evidenceSpans.map((candidate) => candidate.id)).toEqual([
      "span_1"
    ]);
    expect(lineage.sourceSnapshots.map((candidate) => candidate.id)).toEqual([
      "snapshot_1"
    ]);
  });

  it("validates report blocks against claim and evidence lineage", () => {
    const claim: Claim = {
      id: "claim_1",
      projectId: "project_1",
      dimension: "pricing",
      statement: "Cursor has multiple paid plan types.",
      factIds: ["atomic_fact_1"],
      evidenceSpanIds: ["span_1"],
      confidence: 0.82,
      confidenceBreakdown: {
        evidenceStrength: 0.8,
        sourceQuality: 0.92,
        freshness: 0.9,
        corroboration: 0.75,
        counterEvidencePenalty: 0.1
      },
      sourceQuality: 0.92,
      freshness: 0.9,
      counterEvidenceCount: 0,
      kind: "single_competitor",
      type: "capability",
      status: "approved",
      verdict: "supported"
    };
    const reportBlock: ReportBlock = {
      id: "report_block_1",
      projectId: "project_1",
      title: "Pricing Signals",
      body: "Cursor has multiple paid plan types.",
      ordinal: 0,
      claimIds: ["claim_1"],
      evidenceSpanIds: ["span_1"],
      status: "ready"
    };

    const result = validateTrace({
      reportBlocks: [reportBlock],
      claims: [claim],
      atomicFacts: [atomicFact],
      evidenceSpans: [evidenceSpan],
      sourceSnapshots: [snapshot]
    });

    expect(result.status).toBe("passed");
    expect(result.checkedClaimIds).toEqual(["claim_1"]);
    expect(result.checkedEvidenceSpanIds).toEqual(["span_1"]);
    expect(result.findings).toEqual([]);
  });

  it("rejects report blocks that cite an existing evidence span unrelated to their cited claims", () => {
    const unrelatedSpan: EvidenceSpan = {
      id: "span_unrelated",
      projectId: "project_1",
      snapshotId: "snapshot_1",
      sourceId: "source_cursor_pricing",
      text: "Enterprise buyers can request annual invoicing.",
      startOffset: 45,
      endOffset: 92,
      quoteHash: "sha256:cursor-enterprise",
      spanType: "supporting",
      qualityScore: 0.9,
      capturedAt: "2026-05-11T00:01:30.000Z"
    };
    const claim: Claim = {
      id: "claim_1",
      projectId: "project_1",
      dimension: "pricing",
      statement: "Cursor has multiple paid plan types.",
      factIds: ["atomic_fact_1"],
      evidenceSpanIds: ["span_1"],
      confidence: 0.82,
      confidenceBreakdown: {
        evidenceStrength: 0.8,
        sourceQuality: 0.92,
        freshness: 0.9,
        corroboration: 0.75,
        counterEvidencePenalty: 0.1
      },
      sourceQuality: 0.92,
      freshness: 0.9,
      counterEvidenceCount: 0,
      kind: "single_competitor",
      type: "capability",
      status: "approved",
      verdict: "supported"
    };
    const reportBlock: ReportBlock = {
      id: "report_block_1",
      projectId: "project_1",
      title: "Pricing Signals",
      body: "Cursor has multiple paid plan types.",
      ordinal: 0,
      claimIds: ["claim_1"],
      evidenceSpanIds: ["span_unrelated"],
      status: "ready"
    };

    const result = validateTrace({
      reportBlocks: [reportBlock],
      claims: [claim],
      atomicFacts: [atomicFact],
      evidenceSpans: [evidenceSpan, unrelatedSpan],
      sourceSnapshots: [snapshot]
    });

    expect(result.status).toBe("failed");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        category: "trace_gap",
        targetType: "report_block",
        targetId: "report_block_1"
      })
    );
  });
});
