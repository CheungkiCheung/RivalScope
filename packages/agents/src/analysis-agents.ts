import type { Claim, Fact, Source, SourceChunk } from "@rivalscope/core";
import { z } from "zod";
import { evaluateClaimTrust } from "@rivalscope/evals";
import {
  getLatestArtifactValue,
  getOptionalLatestArtifactValue
} from "./artifacts";
import {
  generateStructuredObject,
  type ModelClient
} from "./model-client";
import {
  type WorkflowAgent,
  workflowAgentInputSchema,
  workflowAgentOutputSchema
} from "./workflow-schemas";

export interface AnalysisWorkflowAgentOptions {
  model?: ModelClient;
}

interface AnalysisRequirementCompetitor {
  id?: string;
  name: string;
}

export type ReviewFindingTargetType =
  | "claim"
  | "fact"
  | "section"
  | "dimension"
  | "workflow";

export interface ReviewFinding {
  id: string;
  severity: "low" | "medium" | "high";
  category:
    | "unsupported_claim"
    | "unknown_fact"
    | "low_confidence"
    | "uncited_report_section"
    | "unknown_claim"
    | "missing_dimension";
  message: string;
  targetType: ReviewFindingTargetType;
  targetId: string;
  dimension?: string;
  repairSuggestion: string;
}

export interface ReportSectionDraft {
  id: string;
  title: string;
  body: string;
  claimIds: string[];
}

export type RepairActionType =
  | "remove_claim_from_report"
  | "mark_dimension_gap"
  | "keep_with_warning";

export type RepairActionStatus = "planned" | "applied" | "unresolved";

export interface RepairAction {
  id: string;
  type: RepairActionType;
  targetType: ReviewFindingTargetType;
  targetId: string;
  severity: ReviewFinding["severity"];
  status: RepairActionStatus;
  reason: string;
  repairSuggestion: string;
  dimension?: string;
}

export interface RepairResult {
  projectId: string;
  draftQualityScore: number;
  plannedQualityScore: number;
  delta: number;
  actions: RepairAction[];
  unresolvedGaps: string[];
}

export interface WriterAgentOptions {
  buildSections?(claims: Claim[]): ReportSectionDraft[];
}

export function createAnalysisWorkflowAgents(
  options: AnalysisWorkflowAgentOptions = {}
): Record<string, WorkflowAgent> {
  return {
    extract: createExtractAgent(options),
    analyze: createAnalystAgent(options),
    write: createWriterAgent(),
    critique: createCriticAgent(),
    repair: createRepairPlannerAgent(),
    apply_repair: createApplyRepairAgent(),
    final_eval: createFinalEvaluatorAgent()
  };
}

export function createExtractAgent(
  options: AnalysisWorkflowAgentOptions = {}
): WorkflowAgent {
  return {
    name: "extract",
    role: "Extracts structured facts from source chunks.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input, context) => {
      const chunks = getLatestArtifactValue<{ chunks: SourceChunk[] }>(
        input.artifacts,
        "source_chunks"
      ).chunks;
      const requirements = getOptionalLatestArtifactValue<{
        competitors?: AnalysisRequirementCompetitor[];
        requiredDimensions?: string[];
      }>(input.artifacts, "analysis_requirements");

      if (options.model) {
        const facts = await generateStructuredObject({
          model: options.model,
          recorder: context,
          task: "extract_facts",
          system: [
            "You extract competitive-intelligence facts from source chunks.",
            "Return JSON only with a facts array.",
            "Each fact must cite at least one sourceChunkId from the provided chunks.",
            "Use competitorId values exactly from the provided competitors. Prefer competitor.id when present. Never invent competitors."
          ].join(" "),
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                projectId: input.projectId,
                competitors: requirements?.competitors ?? [],
                requiredDimensions: requirements?.requiredDimensions ?? [],
                chunks
              })
            }
          ],
          schema: modelFactsSchema,
          transform: (output) =>
            normalizeModelFacts({
              projectId: input.projectId,
              chunks,
              competitors: requirements?.competitors ?? [],
              facts: output.facts
            })
        });

        return {
          kind: "facts",
          value: {
            projectId: input.projectId,
            facts
          }
        };
      }

      const facts: Fact[] = chunks.map((chunk, index) => ({
        id: `fact_${index + 1}`,
        projectId: input.projectId,
        competitorId: inferCompetitorId(chunk, requirements?.competitors ?? []),
        dimension: inferDimension(chunk.text),
        statement: chunk.text,
        sourceChunkIds: [chunk.id],
        confidence: 0.86
      }));

      return {
        kind: "facts",
        value: { projectId: input.projectId, facts }
      };
    }
  };
}

export function createAnalystAgent(
  options: AnalysisWorkflowAgentOptions = {}
): WorkflowAgent {
  return {
    name: "analyze",
    role: "Turns structured facts into evidence-backed claims.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input, context) => {
      const facts = getLatestArtifactValue<{ facts: Fact[] }>(
        input.artifacts,
        "facts"
      ).facts;

      if (options.model) {
        const requirements = getOptionalLatestArtifactValue<{
          requiredDimensions?: string[];
        }>(input.artifacts, "analysis_requirements");
        const claims = await generateStructuredObject({
          model: options.model,
          recorder: context,
          task: "synthesize_claims",
          system: [
            "You synthesize evidence-backed competitive-intelligence claims.",
            "Return JSON only with a claims array.",
            "Every claim must cite one or more factIds from the provided facts.",
            "Do not include unsupported claims."
          ].join(" "),
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                projectId: input.projectId,
                requiredDimensions: requirements?.requiredDimensions ?? [],
                facts
              })
            }
          ],
          schema: modelClaimsSchema,
          transform: (output) =>
            normalizeModelClaims({
              projectId: input.projectId,
              facts,
              claims: output.claims
            })
        });

        return {
          kind: "claims",
          value: {
            projectId: input.projectId,
            claims
          }
        };
      }

      const claims: Claim[] = facts.map((fact, index) => ({
        id: `claim_${index + 1}`,
        projectId: input.projectId,
        dimension: fact.dimension,
        statement: `${fact.competitorId} signal: ${fact.statement}`,
        factIds: [fact.id],
        confidence: Math.min(fact.confidence, 0.84),
        kind: "single_competitor"
      }));

      return {
        kind: "claims",
        value: { projectId: input.projectId, claims }
      };
    }
  };
}

const modelFactsSchema = z.object({
  facts: z.array(
    z.object({
      competitorId: z.string().min(1),
      dimension: z.string().min(1),
      statement: z.string().min(1),
      sourceChunkIds: z.array(z.string().min(1)).min(1),
      confidence: z.number().min(0).max(1)
    })
  )
});

const modelClaimsSchema = z.object({
  claims: z.array(
    z.object({
      dimension: z.string().min(1),
      statement: z.string().min(1),
      factIds: z.array(z.string().min(1)).min(1),
      confidence: z.number().min(0).max(1),
      kind: z.enum(["single_competitor", "comparative", "recommendation"])
    })
  )
});

type ModelFactCandidate = z.infer<typeof modelFactsSchema>["facts"][number];
type ModelClaimCandidate = z.infer<typeof modelClaimsSchema>["claims"][number];

function normalizeModelFacts(input: {
  projectId: string;
  chunks: SourceChunk[];
  competitors: AnalysisRequirementCompetitor[];
  facts: ModelFactCandidate[];
}): Fact[] {
  const chunkIds = new Set(input.chunks.map((chunk) => chunk.id));
  const competitorByKey = buildCompetitorLookup(input.competitors);

  return input.facts.map((fact, index) => {
    const id = `fact_${index + 1}`;
    const competitorId = resolveModelCompetitorId({
      factId: id,
      candidate: fact.competitorId,
      competitors: input.competitors,
      competitorByKey
    });

    for (const chunkId of fact.sourceChunkIds) {
      if (!chunkIds.has(chunkId)) {
        throw new Error(`Model fact ${id} cites unknown source chunk ${chunkId}`);
      }
    }

    return {
      id,
      projectId: input.projectId,
      competitorId,
      dimension: fact.dimension,
      statement: fact.statement,
      sourceChunkIds: fact.sourceChunkIds,
      confidence: fact.confidence
    };
  });
}

function buildCompetitorLookup(
  competitors: AnalysisRequirementCompetitor[]
): Map<string, AnalysisRequirementCompetitor> {
  const lookup = new Map<string, AnalysisRequirementCompetitor>();

  for (const competitor of competitors) {
    if (competitor.id) {
      lookup.set(normalizeLookupKey(competitor.id), competitor);
    }

    lookup.set(normalizeLookupKey(competitor.name), competitor);
  }

  return lookup;
}

function resolveModelCompetitorId(input: {
  factId: string;
  candidate: string;
  competitors: AnalysisRequirementCompetitor[];
  competitorByKey: Map<string, AnalysisRequirementCompetitor>;
}): string {
  if (input.competitors.length === 0) {
    return input.candidate;
  }

  const competitor = input.competitorByKey.get(normalizeLookupKey(input.candidate));

  if (!competitor) {
    throw new Error(
      `Model fact ${input.factId} references unknown competitor ${input.candidate}`
    );
  }

  return competitor.id ?? competitor.name;
}

function normalizeModelClaims(input: {
  projectId: string;
  facts: Fact[];
  claims: ModelClaimCandidate[];
}): Claim[] {
  const factIds = new Set(input.facts.map((fact) => fact.id));

  return input.claims.map((claim, index) => {
    const id = `claim_${index + 1}`;

    for (const factId of claim.factIds) {
      if (!factIds.has(factId)) {
        throw new Error(`Model claim ${id} cites unknown fact ${factId}`);
      }
    }

    return {
      id,
      projectId: input.projectId,
      dimension: claim.dimension,
      statement: claim.statement,
      factIds: claim.factIds,
      confidence: claim.confidence,
      kind: claim.kind
    };
  });
}

export function createWriterAgent(options: WriterAgentOptions = {}): WorkflowAgent {
  return {
    name: "write",
    role: "Composes a structured report from evidence-backed claims.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const claims = getLatestArtifactValue<{ claims: Claim[] }>(
        input.artifacts,
        "claims"
      ).claims;
      const sections =
        options.buildSections?.(claims) ??
        [
          {
            id: "section_summary",
            title: "Executive Summary",
            body: claims.map((claim) => claim.statement).join("\n"),
            claimIds: claims.map((claim) => claim.id)
          }
        ];

      assertReportSectionsCiteKnownClaims(sections, claims);

      return {
        kind: "report",
        value: {
          projectId: input.projectId,
          title: "Competitive Intelligence Report",
          sections
        }
      };
    }
  };
}

function assertReportSectionsCiteKnownClaims(
  sections: ReportSectionDraft[],
  claims: Claim[]
): void {
  const claimIds = new Set(claims.map((claim) => claim.id));

  for (const section of sections) {
    for (const claimId of section.claimIds) {
      if (!claimIds.has(claimId)) {
        throw new Error(
          `Report section ${section.id} cites unknown claim ${claimId}`
        );
      }
    }
  }
}

export function createCriticAgent(): WorkflowAgent {
  return {
    name: "critique",
    role: "Reviews report claims for evidence coverage.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const facts = getLatestArtifactValue<{ facts: Fact[] }>(
        input.artifacts,
        "facts"
      ).facts;
      const claims = getLatestArtifactValue<{ claims: Claim[] }>(
        input.artifacts,
        "claims"
      ).claims;
      const report = getLatestArtifactValue<{
        sections: Array<{ id: string; title: string; claimIds: string[] }>;
      }>(input.artifacts, "report");
      const requirements = getOptionalLatestArtifactValue<{
        requiredDimensions: string[];
      }>(input.artifacts, "analysis_requirements");
      const factIds = new Set(facts.map((fact) => fact.id));
      const claimIds = new Set(claims.map((claim) => claim.id));
      const findings: ReviewFinding[] = [];

      for (const claim of claims) {
        if (claim.factIds.length === 0) {
          findings.push({
            id: `finding_${claim.id}_no_facts`,
            severity: "high",
            category: "unsupported_claim",
            message: `Claim ${claim.id} has no cited facts.`,
            targetType: "claim",
            targetId: claim.id,
            dimension: claim.dimension,
            repairSuggestion:
              "Remove the claim or attach at least one valid supporting fact before publication."
          });
        }

        for (const factId of claim.factIds) {
          if (!factIds.has(factId)) {
            findings.push({
              id: `finding_${claim.id}_unknown_${factId}`,
              severity: "high",
              category: "unknown_fact",
              message: `Claim ${claim.id} cites unknown fact ${factId}.`,
              targetType: "claim",
              targetId: claim.id,
              dimension: claim.dimension,
              repairSuggestion:
                "Replace unknown fact references with persisted facts or rerun extraction for this claim."
            });
          }
        }

        if (claim.confidence < 0.5) {
          findings.push({
            id: `finding_${claim.id}_low_confidence`,
            severity: "medium",
            category: "low_confidence",
            message: `Claim ${claim.id} has low confidence ${claim.confidence}.`,
            targetType: "claim",
            targetId: claim.id,
            dimension: claim.dimension,
            repairSuggestion:
              "Downgrade the claim wording or collect stronger evidence before keeping it in the report."
          });
        }
      }

      for (const section of report.sections) {
        if (section.claimIds.length === 0) {
          findings.push({
            id: `finding_${section.id}_no_claims`,
            severity: "high",
            category: "uncited_report_section",
            message: `Report section ${section.id} has no cited claims.`,
            targetType: "section",
            targetId: section.id,
            repairSuggestion:
              "Attach at least one evidence-backed claim to this section or remove the section."
          });
        }

        for (const claimId of section.claimIds) {
          if (!claimIds.has(claimId)) {
            findings.push({
              id: `finding_${section.id}_unknown_${claimId}`,
              severity: "high",
              category: "unknown_claim",
              message: `Report section ${section.id} cites unknown claim ${claimId}.`,
              targetType: "section",
              targetId: section.id,
              repairSuggestion:
                "Replace unknown claim references with persisted claims or rerun report writing."
            });
          }
        }
      }

      if (requirements) {
        const coveredDimensions = new Set(claims.map((claim) => claim.dimension));

        for (const dimension of requirements.requiredDimensions) {
          if (!coveredDimensions.has(dimension)) {
            findings.push({
              id: `finding_missing_dimension_${dimension}`,
              severity: "medium",
              category: "missing_dimension",
              message: `Missing required dimension ${dimension}.`,
              targetType: "dimension",
              targetId: dimension,
              dimension,
              repairSuggestion:
                "Collect or synthesize evidence-backed claims for the missing required dimension."
            });
          }
        }
      }
      const qualityScore = calculateQualityScore(findings);

      return {
        kind: "review_findings",
        value: {
          projectId: input.projectId,
          status: findings.length === 0 ? "approved" : "needs_revision",
          qualityScore,
          findings
        }
      };
    }
  };
}

export function createRepairPlannerAgent(): WorkflowAgent {
  return {
    name: "repair",
    role: "Plans deterministic repairs from targeted critic findings.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const review = getLatestArtifactValue<{
        qualityScore: number;
        findings: ReviewFinding[];
      }>(input.artifacts, "review_findings");
      const claims = getOptionalLatestArtifactValue<{ claims: Claim[] }>(
        input.artifacts,
        "claims"
      )?.claims ?? [];
      const facts = getOptionalLatestArtifactValue<{ facts: Fact[] }>(
        input.artifacts,
        "facts"
      )?.facts ?? [];
      const chunks = getOptionalLatestArtifactValue<{ chunks: SourceChunk[] }>(
        input.artifacts,
        "source_chunks"
      )?.chunks ?? [];
      const sources = getOptionalLatestArtifactValue<{ sources: Source[] }>(
        input.artifacts,
        "sources"
      )?.sources ?? [];
      const actions = dedupeRepairActions([
        ...buildRepairActions(review.findings),
        ...buildTrustRepairActions({
          claims,
          facts,
          chunks,
          sources
        })
      ]);
      const actionablePenalty = actions
        .filter((action) => action.status === "planned")
        .reduce((total, action) => total + severityPenalty(action.severity), 0);
      const plannedQualityScore = clampScore(
        review.qualityScore + actionablePenalty
      );
      const unresolvedGaps = actions
        .filter((action) => action.type === "mark_dimension_gap")
        .map((action) => action.targetId);

      return {
        kind: "repair_result",
        value: {
          projectId: input.projectId,
          draftQualityScore: review.qualityScore,
          plannedQualityScore,
          delta: plannedQualityScore - review.qualityScore,
          actions,
          unresolvedGaps
        } satisfies RepairResult
      };
    }
  };
}

export function createApplyRepairAgent(): WorkflowAgent {
  return {
    name: "apply_repair",
    role: "Applies deterministic repair plans to the report without inventing evidence.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const claims = getLatestArtifactValue<{ claims: Claim[] }>(
        input.artifacts,
        "claims"
      ).claims;
      const report = getLatestArtifactValue<{
        title: string;
        sections: ReportSectionDraft[];
      }>(input.artifacts, "report");
      const repair = getLatestArtifactValue<RepairResult>(
        input.artifacts,
        "repair_result"
      );
      const claimById = new Map(claims.map((claim) => [claim.id, claim]));
      const removalActions = repair.actions.filter(
        (action) =>
          action.type === "remove_claim_from_report" &&
          action.status === "planned"
      );
      const removedClaimIds = new Set(
        removalActions.map((action) => action.targetId)
      );
      const removedStatements = new Set(
        removalActions
          .map((action) => claimById.get(action.targetId)?.statement)
          .filter((statement): statement is string => statement !== undefined)
      );
      const sections = report.sections.map((section) => ({
        ...section,
        body: removeClaimStatementLines(section.body, removedStatements),
        claimIds: section.claimIds.filter((claimId) => !removedClaimIds.has(claimId))
      }));

      return {
        kind: "report",
        value: {
          projectId: input.projectId,
          title: report.title,
          sections,
          repair: {
            appliedActionIds: removalActions.map((action) => action.id),
            removedClaimIds: Array.from(removedClaimIds)
          }
        }
      };
    }
  };
}

export function createFinalEvaluatorAgent(): WorkflowAgent {
  return {
    name: "final_eval",
    role: "Summarizes repair-loop quality deltas.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const repair = getLatestArtifactValue<RepairResult>(
        input.artifacts,
        "repair_result"
      );
      const report = getLatestArtifactValue<{
        repair?: {
          appliedActionIds?: string[];
        };
      }>(input.artifacts, "report");
      const appliedActionIds = new Set(report.repair?.appliedActionIds ?? []);
      const actions = repair.actions.map((action) => ({
        ...action,
        status: getFinalActionStatus(action, appliedActionIds)
      }));
      const repairedQualityScore = clampScore(
        repair.draftQualityScore +
          actions
            .filter((action) => action.status === "applied")
            .reduce((total, action) => total + severityPenalty(action.severity), 0)
      );
      const delta = repairedQualityScore - repair.draftQualityScore;

      return {
        kind: "final_eval",
        value: {
          projectId: input.projectId,
          status: delta > 0 ? "improved" : "unchanged",
          draftQualityScore: repair.draftQualityScore,
          repairedQualityScore,
          delta,
          actions,
          unresolvedGaps: repair.unresolvedGaps
        }
      };
    }
  };
}

function buildRepairActions(findings: ReviewFinding[]): RepairAction[] {
  return findings.map((finding) => {
    if (
      finding.severity === "high" &&
      finding.targetType === "claim" &&
      (finding.category === "unsupported_claim" ||
        finding.category === "unknown_fact")
    ) {
      return {
        id: `repair_remove_${finding.targetId}`,
        type: "remove_claim_from_report",
        targetType: finding.targetType,
        targetId: finding.targetId,
        severity: finding.severity,
        status: "planned",
        reason: finding.message,
        repairSuggestion: finding.repairSuggestion,
        ...(finding.dimension ? { dimension: finding.dimension } : {})
      };
    }

    if (finding.category === "missing_dimension") {
      return {
        id: `repair_gap_${finding.targetId}`,
        type: "mark_dimension_gap",
        targetType: finding.targetType,
        targetId: finding.targetId,
        severity: finding.severity,
        status: "unresolved",
        reason: finding.message,
        repairSuggestion: finding.repairSuggestion,
        ...(finding.dimension ? { dimension: finding.dimension } : {})
      };
    }

    return {
      id: `repair_warn_${finding.targetType}_${finding.targetId}`,
      type: "keep_with_warning",
      targetType: finding.targetType,
      targetId: finding.targetId,
      severity: finding.severity,
      status: "unresolved",
      reason: finding.message,
      repairSuggestion: finding.repairSuggestion,
      ...(finding.dimension ? { dimension: finding.dimension } : {})
    };
  });
}

function buildTrustRepairActions(input: {
  claims: Claim[];
  facts: Fact[];
  chunks: SourceChunk[];
  sources: Source[];
}): RepairAction[] {
  return input.claims.flatMap((claim) => {
    const trust = evaluateClaimTrust({
      claim,
      facts: input.facts,
      chunks: input.chunks,
      sources: input.sources
    });
    const semanticPenalty = trust.penalties.find(
      (penalty) => penalty.code === "insufficient_semantic_support"
    );

    if (trust.riskLevel === "high" && semanticPenalty) {
      return [
        {
          id: `repair_remove_${claim.id}`,
          type: "remove_claim_from_report" as const,
          targetType: "claim" as const,
          targetId: claim.id,
          severity: "high" as const,
          status: "planned" as const,
          reason: semanticPenalty.message,
          repairSuggestion:
            "Remove this claim or collect stronger evidence before publication.",
          dimension: claim.dimension
        }
      ];
    }

    return [];
  });
}

function dedupeRepairActions(actions: RepairAction[]): RepairAction[] {
  const seen = new Set<string>();
  const deduped: RepairAction[] = [];

  for (const action of actions) {
    const key = `${action.type}:${action.targetType}:${action.targetId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(action);
  }

  return deduped;
}

function getFinalActionStatus(
  action: RepairAction,
  appliedActionIds: Set<string>
): RepairActionStatus {
  if (action.status === "planned" && appliedActionIds.has(action.id)) {
    return "applied";
  }

  return action.status;
}

function removeClaimStatementLines(
  body: string,
  removedStatements: Set<string>
): string {
  return body
    .split("\n")
    .filter((line) => !removedStatements.has(line.trim()))
    .join("\n")
    .trim();
}

function inferCompetitorId(
  chunk: SourceChunk,
  competitors: AnalysisRequirementCompetitor[]
): string {
  const text = chunk.text.toLowerCase();
  const sourceId = chunk.sourceId.toLowerCase();

  for (const competitor of competitors) {
    const normalizedName = competitor.name.toLowerCase();
    const normalizedSourceName = competitor.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (text.includes(normalizedName) || sourceId.includes(normalizedSourceName)) {
      return competitor.id ?? competitor.name;
    }
  }

  if (competitors.length > 0) {
    throw new Error(
      `Could not assign chunk ${chunk.id} to a configured competitor`
    );
  }

  return chunk.sourceId;
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function inferDimension(text: string): string {
  const normalized = text.toLowerCase();

  if (
    normalized.includes("developer experience") ||
    normalized.includes("development workflow") ||
    normalized.includes("development workflows") ||
    normalized.includes("engineering team")
  ) {
    return "developer_experience";
  }

  if (normalized.includes("pricing") || normalized.includes("plan")) {
    return "pricing";
  }

  if (normalized.includes("workflow") || normalized.includes("agent")) {
    return "positioning";
  }

  return "product";
}

function calculateQualityScore(findings: ReviewFinding[]): number {
  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === "high") {
      return total + 20;
    }

    if (finding.severity === "medium") {
      return total + 10;
    }

    return total + 5;
  }, 0);

  return Math.max(0, 100 - penalty);
}

function severityPenalty(severity: ReviewFinding["severity"]): number {
  if (severity === "high") {
    return 20;
  }

  if (severity === "medium") {
    return 10;
  }

  return 5;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}
