import type { ClaimKind, SourceKind } from "@prisma/client";
import type {
  Claim,
  ClaimKind as CoreClaimKind,
  Fact,
  Source,
  SourceChunk
} from "@rivalscope/core";
import {
  evaluateClaimTrust,
  type ClaimTrustCriticFinding,
  type ClaimTrustResult,
  type ClaimTrustRiskLevel
} from "@rivalscope/evals";

export interface ProjectClaimTrustSource {
  id: string;
  projectId: string;
  kind: SourceKind;
  title: string;
  uri: string;
  collectedAt: Date;
  chunks: ProjectClaimTrustSourceChunk[];
}

export interface ProjectClaimTrustSourceChunk {
  id: string;
  sourceId: string;
  ordinal: number;
  text: string;
  tokenCount: number;
}

export interface ProjectClaimTrustReportSection {
  id: string;
  title: string;
  claims: Array<{
    claim: ProjectClaimTrustClaim;
  }>;
}

export interface ProjectClaimTrustClaim {
  id: string;
  projectId: string;
  dimension: string;
  statement: string;
  confidence: number;
  kind: ClaimKind;
  facts: Array<{
    fact: ProjectClaimTrustFact;
  }>;
}

export interface ProjectClaimTrustFact {
  id: string;
  projectId: string;
  competitorId: string;
  dimension: string;
  statement: string;
  confidence: number;
  competitor: {
    name: string;
  };
  chunks: Array<{ chunkId: string }>;
}

export interface ProjectClaimTrustNode {
  claimId: string;
  statement: string;
  dimension: string;
  sectionId: string;
  sectionTitle: string;
  score: number;
  riskLevel: ClaimTrustRiskLevel;
  metrics: ClaimTrustResult["metrics"];
  penalties: ClaimTrustResult["penalties"];
  reasons: string[];
  facts: Array<{
    id: string;
    statement: string;
    dimension: string;
    confidence: number;
    competitorName: string;
  }>;
  chunks: Array<{
    id: string;
    text: string;
    sourceId: string;
  }>;
  sources: Array<{
    id: string;
    title: string;
    uri: string;
  }>;
}

export interface ProjectClaimTrustSummary {
  status: "not_started" | "ready";
  averageScore: number | null;
  nodes: ProjectClaimTrustNode[];
}

export interface BuildProjectClaimTrustSummaryInput {
  sources: ProjectClaimTrustSource[];
  reportSections: ProjectClaimTrustReportSection[];
  reviewFindings?: ProjectClaimTrustReviewFinding[];
}

export interface ProjectClaimTrustReviewFinding {
  severity: "LOW" | "MEDIUM" | "HIGH";
  targetType: string | null;
  targetId: string | null;
  message: string;
}

export function buildProjectClaimTrustSummary(
  input: BuildProjectClaimTrustSummaryInput
): ProjectClaimTrustSummary {
  if (input.reportSections.length === 0) {
    return {
      status: "not_started",
      averageScore: null,
      nodes: []
    };
  }

  const sources = input.sources.map(toCoreSource);
  const chunks = input.sources.flatMap((source) => source.chunks.map(toCoreChunk));
  const nodes = input.reportSections.flatMap((section) =>
    section.claims.map((link) =>
      buildNode({
        section,
        claim: link.claim,
        sources,
        chunks,
        reviewFindings: input.reviewFindings ?? []
      })
    )
  );

  return {
    status: "ready",
    averageScore:
      nodes.length === 0
        ? null
        : Math.round(
            nodes.reduce((total, node) => total + node.score, 0) / nodes.length
          ),
    nodes
  };
}

function buildNode(input: {
  section: ProjectClaimTrustReportSection;
  claim: ProjectClaimTrustClaim;
  sources: Source[];
  chunks: SourceChunk[];
  reviewFindings: ProjectClaimTrustReviewFinding[];
}): ProjectClaimTrustNode {
  const claim = toCoreClaim(input.claim);
  const facts = uniqueById(input.claim.facts.map((link) => toCoreFact(link.fact)));
  const trust = evaluateClaimTrust({
    claim,
    facts,
    chunks: input.chunks,
    sources: input.sources,
    criticFindings: toClaimTrustCriticFindings(input.reviewFindings)
  });
  const chunkById = new Map(input.chunks.map((chunk) => [chunk.id, chunk]));
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const trustedChunks = trust.sourceChunkIds
    .map((chunkId) => chunkById.get(chunkId))
    .filter((chunk): chunk is SourceChunk => chunk !== undefined);
  const trustedSources = trust.sourceIds
    .map((sourceId) => sourceById.get(sourceId))
    .filter((source): source is Source => source !== undefined);

  return {
    claimId: input.claim.id,
    statement: input.claim.statement,
    dimension: input.claim.dimension,
    sectionId: input.section.id,
    sectionTitle: input.section.title,
    score: trust.score,
    riskLevel: trust.riskLevel,
    metrics: trust.metrics,
    penalties: trust.penalties,
    reasons: trust.reasons,
    facts: uniqueById(input.claim.facts.map((link) => link.fact)).map((fact) => ({
      id: fact.id,
      statement: fact.statement,
      dimension: fact.dimension,
      confidence: fact.confidence,
      competitorName: fact.competitor.name
    })),
    chunks: trustedChunks.map((chunk) => ({
      id: chunk.id,
      text: chunk.text,
      sourceId: chunk.sourceId
    })),
    sources: trustedSources.map((source) => ({
      id: source.id,
      title: source.title,
      uri: source.uri
    }))
  };
}

function toCoreSource(source: ProjectClaimTrustSource): Source {
  return {
    id: source.id,
    projectId: source.projectId,
    kind: source.kind.toLowerCase() as Source["kind"],
    title: source.title,
    uri: source.uri,
    collectedAt: source.collectedAt.toISOString()
  };
}

function toCoreChunk(chunk: ProjectClaimTrustSourceChunk): SourceChunk {
  return {
    id: chunk.id,
    sourceId: chunk.sourceId,
    ordinal: chunk.ordinal,
    text: chunk.text,
    tokenCount: chunk.tokenCount
  };
}

function toCoreClaim(claim: ProjectClaimTrustClaim): Claim {
  return {
    id: claim.id,
    projectId: claim.projectId,
    dimension: claim.dimension,
    statement: claim.statement,
    factIds: claim.facts.map((link) => link.fact.id),
    confidence: claim.confidence,
    kind: toCoreClaimKind(claim.kind)
  };
}

function toCoreFact(fact: ProjectClaimTrustFact): Fact {
  return {
    id: fact.id,
    projectId: fact.projectId,
    competitorId: fact.competitorId,
    dimension: fact.dimension,
    statement: fact.statement,
    sourceChunkIds: fact.chunks.map((chunkLink) => chunkLink.chunkId),
    confidence: fact.confidence
  };
}

function toClaimTrustCriticFindings(
  findings: ProjectClaimTrustReviewFinding[]
): ClaimTrustCriticFinding[] {
  return findings
    .filter(
      (finding): finding is ProjectClaimTrustReviewFinding & {
        targetType: NonNullable<ProjectClaimTrustReviewFinding["targetType"]>;
        targetId: NonNullable<ProjectClaimTrustReviewFinding["targetId"]>;
      } => finding.targetType !== null && finding.targetId !== null
    )
    .map((finding) => ({
      severity: toClaimTrustSeverity(finding.severity),
      targetType: toClaimTrustTargetType(finding.targetType),
      targetId: finding.targetId,
      message: finding.message
    }));
}

function toClaimTrustSeverity(
  severity: ProjectClaimTrustReviewFinding["severity"]
): ClaimTrustCriticFinding["severity"] {
  if (severity === "LOW") {
    return "low";
  }

  if (severity === "MEDIUM") {
    return "medium";
  }

  return "high";
}

function toClaimTrustTargetType(
  targetType: string
): ClaimTrustCriticFinding["targetType"] {
  if (
    targetType === "claim" ||
    targetType === "fact" ||
    targetType === "section" ||
    targetType === "dimension" ||
    targetType === "workflow"
  ) {
    return targetType;
  }

  return "workflow";
}

function toCoreClaimKind(kind: ClaimKind): CoreClaimKind {
  switch (kind) {
    case "COMPARATIVE":
      return "comparative";
    case "RECOMMENDATION":
      return "recommendation";
    case "SINGLE_COMPETITOR":
      return "single_competitor";
    default:
      return assertNever(kind);
  }
}

function uniqueById<T extends { id: string }>(values: T[]): T[] {
  const seen = new Set<string>();
  const uniqueValues: T[] = [];

  for (const value of values) {
    if (seen.has(value.id)) {
      continue;
    }

    seen.add(value.id);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported claim kind: ${String(value)}`);
}
