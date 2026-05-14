import type { Claim, Fact, Source, SourceChunk } from "@rivalscope/core";
import { evaluateClaimEntailment } from "./entailment";

export type ClaimTrustRiskLevel = "low" | "medium" | "high";

export type ClaimTrustPenaltyCode =
  | "no_cited_facts"
  | "unknown_fact"
  | "fact_without_source_chunks"
  | "unknown_source_chunk"
  | "chunk_without_source"
  | "low_fact_confidence"
  | "single_source"
  | "high_severity_critic_finding"
  | "insufficient_semantic_support"
  | "low_source_authority";

export interface ClaimTrustPenalty {
  code: ClaimTrustPenaltyCode;
  points: number;
  message: string;
}

export interface ClaimTrustMetrics {
  citationValidity: number;
  evidenceStrength: number;
  sourceTraceability: number;
  factConfidence: number;
  sourceDiversity: number;
  semanticSupport: number;
  sourceAuthority: number;
  citedFactCount: number;
  validFactCount: number;
  sourceChunkCount: number;
  sourceCount: number;
}

export interface ClaimTrustResult {
  claimId: string;
  dimension: string;
  score: number;
  riskLevel: ClaimTrustRiskLevel;
  metrics: ClaimTrustMetrics;
  penalties: ClaimTrustPenalty[];
  reasons: string[];
  factIds: string[];
  sourceChunkIds: string[];
  sourceIds: string[];
}

export interface EvaluateClaimTrustInput {
  claim: Claim;
  facts: Fact[];
  chunks: SourceChunk[];
  sources: Source[];
  criticFindings?: ClaimTrustCriticFinding[];
}

export interface ClaimTrustCriticFinding {
  severity: "low" | "medium" | "high";
  targetType: "claim" | "fact" | "section" | "dimension" | "workflow";
  targetId: string;
  message: string;
}

export function evaluateClaimTrust(input: EvaluateClaimTrustInput): ClaimTrustResult {
  const factById = new Map(input.facts.map((fact) => [fact.id, fact]));
  const chunkById = new Map(input.chunks.map((chunk) => [chunk.id, chunk]));
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const citedFactIds = unique(input.claim.factIds);
  const validFacts = citedFactIds
    .map((factId) => factById.get(factId))
    .filter((fact): fact is Fact => fact !== undefined);
  const validFactIds = validFacts.map((fact) => fact.id);
  const sourceChunkIds = unique(validFacts.flatMap((fact) => fact.sourceChunkIds));
  const validChunks = sourceChunkIds
    .map((chunkId) => chunkById.get(chunkId))
    .filter((chunk): chunk is SourceChunk => chunk !== undefined);
  const sourceIds = unique(validChunks.map((chunk) => chunk.sourceId));
  const validSources = sourceIds
    .map((sourceId) => sourceById.get(sourceId))
    .filter((source): source is Source => source !== undefined);
  const entailment = evaluateClaimEntailment({
    claim: input.claim,
    facts: validFacts,
    chunks: validChunks
  });
  const semanticSupport = entailment.supportScore;
  const sourceAuthority = calculateSourceAuthority(validSources);
  const penalties = buildPenalties({
    claim: input.claim,
    citedFactIds,
    validFacts,
    validChunks,
    validSources,
    semanticSupport,
    sourceAuthority,
    factById,
    chunkById,
    sourceById,
    criticFindings: input.criticFindings ?? []
  });
  const metrics: ClaimTrustMetrics = {
    citationValidity: ratio(validFactIds.length, citedFactIds.length),
    evidenceStrength: Math.min(1, validFactIds.length / 2),
    sourceTraceability: ratio(validSources.length, sourceIds.length),
    factConfidence:
      validFacts.length === 0
        ? 0
        : average(validFacts.map((fact) => clamp01(fact.confidence))),
    sourceDiversity: Math.min(1, validSources.length / 2),
    semanticSupport,
    sourceAuthority,
    citedFactCount: citedFactIds.length,
    validFactCount: validFactIds.length,
    sourceChunkCount: validChunks.length,
    sourceCount: validSources.length
  };
  const weightedScore =
    metrics.citationValidity * 20 +
    metrics.evidenceStrength * 20 +
    metrics.sourceTraceability * 15 +
    metrics.factConfidence * 15 +
    metrics.sourceDiversity * 5 +
    metrics.semanticSupport * 15 +
    metrics.sourceAuthority * 10;
  const penaltyPoints = penalties.reduce((total, penalty) => total + penalty.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(weightedScore - penaltyPoints)));

  return {
    claimId: input.claim.id,
    dimension: input.claim.dimension,
    score,
    riskLevel: toRiskLevel(score),
    metrics,
    penalties,
    reasons: buildReasons(metrics, penalties, entailment.reasons),
    factIds: validFactIds,
    sourceChunkIds: validChunks.map((chunk) => chunk.id),
    sourceIds: validSources.map((source) => source.id)
  };
}

function buildPenalties(input: {
  claim: Claim;
  citedFactIds: string[];
  validFacts: Fact[];
  validChunks: SourceChunk[];
  validSources: Source[];
  semanticSupport: number;
  sourceAuthority: number;
  factById: Map<string, Fact>;
  chunkById: Map<string, SourceChunk>;
  sourceById: Map<string, Source>;
  criticFindings: ClaimTrustCriticFinding[];
}): ClaimTrustPenalty[] {
  const penalties: ClaimTrustPenalty[] = [];

  if (input.citedFactIds.length === 0) {
    penalties.push({
      code: "no_cited_facts",
      points: 35,
      message: `Claim ${input.claim.id} has no cited facts.`
    });
  }

  for (const factId of input.citedFactIds) {
    if (!input.factById.has(factId)) {
      penalties.push({
        code: "unknown_fact",
        points: 30,
        message: `Claim ${input.claim.id} cites unknown fact ${factId}.`
      });
    }
  }

  for (const fact of input.validFacts) {
    if (fact.sourceChunkIds.length === 0) {
      penalties.push({
        code: "fact_without_source_chunks",
        points: 25,
        message: `Fact ${fact.id} has no source chunks.`
      });
    }

    for (const chunkId of unique(fact.sourceChunkIds)) {
      if (!input.chunkById.has(chunkId)) {
        penalties.push({
          code: "unknown_source_chunk",
          points: 20,
          message: `Fact ${fact.id} cites unknown source chunk ${chunkId}.`
        });
      }
    }
  }

  for (const chunk of input.validChunks) {
    if (!input.sourceById.has(chunk.sourceId)) {
      penalties.push({
        code: "chunk_without_source",
        points: 20,
        message: `Chunk ${chunk.id} cites unknown source ${chunk.sourceId}.`
      });
    }
  }

  const averageConfidence =
    input.validFacts.length === 0
      ? 0
      : average(input.validFacts.map((fact) => clamp01(fact.confidence)));

  if (input.validFacts.length > 0 && averageConfidence < 0.7) {
    penalties.push({
      code: "low_fact_confidence",
      points: 10,
      message: `Claim ${input.claim.id} has average fact confidence below 70%.`
    });
  }

  if (input.validFacts.length > 0 && input.validSources.length === 1) {
    penalties.push({
      code: "single_source",
      points: 8,
      message: `Claim ${input.claim.id} is supported by only one unique source.`
    });
  }

  if (input.validFacts.length > 0 && input.semanticSupport < 0.4) {
    penalties.push({
      code: "insufficient_semantic_support",
      points: 25,
      message: `Claim ${input.claim.id} has weak lexical support from cited evidence.`
    });
  }

  if (input.validSources.length > 0 && input.sourceAuthority < 0.6) {
    penalties.push({
      code: "low_source_authority",
      points: 10,
      message: `Claim ${input.claim.id} relies on low-authority sources.`
    });
  }

  for (const finding of input.criticFindings) {
    if (
      finding.severity === "high" &&
      finding.targetType === "claim" &&
      finding.targetId === input.claim.id
    ) {
      penalties.push({
        code: "high_severity_critic_finding",
        points: 15,
        message: finding.message
      });
    }
  }

  return penalties;
}

function buildReasons(
  metrics: ClaimTrustMetrics,
  penalties: ClaimTrustPenalty[],
  entailmentReasons: string[]
): string[] {
  const reasons = [
    `${metrics.validFactCount}/${metrics.citedFactCount} cited facts are valid.`,
    `${metrics.sourceChunkCount} source chunks trace to ${metrics.sourceCount} sources.`,
    `Average fact confidence is ${Math.round(metrics.factConfidence * 100)}%.`,
    `Semantic support is ${Math.round(metrics.semanticSupport * 100)}%.`,
    `Source authority is ${Math.round(metrics.sourceAuthority * 100)}%.`,
    ...entailmentReasons
  ];

  if (penalties.length === 0) {
    return [...reasons, "No trust penalties were applied."];
  }

  return [...reasons, ...penalties.map((penalty) => penalty.message)];
}

function toRiskLevel(score: number): ClaimTrustRiskLevel {
  if (score >= 85) {
    return "low";
  }

  if (score >= 65) {
    return "medium";
  }

  return "high";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function calculateSourceAuthority(sources: Source[]): number {
  if (sources.length === 0) {
    return 0;
  }

  return average(sources.map(scoreSourceAuthority));
}

function scoreSourceAuthority(source: Source): number {
  const uri = source.uri.toLowerCase();
  const title = source.title.toLowerCase();
  let score = source.kind === "url" ? 0.65 : 0.35;

  if (uri.startsWith("https://")) {
    score += 0.1;
  }

  if (uri.includes("demo.rivalscope.local") || uri.startsWith("manual://")) {
    score -= 0.15;
  }

  if (
    includesAny(uri, ["docs", "pricing", "blog", "about", "company"]) ||
    includesAny(title, ["docs", "pricing", "official", "company"])
  ) {
    score += 0.15;
  }

  return clamp01(score);
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}
