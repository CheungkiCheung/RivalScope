import {
  validateTrace,
  type Claim,
  type Fact,
  type ReportBlock,
  type ReviewFinding,
  type SourceChunk
} from "@rivalscope/core";
import { z } from "zod";
import {
  getLatestArtifactValue,
  getOptionalLatestArtifactValue
} from "./artifacts";
import { createTool } from "./agent";
import type { WorkflowNode } from "@rivalscope/core";
import { createDemoFixtures, type DemoFixtures } from "./demo-fixtures";
import {
  type WorkflowAgent,
  workflowAgentInputSchema,
  workflowAgentOutputSchema
} from "./workflow-schemas";

export interface LegacyReviewFinding {
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

export function createDemoAnalysisWorkflowAgents(): Record<string, WorkflowAgent> {
  return {
    research_planner: createResearchPlannerAgent(),
    collector: createCollectorAgent(),
    snapshot_parser: createSnapshotParserAgent(),
    extractor: createDemoExtractorAgent(),
    knowledge_structurer: createKnowledgeStructurerAgent(),
    analyst: createDemoAnalystAgent(),
    skeptic: createSkepticAgent(),
    confidence_scorer: createConfidenceScorerAgent(),
    writer: createDemoWriterAgent(),
    critic: createDemoCriticAgent(),
    trace_validator: createTraceValidatorAgent()
  };
}

export function createDemoAnalysisWorkflowNodes(
  inputArtifactIds: string[] = []
): WorkflowNode[] {
  const node = (
    id: string,
    dependsOn: string[],
    inputs: string[] = []
  ): WorkflowNode => ({
    id,
    type: "agent",
    agentName: id,
    dependsOn,
    status: "pending",
    inputArtifactIds: inputs,
    outputArtifactIds: [],
    retryCount: 0,
    maxRetries: 1
  });

  return [
    node("research_planner", [], inputArtifactIds),
    node("collector", ["research_planner"]),
    node("snapshot_parser", ["collector"]),
    node("extractor", ["snapshot_parser"]),
    node("knowledge_structurer", ["extractor"]),
    node("analyst", ["knowledge_structurer"]),
    node("skeptic", ["analyst"]),
    node("confidence_scorer", ["skeptic"]),
    node("writer", ["confidence_scorer"]),
    node("critic", ["writer"]),
    node("trace_validator", ["critic"])
  ];
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
      const findings: LegacyReviewFinding[] = [];

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

export function createResearchPlannerAgent(): WorkflowAgent {
  return {
    name: "research_planner",
    role: "Plans the deterministic demo research scope.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const fixtures = createDemoFixtures(input.projectId);
      const requirements = getOptionalLatestArtifactValue<{
        competitors?: Array<{ name: string }>;
        requiredDimensions?: string[];
      }>(input.artifacts, "analysis_requirements");

      return {
        kind: "source_candidates",
        value: {
          projectId: input.projectId,
          plan: {
            competitors: requirements?.competitors ?? [
              { name: "Cursor" },
              { name: "Codex" },
              { name: "Trae" }
            ],
            dimensions: requirements?.requiredDimensions ?? [
              "pricing",
              "positioning",
              "developer_experience"
            ],
            mode: "deterministic_fixture"
          },
          candidates: fixtures.sourceCandidates
        }
      };
    }
  };
}

export function createCollectorAgent(): WorkflowAgent {
  const sourceDiscoveryTool = createTool({
    name: "demo_source_discovery",
    description: "Returns deterministic source candidates for the demo case.",
    inputSchema: z.object({ projectId: z.string() }),
    outputSchema: z.object({
      candidates: z.array(z.unknown()),
      policyDecisions: z.array(z.unknown())
    }),
    execute: async (input) => {
      const fixtures = createDemoFixtures(input.projectId);

      return {
        candidates: fixtures.sourceCandidates,
        policyDecisions: fixtures.policyDecisions
      };
    }
  });

  return {
    name: "collector",
    role: "Applies policy decisions to fixture source candidates.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input, context) => {
      getLatestArtifactValue(input.artifacts, "source_candidates");
      const output = await context.callTool(sourceDiscoveryTool, {
        projectId: input.projectId
      });

      return {
        kind: "policy_decisions",
        value: {
          projectId: input.projectId,
          candidates: output.candidates,
          policyDecisions: output.policyDecisions
        }
      };
    }
  };
}

export function createSnapshotParserAgent(): WorkflowAgent {
  const snapshotFetchTool = createTool({
    name: "demo_snapshot_fetch",
    description: "Freezes deterministic source snapshots for the demo case.",
    inputSchema: z.object({
      projectId: z.string(),
      allowedCandidateIds: z.array(z.string())
    }),
    outputSchema: z.object({
      snapshots: z.array(z.unknown()),
      parsedDocuments: z.array(z.unknown())
    }),
    execute: async (input) => {
      const fixtures = createDemoFixtures(input.projectId);

      return {
        snapshots: fixtures.sourceSnapshots,
        parsedDocuments: fixtures.parsedDocuments
      };
    }
  });

  return {
    name: "snapshot_parser",
    role: "Freezes source snapshots and parses normalized documents.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input, context) => {
      const policy = getLatestArtifactValue<{
        policyDecisions: Array<{ candidateId: string; status: string }>;
      }>(input.artifacts, "policy_decisions");
      const allowedCandidateIds = policy.policyDecisions
        .filter((decision) => decision.status === "allowed")
        .map((decision) => decision.candidateId);
      const output = await context.callTool(snapshotFetchTool, {
        projectId: input.projectId,
        allowedCandidateIds
      });

      return {
        kind: "source_snapshots",
        value: {
          projectId: input.projectId,
          snapshots: output.snapshots
        },
        artifacts: [
          {
            kind: "parsed_documents",
            value: {
              projectId: input.projectId,
              parsedDocuments: output.parsedDocuments
            }
          }
        ]
      };
    }
  };
}

export function createDemoExtractorAgent(): WorkflowAgent {
  return {
    name: "extractor",
    role: "Extracts exact evidence spans and atomic facts from frozen snapshots.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const fixtures = createDemoFixtures(input.projectId);
      const snapshotPayload = getLatestArtifactValue<{
        snapshots: unknown[];
      }>(input.artifacts, "source_snapshots");
      const parsedDocumentPayload = getLatestArtifactValue<{
        parsedDocuments: unknown[];
      }>(input.artifacts, "parsed_documents");

      return {
        kind: "evidence_spans",
        value: {
          projectId: input.projectId,
          snapshots: snapshotPayload.snapshots,
          parsedDocuments: parsedDocumentPayload.parsedDocuments,
          evidenceSpans: fixtures.evidenceSpans
        },
        artifacts: [
          {
            kind: "atomic_facts",
            value: {
              projectId: input.projectId,
              atomicFacts: fixtures.atomicFacts
            }
          }
        ]
      };
    }
  };
}

export function createKnowledgeStructurerAgent(): WorkflowAgent {
  return {
    name: "knowledge_structurer",
    role: "Structures atomic facts into competitive knowledge items.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const fixtures = createDemoFixtures(input.projectId);
      const evidencePayload = getLatestArtifactValue<{
        atomicFacts: unknown[];
      }>(input.artifacts, "atomic_facts");

      return {
        kind: "knowledge_items",
        value: {
          projectId: input.projectId,
          atomicFacts: evidencePayload.atomicFacts,
          knowledgeItems: fixtures.knowledgeItems
        }
      };
    }
  };
}

export function createDemoAnalystAgent(): WorkflowAgent {
  return {
    name: "analyst",
    role: "Synthesizes claims from structured knowledge and cited evidence.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const fixtures = createDemoFixtures(input.projectId);
      getLatestArtifactValue(input.artifacts, "knowledge_items");

      return {
        kind: "claims",
        value: {
          projectId: input.projectId,
          claims: fixtures.claims
        }
      };
    }
  };
}

export function createSkepticAgent(): WorkflowAgent {
  return {
    name: "skeptic",
    role: "Challenges weak or contradictory claims.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const fixtures = createDemoFixtures(input.projectId);
      const claims = getLatestArtifactValue<{ claims: Claim[] }>(
        input.artifacts,
        "claims"
      ).claims;
      const findings = fixtures.reviewFindings.filter(
        (finding) => finding.agentName === "skeptic"
      );

      return {
        kind: "review_findings",
        value: {
          projectId: input.projectId,
          status: "needs_revision",
          qualityScore: 88,
          claims,
          findings
        }
      };
    }
  };
}

export function createConfidenceScorerAgent(): WorkflowAgent {
  return {
    name: "confidence_scorer",
    role: "Scores claims with confidence breakdowns and routing decisions.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const claimPayload = getLatestArtifactValue<{ claims: Claim[] }>(
        input.artifacts,
        "claims"
      );
      const skepticPayload = getLatestArtifactValue<{ findings: ReviewFinding[] }>(
        input.artifacts,
        "review_findings"
      );

      return {
        kind: "model_runs",
        value: {
          projectId: input.projectId,
          modelRuns: [
            {
              id: "model_run_confidence_fixture",
              provider: "fixture",
              model: "deterministic-confidence-v1",
              status: "succeeded",
              promptHash: "sha256:confidence-fixture",
              input: {
                claimIds: claimPayload.claims.map((claim) => claim.id)
              },
              output: {
                approvedClaimIds: claimPayload.claims
                  .filter((claim) => claim.status === "approved")
                  .map((claim) => claim.id),
                needsEvidenceClaimIds: claimPayload.claims
                  .filter((claim) => claim.status === "needs_evidence")
                  .map((claim) => claim.id)
              }
            }
          ],
          claims: claimPayload.claims,
          findings: skepticPayload.findings
        }
      };
    }
  };
}

export function createDemoWriterAgent(): WorkflowAgent {
  return {
    name: "writer",
    role: "Writes report blocks from approved and reviewed evidence artifacts.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const fixtures = createDemoFixtures(input.projectId);
      getLatestArtifactValue(input.artifacts, "model_runs");

      return {
        kind: "report_blocks",
        value: {
          projectId: input.projectId,
          title: "Competitive Intelligence Report",
          reportBlocks: fixtures.reportBlocks
        }
      };
    }
  };
}

export function createDemoCriticAgent(): WorkflowAgent {
  return {
    name: "critic",
    role: "Reviews report blocks and keeps earlier skeptic findings visible.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const fixtures = createDemoFixtures(input.projectId);
      const report = getLatestArtifactValue<{ reportBlocks: ReportBlock[] }>(
        input.artifacts,
        "report_blocks"
      );
      const criticFindings = fixtures.reviewFindings.filter(
        (finding) => finding.agentName === "critic"
      );

      return {
        kind: "review_findings",
        value: {
          projectId: input.projectId,
          status: "reviewed",
          qualityScore: 92,
          reportBlockIds: report.reportBlocks.map((block) => block.id),
          findings: fixtures.reviewFindings,
          criticFindings
        }
      };
    }
  };
}

export function createTraceValidatorAgent(): WorkflowAgent {
  return {
    name: "trace_validator",
    role: "Deterministically validates claim and report block lineage.",
    inputSchema: workflowAgentInputSchema,
    outputSchema: workflowAgentOutputSchema,
    run: async (input) => {
      const sourceSnapshotPayload = getLatestArtifactValue<{
        snapshots: DemoFixtures["sourceSnapshots"];
      }>(input.artifacts, "source_snapshots");
      const evidencePayload = getLatestArtifactValue<{
        evidenceSpans: DemoFixtures["evidenceSpans"];
      }>(input.artifacts, "evidence_spans");
      const atomicFactPayload = getLatestArtifactValue<{
        atomicFacts: DemoFixtures["atomicFacts"];
      }>(input.artifacts, "atomic_facts");
      const claimsPayload = getLatestArtifactValue<{ claims: Claim[] }>(
        input.artifacts,
        "claims"
      );
      const reportPayload = getLatestArtifactValue<{ reportBlocks: ReportBlock[] }>(
        input.artifacts,
        "report_blocks"
      );
      const traceResult = validateTrace({
        reportBlocks: reportPayload.reportBlocks,
        claims: claimsPayload.claims,
        atomicFacts: atomicFactPayload.atomicFacts,
        evidenceSpans: evidencePayload.evidenceSpans,
        sourceSnapshots: sourceSnapshotPayload.snapshots
      });

      return {
        kind: "trace_validation",
        value: {
          projectId: input.projectId,
          ...traceResult,
          reportBlockIds: reportPayload.reportBlocks.map((block) => block.id)
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

function calculateQualityScore(findings: LegacyReviewFinding[]): number {
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
