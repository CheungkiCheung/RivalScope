import { z } from "zod";
import type { Agent } from "./agent";
import type { Artifact, ArtifactKind } from "./artifacts";

export const artifactKindValues = [
  "analysis_requirements",
  "source_candidates",
  "policy_decisions",
  "source_snapshots",
  "parsed_documents",
  "evidence_spans",
  "atomic_facts",
  "knowledge_items",
  "source_chunks",
  "facts",
  "claims",
  "insights",
  "recommendations",
  "report",
  "report_blocks",
  "review_findings",
  "trace_validation",
  "model_runs"
] as const satisfies readonly ArtifactKind[];

export interface WorkflowAgentInput {
  projectId: string;
  artifacts: Artifact[];
}

export interface WorkflowAgentOutput {
  kind: ArtifactKind;
  value: unknown;
  artifacts?: Array<{
    kind: ArtifactKind;
    value: unknown;
  }>;
}

export type WorkflowAgent = Agent<WorkflowAgentInput, WorkflowAgentOutput>;

export const workflowAgentInputSchema = z.object({
  projectId: z.string(),
  artifacts: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(artifactKindValues),
      value: z.unknown(),
      createdAt: z.string()
    })
  )
}) as z.ZodType<WorkflowAgentInput>;

export const workflowAgentOutputSchema = z.object({
  kind: z.enum(artifactKindValues),
  value: z.unknown(),
  artifacts: z
    .array(
      z.object({
        kind: z.enum(artifactKindValues),
        value: z.unknown()
      })
    )
    .optional()
}) as z.ZodType<WorkflowAgentOutput>;
