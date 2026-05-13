import type { Claim, Fact } from "@rivalscope/core";

export interface EvaluateEvidenceTrajectoryInput {
  requiredDimensions: string[];
  facts: Fact[];
  claims: Claim[];
}

export interface TrajectoryEvalFinding {
  severity: "medium" | "high";
  category: "unsupported_claim" | "unknown_fact" | "missing_dimension";
  message: string;
}

export interface EvidenceTrajectoryMetrics {
  claimCount: number;
  factCount: number;
  evidenceCoverage: number;
  citationValidity: number;
  requiredDimensionCoverage: number;
}

export interface EvidenceTrajectoryEvalResult {
  score: number;
  metrics: EvidenceTrajectoryMetrics;
  findings: TrajectoryEvalFinding[];
}

export function evaluateEvidenceTrajectory(
  input: EvaluateEvidenceTrajectoryInput
): EvidenceTrajectoryEvalResult {
  const factIds = new Set(input.facts.map((fact) => fact.id));
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
      if (!factIds.has(factId)) {
        findings.push({
          severity: "high",
          category: "unknown_fact",
          message: `Claim ${claim.id} cites unknown fact ${factId}.`
        });
      }
    }
  }

  const supportedClaims = input.claims.filter((claim) =>
    isSupportedClaim(claim, factIds)
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
    evidenceCoverage: calculateEvidenceCoverage(input.claims, factIds),
    citationValidity: calculateCitationValidity(input.claims, factIds),
    requiredDimensionCoverage: calculateRequiredDimensionCoverage(
      input.requiredDimensions,
      coveredDimensions
    )
  };

  return {
    score: calculateTrajectoryScore(metrics),
    metrics,
    findings: sortFindings(findings)
  };
}

function calculateEvidenceCoverage(claims: Claim[], factIds: Set<string>): number {
  if (claims.length === 0) {
    return 1;
  }

  const supportedClaims = claims.filter((claim) => isSupportedClaim(claim, factIds));

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

function isSupportedClaim(claim: Claim, factIds: Set<string>): boolean {
  return (
    claim.factIds.length > 0 &&
    claim.factIds.every((factId) => factIds.has(factId))
  );
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
      metrics.requiredDimensionCoverage) /
      3) *
      100
  );
}

function sortFindings(findings: TrajectoryEvalFinding[]): TrajectoryEvalFinding[] {
  const priority: Record<TrajectoryEvalFinding["category"], number> = {
    unsupported_claim: 0,
    unknown_fact: 1,
    missing_dimension: 2
  };

  return [...findings].sort((left, right) => {
    const categoryDelta = priority[left.category] - priority[right.category];

    if (categoryDelta !== 0) {
      return categoryDelta;
    }

    return left.message.localeCompare(right.message);
  });
}
