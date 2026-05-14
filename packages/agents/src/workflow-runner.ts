import {
  blockDependents,
  failNode,
  getReadyNodes,
  markNodeRunning,
  succeedNode,
  type Workflow,
  type WorkflowNode
} from "@rivalscope/core";
import {
  type AgentRunRecord,
  type ToolCallRecord,
  runAgent
} from "./agent";
import type { Artifact, ArtifactStore } from "./artifacts";
import type { ModelCallRecord } from "./model-client";
import type { WorkflowAgent } from "./workflow-schemas";

export interface RunWorkflowInput {
  workflow: Workflow;
  artifacts: ArtifactStore;
  agents: Record<string, WorkflowAgent>;
}

export interface RunWorkflowResult {
  workflow: Workflow;
  agentRuns: WorkflowAgentRunRecord[];
}

export interface WorkflowAgentRunRecord {
  nodeId: string;
  run: AgentRunRecord;
  toolCalls: ToolCallRecord[];
  modelCalls: ModelCallRecord[];
}

export async function runWorkflow(
  input: RunWorkflowInput
): Promise<RunWorkflowResult> {
  let workflow = input.workflow;
  const agentRuns: WorkflowAgentRunRecord[] = [];

  while (true) {
    const readyNodes = getReadyNodes(workflow);

    if (readyNodes.length === 0) {
      return { workflow, agentRuns };
    }

    for (const readyNode of readyNodes) {
      const agent = input.agents[readyNode.agentName];
      const runId = createId("agent_run");
      workflow = markNodeRunning(workflow, readyNode.id, runId);

      if (!agent) {
        workflow = failAndMaybeBlock(workflow, readyNode, "Agent not registered");
        continue;
      }

      try {
        const artifacts = resolveInputArtifacts(workflow, readyNode, input.artifacts);
        const result = await runAgent(
          agent,
          {
            projectId: workflow.projectId,
            artifacts
          },
          undefined,
          { runId }
        );
        const outputArtifact = input.artifacts.put({
          kind: result.output.kind,
          value: result.output.value
        });

        agentRuns.push({
          nodeId: readyNode.id,
          run: result.run,
          toolCalls: result.toolCalls,
          modelCalls: result.modelCalls
        });
        workflow = succeedNode(workflow, readyNode.id, [outputArtifact.id]);
      } catch (error) {
        agentRuns.push(getFailedRun(error, readyNode.id, readyNode.agentName));
        workflow = failAndMaybeBlock(
          workflow,
          readyNode,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }
}

function resolveInputArtifacts(
  workflow: Workflow,
  node: WorkflowNode,
  artifacts: ArtifactStore
): Artifact[] {
  const upstreamNodeIds = collectAncestorNodeIds(workflow.nodes, node);
  const upstreamArtifactIds = workflow.nodes
    .filter((candidate) => upstreamNodeIds.has(candidate.id))
    .filter((candidate) => candidate.status === "succeeded")
    .flatMap((candidate) => [
      ...candidate.inputArtifactIds,
      ...candidate.outputArtifactIds
    ]);
  const artifactIds = Array.from(
    new Set([...node.inputArtifactIds, ...upstreamArtifactIds])
  );

  return artifactIds.map((artifactId) => {
    const artifact = artifacts.get(artifactId);

    if (!artifact) {
      throw new Error(`Artifact ${artifactId} does not exist`);
    }

    return artifact;
  });
}

function collectAncestorNodeIds(
  nodes: WorkflowNode[],
  node: WorkflowNode
): Set<string> {
  const ancestors = new Set<string>();
  const queue = [...node.dependsOn];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || ancestors.has(currentId)) {
      continue;
    }

    ancestors.add(currentId);
    const currentNode = nodes.find((candidate) => candidate.id === currentId);
    if (currentNode) {
      queue.push(...currentNode.dependsOn);
    }
  }

  return ancestors;
}

function failAndMaybeBlock(
  workflow: Workflow,
  node: WorkflowNode,
  message: string
): Workflow {
  const failed = failNode(workflow, node.id, message);
  const updatedNode = failed.nodes.find((candidate) => candidate.id === node.id);

  if (updatedNode?.status === "failed") {
    return blockDependents(failed, node.id);
  }

  return failed;
}

function getFailedRun(
  error: unknown,
  nodeId: string,
  agentName: string
): WorkflowAgentRunRecord {
  const maybeRun = error as {
    run?: AgentRunRecord;
    toolCalls?: ToolCallRecord[];
    modelCalls?: ModelCallRecord[];
  };

  if (maybeRun.run) {
    return {
      nodeId,
      run: maybeRun.run,
      toolCalls: maybeRun.toolCalls ?? [],
      modelCalls: maybeRun.modelCalls ?? []
    };
  }

  const now = new Date().toISOString();
  return {
    nodeId,
    run: {
      id: createId("agent_run"),
      agentName,
      status: "failed",
      input: {},
      errorMessage: error instanceof Error ? error.message : String(error),
      startedAt: now,
      finishedAt: now
    },
    toolCalls: [],
    modelCalls: []
  };
}

function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}
