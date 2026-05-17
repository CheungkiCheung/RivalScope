export type SourceKind = "url" | "markdown" | "pdf" | "text";

export interface Source {
  id: string;
  projectId: string;
  kind: SourceKind;
  title: string;
  uri: string;
  collectedAt: string;
}

export interface SourceChunk {
  id: string;
  sourceId: string;
  ordinal: number;
  text: string;
  tokenCount: number;
}

export interface Fact {
  id: string;
  projectId: string;
  competitorId: string;
  dimension: string;
  statement: string;
  sourceChunkIds: string[];
  confidence: number;
}

export interface SourceSnapshotMetadata {
  sourceType: string;
  publisher?: string;
  qualityScore: number;
  fetchedBy?: string;
  policyStatus?: "allowed" | "blocked" | "requires_review";
  [key: string]: unknown;
}

export interface SourceSnapshot {
  id: string;
  projectId: string;
  sourceId: string;
  sourceKind: SourceKind;
  title: string;
  canonicalUrl: string;
  retrievedAt: string;
  contentHash: string;
  rawText: string;
  metadata: SourceSnapshotMetadata;
}

export type EvidenceSpanType = "supporting" | "counter" | "context";

export interface EvidenceSpan {
  id: string;
  projectId: string;
  snapshotId: string;
  sourceId: string;
  text: string;
  startOffset: number;
  endOffset: number;
  quoteHash: string;
  spanType: EvidenceSpanType;
  qualityScore: number;
  capturedAt: string;
}

export type AtomicFactPolarity = "supports" | "contradicts" | "context";

export interface AtomicFact {
  id: string;
  projectId: string;
  competitorId: string;
  dimension: string;
  statement: string;
  evidenceSpanIds: string[];
  confidence: number;
  polarity: AtomicFactPolarity;
  extractedAt: string;
}

export interface KnowledgeItem {
  id: string;
  projectId: string;
  competitorId: string;
  dimension: string;
  label: string;
  summary: string;
  atomicFactIds: string[];
  confidence: number;
}

export type ClaimKind =
  | "single_competitor"
  | "comparative"
  | "recommendation";

export type ClaimType =
  | "capability"
  | "pricing"
  | "positioning"
  | "risk"
  | "recommendation";

export type ClaimStatus =
  | "draft"
  | "needs_evidence"
  | "needs_review"
  | "approved"
  | "rejected";

export type ClaimVerdict =
  | "supported"
  | "needs_more_evidence"
  | "refuted"
  | "hypothesis";

export interface ClaimConfidence {
  evidenceStrength: number;
  sourceQuality: number;
  freshness: number;
  corroboration: number;
  counterEvidencePenalty: number;
}

export interface Claim {
  id: string;
  projectId: string;
  dimension: string;
  statement: string;
  factIds: string[];
  evidenceSpanIds?: string[];
  confidence: number;
  confidenceBreakdown?: ClaimConfidence;
  sourceQuality?: number;
  freshness?: number;
  counterEvidenceCount?: number;
  kind: ClaimKind;
  type?: ClaimType;
  status?: ClaimStatus;
  verdict?: ClaimVerdict;
}

export interface Insight {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  claimIds: string[];
  confidence: number;
}

export interface Recommendation {
  id: string;
  projectId: string;
  title: string;
  rationale: string;
  claimIds: string[];
  priority: "low" | "medium" | "high";
}

export interface ReportBlock {
  id: string;
  projectId: string;
  title: string;
  body: string;
  ordinal: number;
  claimIds: string[];
  evidenceSpanIds: string[];
  status: "draft" | "ready" | "blocked";
}

export type ReviewFindingSeverity = "low" | "medium" | "high" | "critical";

export type ReviewFindingCategory =
  | "unsupported_claim"
  | "unknown_fact"
  | "unknown_evidence_span"
  | "low_confidence"
  | "uncited_report_section"
  | "unknown_claim"
  | "missing_dimension"
  | "trace_gap"
  | "counter_evidence"
  | "role_violation";

export interface ReviewFinding {
  id: string;
  projectId?: string;
  severity: ReviewFindingSeverity;
  category: ReviewFindingCategory;
  message: string;
  targetType?: "claim" | "evidence_span" | "report_block" | "agent_run";
  targetId?: string;
  agentName?: string;
}

export interface TraceValidationResult {
  id?: string;
  projectId?: string;
  status: "passed" | "failed" | "needs_review";
  checkedClaimIds: string[];
  checkedEvidenceSpanIds: string[];
  findings: ReviewFinding[];
  reportBlockIds?: string[];
  validatedAt?: string;
}

export interface EvidenceChain {
  claim: Claim;
  facts: Fact[];
  chunks: SourceChunk[];
  sources: Source[];
}

export interface BuildEvidenceChainInput {
  claim: Claim;
  facts: Fact[];
  chunks: SourceChunk[];
  sources: Source[];
}

export interface ClaimLineage {
  claim: Claim;
  atomicFacts: AtomicFact[];
  evidenceSpans: EvidenceSpan[];
  sourceSnapshots: SourceSnapshot[];
}

export interface BuildClaimLineageInput {
  claim: Claim;
  atomicFacts: AtomicFact[];
  evidenceSpans: EvidenceSpan[];
  sourceSnapshots: SourceSnapshot[];
}

export interface ValidateTraceInput {
  reportBlocks: ReportBlock[];
  claims: Claim[];
  atomicFacts: AtomicFact[];
  evidenceSpans: EvidenceSpan[];
  sourceSnapshots: SourceSnapshot[];
}

export function assertClaimEvidence(
  claim: Claim,
  facts: Array<Fact | AtomicFact>,
  evidenceSpans?: EvidenceSpan[]
): void {
  if (claim.factIds.length === 0) {
    throw new Error(`Claim ${claim.id} must cite at least one fact`);
  }

  const factIds = new Set(facts.map((fact) => fact.id));

  for (const factId of claim.factIds) {
    if (!factIds.has(factId)) {
      throw new Error(`Claim ${claim.id} cites unknown fact ${factId}`);
    }
  }

  if (evidenceSpans) {
    const claimEvidenceSpanIds = claim.evidenceSpanIds ?? [];

    if (claimEvidenceSpanIds.length === 0) {
      throw new Error(`Claim ${claim.id} must cite at least one evidence span`);
    }

    const evidenceSpanIds = new Set(evidenceSpans.map((span) => span.id));

    for (const spanId of claimEvidenceSpanIds) {
      if (!evidenceSpanIds.has(spanId)) {
        throw new Error(`Claim ${claim.id} cites unknown evidence span ${spanId}`);
      }
    }
  }
}

export function buildEvidenceChain(
  input: BuildEvidenceChainInput
): EvidenceChain {
  assertClaimEvidence(input.claim, input.facts);

  const factIdSet = new Set(input.claim.factIds);
  const facts = input.facts.filter((fact) => factIdSet.has(fact.id));
  const chunkIdSet = new Set(
    facts.flatMap((fact) => fact.sourceChunkIds)
  );
  const chunks = input.chunks.filter((chunk) => chunkIdSet.has(chunk.id));
  const sourceIdSet = new Set(chunks.map((chunk) => chunk.sourceId));
  const sources = input.sources.filter((source) => sourceIdSet.has(source.id));

  assertFactsHaveChunks(facts, input.chunks);
  assertChunksHaveSources(chunks, input.sources);

  return {
    claim: input.claim,
    facts,
    chunks,
    sources
  };
}

export function buildClaimLineage(input: BuildClaimLineageInput): ClaimLineage {
  assertClaimEvidence(input.claim, input.atomicFacts, input.evidenceSpans);

  const factIdSet = new Set(input.claim.factIds);
  const atomicFacts = input.atomicFacts.filter((fact) => factIdSet.has(fact.id));
  assertAtomicFactsHaveEvidenceSpans(atomicFacts, input.evidenceSpans);

  const evidenceSpanIdSet = new Set([
    ...(input.claim.evidenceSpanIds ?? []),
    ...atomicFacts.flatMap((fact) => fact.evidenceSpanIds)
  ]);
  const evidenceSpans = input.evidenceSpans.filter((span) =>
    evidenceSpanIdSet.has(span.id)
  );
  assertEvidenceSpansHaveSnapshots(evidenceSpans, input.sourceSnapshots);

  const snapshotIdSet = new Set(evidenceSpans.map((span) => span.snapshotId));
  const sourceSnapshots = input.sourceSnapshots.filter((snapshot) =>
    snapshotIdSet.has(snapshot.id)
  );

  return {
    claim: input.claim,
    atomicFacts,
    evidenceSpans,
    sourceSnapshots
  };
}

export function validateTrace(input: ValidateTraceInput): TraceValidationResult {
  const findings: ReviewFinding[] = [];
  const checkedClaimIds: string[] = [];
  const checkedEvidenceSpanIds = new Set<string>();
  const claimsById = new Map(input.claims.map((claim) => [claim.id, claim]));
  const atomicFactsById = new Map(input.atomicFacts.map((fact) => [fact.id, fact]));
  const claimIds = new Set(input.claims.map((claim) => claim.id));
  const evidenceSpanIds = new Set(input.evidenceSpans.map((span) => span.id));

  for (const claim of input.claims) {
    checkedClaimIds.push(claim.id);

    try {
      const lineage = buildClaimLineage({
        claim,
        atomicFacts: input.atomicFacts,
        evidenceSpans: input.evidenceSpans,
        sourceSnapshots: input.sourceSnapshots
      });

      for (const span of lineage.evidenceSpans) {
        checkedEvidenceSpanIds.add(span.id);
      }
    } catch (error) {
      findings.push({
        id: `finding_${claim.id}_trace`,
        severity: "high",
        category: "trace_gap",
        message: error instanceof Error ? error.message : String(error),
        targetType: "claim",
        targetId: claim.id
      });
    }
  }

  for (const block of input.reportBlocks) {
    const blockLineageEvidenceSpanIds = new Set<string>();

    if (block.claimIds.length === 0) {
      findings.push({
        id: `finding_${block.id}_no_claims`,
        severity: "high",
        category: "uncited_report_section",
        message: `Report block ${block.id} has no cited claims.`,
        targetType: "report_block",
        targetId: block.id
      });
    }

    for (const claimId of block.claimIds) {
      if (!claimIds.has(claimId)) {
        findings.push({
          id: `finding_${block.id}_unknown_claim_${claimId}`,
          severity: "high",
          category: "unknown_claim",
          message: `Report block ${block.id} cites unknown claim ${claimId}.`,
          targetType: "report_block",
          targetId: block.id
        });
        continue;
      }

      const claim = claimsById.get(claimId);

      if (claim) {
        for (const spanId of claim.evidenceSpanIds ?? []) {
          blockLineageEvidenceSpanIds.add(spanId);
        }

        for (const factId of claim.factIds) {
          const atomicFact = atomicFactsById.get(factId);

          if (atomicFact) {
            for (const spanId of atomicFact.evidenceSpanIds) {
              blockLineageEvidenceSpanIds.add(spanId);
            }
          }
        }
      }
    }

    if (block.evidenceSpanIds.length === 0) {
      findings.push({
        id: `finding_${block.id}_no_evidence`,
        severity: "high",
        category: "trace_gap",
        message: `Report block ${block.id} has no cited evidence spans.`,
        targetType: "report_block",
        targetId: block.id
      });
    }

    for (const spanId of block.evidenceSpanIds) {
      if (!evidenceSpanIds.has(spanId)) {
        findings.push({
          id: `finding_${block.id}_unknown_span_${spanId}`,
          severity: "high",
          category: "unknown_evidence_span",
          message: `Report block ${block.id} cites unknown evidence span ${spanId}.`,
          targetType: "report_block",
          targetId: block.id
        });
      } else if (!blockLineageEvidenceSpanIds.has(spanId)) {
        findings.push({
          id: `finding_${block.id}_unrelated_span_${spanId}`,
          severity: "high",
          category: "trace_gap",
          message: `Report block ${block.id} cites evidence span ${spanId} that is unrelated to its cited claims.`,
          targetType: "report_block",
          targetId: block.id
        });
      } else {
        checkedEvidenceSpanIds.add(spanId);
      }
    }
  }

  return {
    status: findings.length === 0 ? "passed" : "failed",
    checkedClaimIds,
    checkedEvidenceSpanIds: Array.from(checkedEvidenceSpanIds),
    findings,
    reportBlockIds: input.reportBlocks.map((block) => block.id),
    validatedAt: new Date().toISOString()
  };
}

function assertFactsHaveChunks(facts: Fact[], chunks: SourceChunk[]): void {
  const chunkIds = new Set(chunks.map((chunk) => chunk.id));

  for (const fact of facts) {
    if (fact.sourceChunkIds.length === 0) {
      throw new Error(`Fact ${fact.id} must cite at least one source chunk`);
    }

    for (const chunkId of fact.sourceChunkIds) {
      if (!chunkIds.has(chunkId)) {
        throw new Error(`Fact ${fact.id} cites unknown chunk ${chunkId}`);
      }
    }
  }
}

function assertChunksHaveSources(chunks: SourceChunk[], sources: Source[]): void {
  const sourceIds = new Set(sources.map((source) => source.id));

  for (const chunk of chunks) {
    if (!sourceIds.has(chunk.sourceId)) {
      throw new Error(`Chunk ${chunk.id} cites unknown source ${chunk.sourceId}`);
    }
  }
}

function assertAtomicFactsHaveEvidenceSpans(
  atomicFacts: AtomicFact[],
  evidenceSpans: EvidenceSpan[]
): void {
  const evidenceSpanIds = new Set(evidenceSpans.map((span) => span.id));

  for (const fact of atomicFacts) {
    if (fact.evidenceSpanIds.length === 0) {
      throw new Error(`Atomic fact ${fact.id} must cite at least one evidence span`);
    }

    for (const spanId of fact.evidenceSpanIds) {
      if (!evidenceSpanIds.has(spanId)) {
        throw new Error(`Atomic fact ${fact.id} cites unknown evidence span ${spanId}`);
      }
    }
  }
}

function assertEvidenceSpansHaveSnapshots(
  evidenceSpans: EvidenceSpan[],
  sourceSnapshots: SourceSnapshot[]
): void {
  const snapshotIds = new Set(sourceSnapshots.map((snapshot) => snapshot.id));

  for (const span of evidenceSpans) {
    if (!snapshotIds.has(span.snapshotId)) {
      throw new Error(
        `Evidence span ${span.id} cites unknown source snapshot ${span.snapshotId}`
      );
    }
  }
}
