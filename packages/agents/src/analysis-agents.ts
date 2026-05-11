import type { Claim, Fact, SourceChunk } from "@rivalscope/core";
import {
  getLatestArtifactValue,
  getOptionalLatestArtifactValue
} from "./artifacts";
import {
  type WorkflowAgent,
  workflowAgentInputSchema,
  workflowAgentOutputSchema
} from "./workflow-schemas";

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
}

export function createAnalysisWorkflowAgents(): Record<string, WorkflowAgent> {
  return {
    extract: createExtractAgent(),
    analyze: createAnalystAgent(),
    write: createWriterAgent(),
    critique: createCriticAgent()
  };
}

export function createExtractAgent(): WorkflowAgent {
  return {
    name: "extract",
    role: "Extracts structured facts from source chunks.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const chunks = getLatestArtifactValue<{ chunks: SourceChunk[] }>(
        input.artifacts,
        "source_chunks"
      ).chunks;
      const requirements = getOptionalLatestArtifactValue<{
        competitors?: Array<{ name: string }>;
      }>(input.artifacts, "analysis_requirements");

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

export function createAnalystAgent(): WorkflowAgent {
  return {
    name: "analyze",
    role: "Turns structured facts into evidence-backed claims.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const facts = getLatestArtifactValue<{ facts: Fact[] }>(
        input.artifacts,
        "facts"
      ).facts;

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

export function createWriterAgent(): WorkflowAgent {
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

      return {
        kind: "report",
        value: {
          projectId: input.projectId,
          title: "Competitive Intelligence Report",
          sections: [
            {
              id: "section_summary",
              title: "Executive Summary",
              body: claims.map((claim) => claim.statement).join("\n"),
              claimIds: claims.map((claim) => claim.id)
            }
          ]
        }
      };
    }
  };
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
            message: `Claim ${claim.id} has no cited facts.`
          });
        }

        for (const factId of claim.factIds) {
          if (!factIds.has(factId)) {
            findings.push({
              id: `finding_${claim.id}_unknown_${factId}`,
              severity: "high",
              category: "unknown_fact",
              message: `Claim ${claim.id} cites unknown fact ${factId}.`
            });
          }
        }

        if (claim.confidence < 0.5) {
          findings.push({
            id: `finding_${claim.id}_low_confidence`,
            severity: "medium",
            category: "low_confidence",
            message: `Claim ${claim.id} has low confidence ${claim.confidence}.`
          });
        }
      }

      for (const section of report.sections) {
        if (section.claimIds.length === 0) {
          findings.push({
            id: `finding_${section.id}_no_claims`,
            severity: "high",
            category: "uncited_report_section",
            message: `Report section ${section.id} has no cited claims.`
          });
        }

        for (const claimId of section.claimIds) {
          if (!claimIds.has(claimId)) {
            findings.push({
              id: `finding_${section.id}_unknown_${claimId}`,
              severity: "high",
              category: "unknown_claim",
              message: `Report section ${section.id} cites unknown claim ${claimId}.`
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
              message: `Missing required dimension ${dimension}.`
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

function inferCompetitorId(
  chunk: SourceChunk,
  competitors: Array<{ name: string }>
): string {
  const text = chunk.text.toLowerCase();

  for (const competitor of competitors) {
    if (text.includes(competitor.name.toLowerCase())) {
      return competitor.name;
    }
  }

  return chunk.sourceId;
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
