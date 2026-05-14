export interface ProjectResearchArtifact {
  id: string;
  kind: string;
  value: unknown;
  createdAt: Date;
}

export interface BuildProjectResearchSummaryInput {
  artifacts: ProjectResearchArtifact[];
}

export interface ProjectResearchSummary {
  status: "not_started" | "complete" | "partial";
  totalBranches: number;
  succeededBranches: number;
  partialBranches: number;
  failedBranches: number;
  evidenceGaps: ProjectResearchEvidenceGap[];
  branchResults: ProjectResearchBranchRow[];
  includedClaimIds: string[];
  excludedClaimIds: string[];
}

export interface ProjectResearchEvidenceGap {
  id: string;
  branchId: string;
  competitorId: string;
  competitorName: string;
  dimension: string;
  reason: string;
}

export interface ProjectResearchBranchRow {
  branchId: string;
  competitorId: string;
  competitorName: string;
  dimension: string;
  status: "succeeded" | "partial" | "failed";
  factCount: number;
  claimCount: number;
  evidenceGapIds: string[];
}

export function buildProjectResearchSummary(
  input: BuildProjectResearchSummaryInput
): ProjectResearchSummary {
  const synthesis = [...input.artifacts]
    .filter((artifact) => artifact.kind === "research_synthesis")
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map((artifact) => parseResearchSynthesis(artifact.value))
    .find((value): value is ProjectResearchSummary => value !== null);

  return synthesis ?? emptyResearchSummary();
}

function parseResearchSynthesis(value: unknown): ProjectResearchSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.totalBranches !== "number" ||
    typeof value.succeededBranches !== "number" ||
    typeof value.partialBranches !== "number" ||
    typeof value.failedBranches !== "number" ||
    !Array.isArray(value.evidenceGaps) ||
    !Array.isArray(value.branchResults) ||
    !Array.isArray(value.includedClaimIds) ||
    !Array.isArray(value.excludedClaimIds)
  ) {
    return null;
  }

  const failedOrPartialBranches = value.failedBranches + value.partialBranches;

  return {
    status: failedOrPartialBranches > 0 ? "partial" : "complete",
    totalBranches: value.totalBranches,
    succeededBranches: value.succeededBranches,
    partialBranches: value.partialBranches,
    failedBranches: value.failedBranches,
    evidenceGaps: value.evidenceGaps
      .map(parseEvidenceGap)
      .filter(isEvidenceGap),
    branchResults: value.branchResults
      .map(parseBranchResult)
      .filter(isBranchRow),
    includedClaimIds: value.includedClaimIds.filter(isString),
    excludedClaimIds: value.excludedClaimIds.filter(isString)
  };
}

function parseEvidenceGap(value: unknown): ProjectResearchEvidenceGap | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.branchId !== "string" ||
    typeof value.competitorId !== "string" ||
    typeof value.competitorName !== "string" ||
    typeof value.dimension !== "string" ||
    typeof value.reason !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    branchId: value.branchId,
    competitorId: value.competitorId,
    competitorName: value.competitorName,
    dimension: value.dimension,
    reason: value.reason
  };
}

function parseBranchResult(value: unknown): ProjectResearchBranchRow | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.branchId !== "string" ||
    typeof value.competitorId !== "string" ||
    typeof value.competitorName !== "string" ||
    typeof value.dimension !== "string" ||
    (value.status !== "succeeded" &&
      value.status !== "partial" &&
      value.status !== "failed") ||
    !Array.isArray(value.factIds) ||
    !Array.isArray(value.claimIds) ||
    !Array.isArray(value.evidenceGapIds)
  ) {
    return null;
  }

  return {
    branchId: value.branchId,
    competitorId: value.competitorId,
    competitorName: value.competitorName,
    dimension: value.dimension,
    status: value.status,
    factCount: value.factIds.filter(isString).length,
    claimCount: value.claimIds.filter(isString).length,
    evidenceGapIds: value.evidenceGapIds.filter(isString)
  };
}

function emptyResearchSummary(): ProjectResearchSummary {
  return {
    status: "not_started",
    totalBranches: 0,
    succeededBranches: 0,
    partialBranches: 0,
    failedBranches: 0,
    evidenceGaps: [],
    branchResults: [],
    includedClaimIds: [],
    excludedClaimIds: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isEvidenceGap(
  gap: ProjectResearchEvidenceGap | null
): gap is ProjectResearchEvidenceGap {
  return gap !== null;
}

function isBranchRow(
  branch: ProjectResearchBranchRow | null
): branch is ProjectResearchBranchRow {
  return branch !== null;
}
