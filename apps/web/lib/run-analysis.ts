import { createWorkflow } from "@rivalscope/core";
import {
  InMemoryArtifactStore,
  createDemoAnalysisWorkflowAgents,
  createDemoAnalysisWorkflowNodes,
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

export async function runAnalysis(projectId: string) {
  const project = await new ProjectRepository(prisma).get(projectId);

  if (!project) {
    throw new Error(`Project ${projectId} does not exist`);
  }

  const artifacts = new InMemoryArtifactStore();
  const requirementsArtifact = artifacts.put({
    kind: "analysis_requirements",
    value: {
      projectId,
      requiredDimensions: project.analysisDimensions
        .filter((dimension) => dimension.required)
        .map((dimension) => dimension.key),
      competitors: project.competitors.map((competitor) => ({
        id: competitor.id,
        name: competitor.name,
        website: competitor.website
      }))
    }
  });
  const workflow = createWorkflow({
    id: `workflow_${projectId}`,
    projectId,
    nodes: createDemoAnalysisWorkflowNodes([requirementsArtifact.id])
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

  const result = await runWorkflow({
    workflow,
    artifacts,
    agents: createDemoAnalysisWorkflowAgents()
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
