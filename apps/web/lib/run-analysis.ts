import { createWorkflow, type WorkflowNode } from "@rivalscope/core";
import {
  InMemoryArtifactStore,
  createAnalysisWorkflowAgents,
  runWorkflow
} from "@rivalscope/agents";
import {
  ArtifactRepository,
  IntelligenceRepository,
  ProjectRepository,
  WorkflowRepository,
  prisma
} from "@rivalscope/db";
import {
  persistAnalysisExecution,
  type PersistAnalysisRepositories
} from "./analysis-persistence";
import { createAnalysisAgentOptionsFromEnv } from "./model-client-env";

export async function runAnalysis(projectId: string) {
  const project = await new ProjectRepository(prisma).get(projectId);

  if (!project) {
    throw new Error(`Project ${projectId} does not exist`);
  }

  const artifacts = new InMemoryArtifactStore();
  const sourcesArtifact = artifacts.put({
    kind: "sources",
    value: {
      projectId,
      sources: project.sources.map((source) => ({
        id: source.id,
        projectId,
        kind: source.kind.toLowerCase(),
        title: source.title,
        uri: source.uri,
        collectedAt: source.collectedAt.toISOString()
      }))
    }
  });
  const sourceChunks = project.sources.flatMap((source) =>
    source.chunks.map((chunk) => ({
      id: chunk.id,
      sourceId: source.id,
      ordinal: chunk.ordinal,
      text: chunk.text,
      tokenCount: chunk.tokenCount
    }))
  );

  const sourceArtifact = artifacts.put({
    kind: "source_chunks",
    value: {
      projectId,
      chunks: sourceChunks
    }
  });
  const requirementsArtifact = artifacts.put({
    kind: "analysis_requirements",
    value: buildAnalysisRequirements(project)
  });
  const workflow = createWorkflow({
    id: `workflow_${projectId}`,
    projectId,
    nodes: buildMvpWorkflowNodes([
      sourcesArtifact.id,
      sourceArtifact.id,
      requirementsArtifact.id
    ])
  });

  const workflowRecord = await new WorkflowRepository(prisma).create({
    projectId,
    nodes: workflow.nodes.map((node) => ({
      nodeKey: node.id,
      type: "AGENT",
      agentName: node.agentName,
      dependsOn: node.dependsOn,
      status: "PENDING",
      inputArtifactIds: node.inputArtifactIds,
      outputArtifactIds: [],
      retryCount: 0,
      maxRetries: node.maxRetries
    }))
  });
  const analysisAgentOptions = createAnalysisAgentOptionsFromEnv(process.env);

  const result = await runWorkflow({
    workflow,
    artifacts,
    agents: createAnalysisWorkflowAgents(analysisAgentOptions)
  });

  const workflowRepository = new WorkflowRepository(prisma);
  const artifactRepository = new ArtifactRepository(prisma);
  const intelligenceRepository = new IntelligenceRepository(prisma);

  const persisted = await persistAnalysisExecution({
    projectId,
    competitors: project.competitors.map((competitor) => ({
      id: competitor.id,
      name: competitor.name
    })),
    workflowRecord: {
      id: workflowRecord.id,
      nodes: workflowRecord.nodes.map((node) => ({
        id: node.id,
        nodeKey: node.nodeKey
      }))
    },
    workflow: result.workflow,
    agentRuns: result.agentRuns,
    artifacts: artifacts.list(),
    repositories: {
      workflow: workflowRepository,
      artifact: artifactRepository,
      intelligence: intelligenceRepository
    } satisfies PersistAnalysisRepositories
  });

  return {
    workflow: persisted.workflow,
    workflowRecord,
    agentRuns: result.agentRuns,
    artifacts: persisted.artifacts
  };
}

export function buildAnalysisRequirements(project: {
  description?: string | null;
  competitors: Array<{ id: string; name: string }>;
  analysisDimensions: Array<{ key: string; required: boolean }>;
}) {
  return {
    competitors: project.competitors.map((competitor) => ({
      id: competitor.id,
      name: competitor.name
    })),
    requiredDimensions: project.analysisDimensions
      .filter((dimension) => dimension.required)
      .map((dimension) => dimension.key),
    ...(project.description?.includes("[demo:repair_lift]")
      ? { demoScenario: "repair_lift" }
      : {})
  };
}

export function buildMvpWorkflowNodes(inputArtifactIds: string[]): WorkflowNode[] {
  return [
    {
      id: "extract",
      type: "agent",
      agentName: "extract",
      dependsOn: [],
      status: "pending",
      inputArtifactIds,
      outputArtifactIds: [],
      retryCount: 0,
      maxRetries: 1
    },
    {
      id: "analyze",
      type: "agent",
      agentName: "analyze",
      dependsOn: ["extract"],
      status: "pending",
      inputArtifactIds: [],
      outputArtifactIds: [],
      retryCount: 0,
      maxRetries: 1
    },
    {
      id: "write",
      type: "agent",
      agentName: "write",
      dependsOn: ["analyze"],
      status: "pending",
      inputArtifactIds: [],
      outputArtifactIds: [],
      retryCount: 0,
      maxRetries: 1
    },
    {
      id: "critique",
      type: "agent",
      agentName: "critique",
      dependsOn: ["write"],
      status: "pending",
      inputArtifactIds: [],
      outputArtifactIds: [],
      retryCount: 0,
      maxRetries: 1
    },
    {
      id: "judge_compare",
      type: "agent",
      agentName: "judge_compare",
      dependsOn: ["critique"],
      status: "pending",
      inputArtifactIds: [],
      outputArtifactIds: [],
      retryCount: 0,
      maxRetries: 1
    },
    {
      id: "repair",
      type: "agent",
      agentName: "repair",
      dependsOn: ["critique", "judge_compare"],
      status: "pending",
      inputArtifactIds: [],
      outputArtifactIds: [],
      retryCount: 0,
      maxRetries: 1
    },
    {
      id: "apply_repair",
      type: "agent",
      agentName: "apply_repair",
      dependsOn: ["repair"],
      status: "pending",
      inputArtifactIds: [],
      outputArtifactIds: [],
      retryCount: 0,
      maxRetries: 1
    },
    {
      id: "final_eval",
      type: "agent",
      agentName: "final_eval",
      dependsOn: ["apply_repair"],
      status: "pending",
      inputArtifactIds: [],
      outputArtifactIds: [],
      retryCount: 0,
      maxRetries: 1
    },
    {
      id: "trust_snapshot",
      type: "agent",
      agentName: "trust_snapshot",
      dependsOn: ["final_eval"],
      status: "pending",
      inputArtifactIds: [],
      outputArtifactIds: [],
      retryCount: 0,
      maxRetries: 1
    }
  ];
}
