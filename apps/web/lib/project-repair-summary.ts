export interface ProjectRepairArtifact {
  id: string;
  kind: string;
  value: unknown;
  createdAt: Date;
}

export interface BuildProjectRepairSummaryInput {
  artifacts: ProjectRepairArtifact[];
}

export interface ProjectRepairActionSummary {
  id: string;
  type: string;
  targetType: string;
  targetId: string;
  severity: string;
  status: string;
  reason: string;
  repairSuggestion: string;
}

export interface ProjectRepairSummary {
  status: "not_started" | "improved" | "unchanged";
  draftQualityScore: number | null;
  repairedQualityScore: number | null;
  delta: number | null;
  actions: ProjectRepairActionSummary[];
  unresolvedGaps: string[];
  claimTrust?: ProjectRepairClaimTrustSummary;
  judgeComparison?: ProjectRepairJudgeComparisonSummary;
}

export interface ProjectRepairClaimTrustSummary {
  draftAverageTrust: number | null;
  finalAverageTrust: number | null;
  delta: number | null;
  claims: ProjectRepairClaimTrustRow[];
}

export interface ProjectRepairClaimTrustRow {
  claimId: string;
  dimension: string;
  statement: string;
  draftScore: number;
  finalScore: number | null;
  delta: number | null;
  status: "kept" | "removed";
  draftRiskLevel: string;
  finalRiskLevel: string | null;
  penalties: string[];
}

export interface ProjectRepairJudgeComparisonSummary {
  totalCases: number;
  disagreementsCount: number;
  judges: ProjectRepairJudgeSummary[];
  disagreements: ProjectRepairJudgeDisagreement[];
}

export interface ProjectRepairJudgeSummary {
  name: string;
  alignedCases: number;
  disagreedCases: number;
  baselineAgreement: number;
}

export interface ProjectRepairJudgeDisagreement {
  caseId: string;
  labels: Record<string, string>;
}

export function buildProjectRepairSummary(
  input: BuildProjectRepairSummaryInput
): ProjectRepairSummary {
  const finalEval = [...input.artifacts]
    .filter((artifact) => artifact.kind === "final_eval")
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map((artifact) => parseFinalEval(artifact.value))
    .find((value): value is ParsedFinalEval => value !== null);
  const claimTrust = [...input.artifacts]
    .filter((artifact) => artifact.kind === "claim_trust_snapshot")
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map((artifact) => parseClaimTrustSnapshot(artifact.value))
    .find((value): value is ProjectRepairClaimTrustSummary => value !== null);
  const judgeComparison = [...input.artifacts]
    .filter((artifact) => artifact.kind === "entailment_judge_comparison")
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map((artifact) => parseJudgeComparison(artifact.value))
    .find(
      (value): value is ProjectRepairJudgeComparisonSummary => value !== null
    );

  if (!finalEval) {
    return {
      status: "not_started",
      draftQualityScore: null,
      repairedQualityScore: null,
      delta: null,
      actions: [],
      unresolvedGaps: [],
      ...(claimTrust ? { claimTrust } : {}),
      ...(judgeComparison ? { judgeComparison } : {})
    };
  }

  return {
    ...finalEval,
    ...(claimTrust ? { claimTrust } : {}),
    ...(judgeComparison ? { judgeComparison } : {})
  };
}

interface ParsedFinalEval {
  status: "improved" | "unchanged";
  draftQualityScore: number;
  repairedQualityScore: number;
  delta: number;
  actions: ProjectRepairActionSummary[];
  unresolvedGaps: string[];
}

function parseFinalEval(value: unknown): ParsedFinalEval | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.status !== "improved" &&
    value.status !== "unchanged"
  ) {
    return null;
  }

  if (
    typeof value.draftQualityScore !== "number" ||
    typeof value.repairedQualityScore !== "number" ||
    typeof value.delta !== "number" ||
    !Array.isArray(value.actions) ||
    !Array.isArray(value.unresolvedGaps)
  ) {
    return null;
  }

  return {
    status: value.status,
    draftQualityScore: value.draftQualityScore,
    repairedQualityScore: value.repairedQualityScore,
    delta: value.delta,
    actions: value.actions.map(parseRepairAction).filter(isRepairAction),
    unresolvedGaps: value.unresolvedGaps.filter(
      (gap): gap is string => typeof gap === "string"
    )
  };
}

function parseRepairAction(value: unknown): ProjectRepairActionSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.type !== "string" ||
    typeof value.targetType !== "string" ||
    typeof value.targetId !== "string" ||
    typeof value.severity !== "string" ||
    typeof value.status !== "string" ||
    typeof value.reason !== "string" ||
    typeof value.repairSuggestion !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    type: value.type,
    targetType: value.targetType,
    targetId: value.targetId,
    severity: value.severity,
    status: value.status,
    reason: value.reason,
    repairSuggestion: value.repairSuggestion
  };
}

function parseClaimTrustSnapshot(
  value: unknown
): ProjectRepairClaimTrustSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isNullableNumber(value.draftAverageTrust) ||
    !isNullableNumber(value.finalAverageTrust) ||
    !isNullableNumber(value.trustDelta) ||
    !Array.isArray(value.claims)
  ) {
    return null;
  }

  return {
    draftAverageTrust: value.draftAverageTrust,
    finalAverageTrust: value.finalAverageTrust,
    delta: value.trustDelta,
    claims: value.claims.map(parseClaimTrustRow).filter(isClaimTrustRow)
  };
}

function parseClaimTrustRow(value: unknown): ProjectRepairClaimTrustRow | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.claimId !== "string" ||
    typeof value.dimension !== "string" ||
    typeof value.statement !== "string" ||
    typeof value.draftScore !== "number" ||
    !isNullableNumber(value.finalScore) ||
    !isNullableNumber(value.delta) ||
    (value.status !== "kept" && value.status !== "removed") ||
    typeof value.draftRiskLevel !== "string" ||
    !isNullableString(value.finalRiskLevel) ||
    !Array.isArray(value.penalties)
  ) {
    return null;
  }

  return {
    claimId: value.claimId,
    dimension: value.dimension,
    statement: value.statement,
    draftScore: value.draftScore,
    finalScore: value.finalScore,
    delta: value.delta,
    status: value.status,
    draftRiskLevel: value.draftRiskLevel,
    finalRiskLevel: value.finalRiskLevel,
    penalties: value.penalties.filter(
      (penalty): penalty is string => typeof penalty === "string"
    )
  };
}

function parseJudgeComparison(
  value: unknown
): ProjectRepairJudgeComparisonSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.totalCases !== "number" ||
    !Array.isArray(value.judges) ||
    !Array.isArray(value.disagreements)
  ) {
    return null;
  }

  const disagreements = value.disagreements
    .map(parseJudgeDisagreement)
    .filter(isJudgeDisagreement);

  return {
    totalCases: value.totalCases,
    disagreementsCount: disagreements.length,
    judges: value.judges.map(parseJudgeSummary).filter(isJudgeSummary),
    disagreements
  };
}

function parseJudgeSummary(value: unknown): ProjectRepairJudgeSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.name !== "string" ||
    typeof value.passedCases !== "number" ||
    typeof value.failedCases !== "number" ||
    typeof value.accuracy !== "number"
  ) {
    return null;
  }

  return {
    name: value.name,
    alignedCases: value.passedCases,
    disagreedCases: value.failedCases,
    baselineAgreement: value.accuracy
  };
}

function parseJudgeDisagreement(
  value: unknown
): ProjectRepairJudgeDisagreement | null {
  if (!isRecord(value) || typeof value.caseId !== "string") {
    return null;
  }

  if (!isRecord(value.labels)) {
    return null;
  }

  return {
    caseId: value.caseId,
    labels: Object.fromEntries(
      Object.entries(value.labels).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    )
  };
}

function isRepairAction(
  action: ProjectRepairActionSummary | null
): action is ProjectRepairActionSummary {
  return action !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableNumber(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isClaimTrustRow(
  row: ProjectRepairClaimTrustRow | null
): row is ProjectRepairClaimTrustRow {
  return row !== null;
}

function isJudgeSummary(
  judge: ProjectRepairJudgeSummary | null
): judge is ProjectRepairJudgeSummary {
  return judge !== null;
}

function isJudgeDisagreement(
  disagreement: ProjectRepairJudgeDisagreement | null
): disagreement is ProjectRepairJudgeDisagreement {
  return disagreement !== null;
}
