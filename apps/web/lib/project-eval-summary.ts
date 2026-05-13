import type { ClaimKind } from "@prisma/client";
import type { Claim, ClaimKind as CoreClaimKind, Fact } from "@rivalscope/core";
import {
  evaluateEvidenceTrajectory,
  type EvidenceTrajectoryMetrics,
  type TrajectoryEvalFinding
} from "@rivalscope/evals";

export interface ProjectEvalSummaryInput {
  requiredDimensions: string[];
  reportSections: ProjectEvalReportSection[];
}

export interface ProjectEvalReportSection {
  claims: Array<{
    claim: ProjectEvalClaim;
  }>;
}

export interface ProjectEvalClaim {
  id: string;
  projectId: string;
  dimension: string;
  statement: string;
  confidence: number;
  kind: ClaimKind;
  facts: Array<{
    fact: ProjectEvalFact;
  }>;
}

export interface ProjectEvalFact {
  id: string;
  projectId: string;
  competitorId: string;
  dimension: string;
  statement: string;
  confidence: number;
  chunks: Array<{ chunkId: string }>;
}

export interface ProjectEvalSummary {
  status: "not_started" | "ready";
  score: number | null;
  metrics: EvidenceTrajectoryMetrics | null;
  findings: TrajectoryEvalFinding[];
}

export function buildProjectEvalSummary(
  input: ProjectEvalSummaryInput
): ProjectEvalSummary {
  if (input.reportSections.length === 0) {
    return {
      status: "not_started",
      score: null,
      metrics: null,
      findings: []
    };
  }

  const claims = uniqueById(
    input.reportSections.flatMap((section) =>
      section.claims.map((link) => toEvalClaim(link.claim))
    )
  );
  const facts = uniqueById(
    input.reportSections.flatMap((section) =>
      section.claims.flatMap((link) =>
        link.claim.facts.map((factLink) => toEvalFact(factLink.fact))
      )
    )
  );
  const evaluation = evaluateEvidenceTrajectory({
    requiredDimensions: input.requiredDimensions,
    facts,
    claims
  });

  return {
    status: "ready",
    score: evaluation.score,
    metrics: evaluation.metrics,
    findings: evaluation.findings
  };
}

function toEvalClaim(claim: ProjectEvalClaim): Claim {
  return {
    id: claim.id,
    projectId: claim.projectId,
    dimension: claim.dimension,
    statement: claim.statement,
    factIds: claim.facts.map((factLink) => factLink.fact.id),
    confidence: claim.confidence,
    kind: toCoreClaimKind(claim.kind)
  };
}

function toEvalFact(fact: ProjectEvalFact): Fact {
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
