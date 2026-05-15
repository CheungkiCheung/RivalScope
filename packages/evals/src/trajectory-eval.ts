import type { Claim, Fact } from "@rivalscope/core";

export interface EvaluateEvidenceTrajectoryInput {
  requiredDimensions: string[];
  facts: Fact[];
  claims: Claim[];
}

export interface TrajectoryEvalFinding {
  severity: "medium" | "high";
  category:
    | "unsupported_claim"
    | "unknown_fact"
    | "untraced_fact"
    | "missing_dimension";
  message: string;
}

export interface EvidenceTrajectoryMetrics {
  claimCount: number;
  factCount: number;
  evidenceCoverage: number;
  citationValidity: number;
  requiredDimensionCoverage: number;
  sourceTraceability: number;
}

export interface EvidenceTrajectoryEvalResult {
  score: number;
  metrics: EvidenceTrajectoryMetrics;
  findings: TrajectoryEvalFinding[];
}

export function evaluateEvidenceTrajectory(
  input: EvaluateEvidenceTrajectoryInput
): EvidenceTrajectoryEvalResult {
  const factById = new Map(input.facts.map((fact) => [fact.id, fact]));
  const factIds = new Set(factById.keys());
  const findings: TrajectoryEvalFinding[] = [];

  for (const claim of input.claims) {
    if (claim.factIds.length === 0) {
      findings.push({
        severity: "high",
        category: "unsupported_claim",
        message: `Claim ${claim.id} has no cited facts.`
      });
    }

    for (const factId of claim.factIds) {
      const fact = factById.get(factId);

      if (!fact) {
        findings.push({
          severity: "high",
          category: "unknown_fact",
          message: `Claim ${claim.id} cites unknown fact ${factId}.`
        });
      } else if (fact.sourceChunkIds.length === 0) {
        findings.push({
          severity: "high",
          category: "untraced_fact",
          message: `Claim ${claim.id} cites fact ${fact.id} without source chunks.`
        });
      }
    }
  }

  const supportedClaims = input.claims.filter((claim) =>
    isSupportedClaim(claim, factById)
  );
  const coveredDimensions = new Set(
    supportedClaims.map((claim) => claim.dimension)
  );

  for (const dimension of input.requiredDimensions) {
    if (!coveredDimensions.has(dimension)) {
      findings.push({
        severity: "medium",
        category: "missing_dimension",
        message: `Missing required dimension ${dimension}.`
      });
    }
  }

  const metrics = {
    claimCount: input.claims.length,
    factCount: input.facts.length,
    evidenceCoverage: calculateEvidenceCoverage(input.claims, factById),
    citationValidity: calculateCitationValidity(input.claims, factIds),
    requiredDimensionCoverage: calculateRequiredDimensionCoverage(
      input.requiredDimensions,
      coveredDimensions
    ),
    sourceTraceability: calculateSourceTraceability(input.claims, factById)
  };

  return {
    score: calculateTrajectoryScore(metrics),
    metrics,
    findings: sortFindings(findings)
  };
}

function calculateEvidenceCoverage(
  claims: Claim[],
  factById: Map<string, Fact>
): number {
  if (claims.length === 0) {
    return 1;
  }

  const supportedClaims = claims.filter((claim) => isSupportedClaim(claim, factById));

  return supportedClaims.length / claims.length;
}

function calculateCitationValidity(claims: Claim[], factIds: Set<string>): number {
  const citedFactIds = claims.flatMap((claim) => claim.factIds);

  if (citedFactIds.length === 0) {
    return claims.length === 0 ? 1 : 0;
  }

  const validCitations = citedFactIds.filter((factId) => factIds.has(factId));

  return validCitations.length / citedFactIds.length;
}

function isSupportedClaim(claim: Claim, factById: Map<string, Fact>): boolean {
  return (
    claim.factIds.length > 0 &&
    claim.factIds.every((factId) => {
      const fact = factById.get(factId);

      return fact !== undefined && fact.sourceChunkIds.length > 0;
    })
  );
}

function calculateSourceTraceability(
  claims: Claim[],
  factById: Map<string, Fact>
): number {
  const citedFacts = claims.flatMap((claim) =>
    claim.factIds
      .map((factId) => factById.get(factId))
      .filter((fact): fact is Fact => fact !== undefined)
  );

  if (citedFacts.length === 0) {
    return claims.length === 0 ? 1 : 0;
  }

  const tracedFacts = citedFacts.filter((fact) => fact.sourceChunkIds.length > 0);

  return tracedFacts.length / citedFacts.length;
}

function calculateRequiredDimensionCoverage(
  requiredDimensions: string[],
  coveredDimensions: Set<string>
): number {
  if (requiredDimensions.length === 0) {
    return 1;
  }

  const coveredRequiredDimensions = requiredDimensions.filter((dimension) =>
    coveredDimensions.has(dimension)
  );

  return coveredRequiredDimensions.length / requiredDimensions.length;
}

function calculateTrajectoryScore(metrics: EvidenceTrajectoryMetrics): number {
  return Math.round(
    ((metrics.evidenceCoverage +
      metrics.citationValidity +
      metrics.requiredDimensionCoverage +
      metrics.sourceTraceability) /
      4) *
      100
  );
}

function sortFindings(findings: TrajectoryEvalFinding[]): TrajectoryEvalFinding[] {
  const priority: Record<TrajectoryEvalFinding["category"], number> = {
    unsupported_claim: 0,
    unknown_fact: 1,
    untraced_fact: 2,
    missing_dimension: 3
  };

  return [...findings].sort((left, right) => {
    const categoryDelta = priority[left.category] - priority[right.category];

    if (categoryDelta !== 0) {
      return categoryDelta;
    }

    return left.message.localeCompare(right.message);
  });
}
