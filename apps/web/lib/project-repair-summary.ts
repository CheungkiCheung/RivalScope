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
}

export function buildProjectRepairSummary(
  input: BuildProjectRepairSummaryInput
): ProjectRepairSummary {
  const finalEval = [...input.artifacts]
    .filter((artifact) => artifact.kind === "final_eval")
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map((artifact) => parseFinalEval(artifact.value))
    .find((value): value is ParsedFinalEval => value !== null);

  if (!finalEval) {
    return {
      status: "not_started",
      draftQualityScore: null,
      repairedQualityScore: null,
      delta: null,
      actions: [],
      unresolvedGaps: []
    };
  }

  return finalEval;
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

function isRepairAction(
  action: ProjectRepairActionSummary | null
): action is ProjectRepairActionSummary {
  return action !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
