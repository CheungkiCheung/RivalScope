import { z } from "zod";
import type { Agent } from "./agent";
import type { Artifact, ArtifactKind } from "./artifacts";

export interface WorkflowAgentInput {
  projectId: string;
  artifacts: Artifact[];
}

export interface WorkflowAgentOutput {
  kind: ArtifactKind;
  value: unknown;
}

export type WorkflowAgent = Agent<WorkflowAgentInput, WorkflowAgentOutput>;

export const workflowAgentInputSchema = z.object({
  projectId: z.string(),
  artifacts: z.array(
    z.object({
      id: z.string(),
      kind: z.enum([
        "analysis_requirements",
        "source_chunks",
        "facts",
        "claims",
        "report",
        "review_findings",
        "repair_result",
        "final_eval"
      ]),
      value: z.unknown(),
      createdAt: z.string()
    })
  )
}) as z.ZodType<WorkflowAgentInput>;

export const workflowAgentOutputSchema = z.object({
  kind: z.enum([
    "analysis_requirements",
    "source_chunks",
    "facts",
    "claims",
    "report",
    "review_findings",
    "repair_result",
    "final_eval"
  ]),
  value: z.unknown()
}) as z.ZodType<WorkflowAgentOutput>;
