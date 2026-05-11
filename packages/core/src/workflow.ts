export type WorkflowNodeStatus =
  | "pending"
  | "ready"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "blocked";

export type WorkflowNodeType = "agent" | "tool" | "manual_review";

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  agentName: string;
  dependsOn: string[];
  status: WorkflowNodeStatus;
  inputArtifactIds: string[];
  outputArtifactIds: string[];
  retryCount: number;
  maxRetries: number;
  currentAgentRunId?: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface Workflow {
  id: string;
  projectId: string;
  nodes: WorkflowNode[];
}

export interface CreateWorkflowInput {
  id: string;
  projectId: string;
  nodes: WorkflowNode[];
}

export function createWorkflow(input: CreateWorkflowInput): Workflow {
  assertUniqueNodeIds(input.nodes);

  return {
    id: input.id,
    projectId: input.projectId,
    nodes: input.nodes.map((node) => ({
      ...node,
      dependsOn: [...node.dependsOn],
      inputArtifactIds: [...node.inputArtifactIds],
      outputArtifactIds: [...node.outputArtifactIds]
    }))
  };
}

export function getReadyNodes(workflow: Workflow): WorkflowNode[] {
  const succeededNodeIds = new Set(
    workflow.nodes
      .filter((node) => node.status === "succeeded")
      .map((node) => node.id)
  );

  return workflow.nodes
    .filter((node) => node.status === "pending")
    .filter((node) =>
      node.dependsOn.every((dependencyId) => succeededNodeIds.has(dependencyId))
    )
    .map((node) => ({ ...node, status: "ready" }));
}

export function markNodeRunning(
  workflow: Workflow,
  nodeId: string,
  agentRunId: string,
  now = new Date().toISOString()
): Workflow {
  return updateNode(workflow, nodeId, (node) =>
    withoutErrorMessage({
      ...node,
      status: "running",
      currentAgentRunId: agentRunId,
      startedAt: now
    })
  );
}

export function succeedNode(
  workflow: Workflow,
  nodeId: string,
  outputArtifactIds: string[],
  now = new Date().toISOString()
): Workflow {
  return updateNode(workflow, nodeId, (node) =>
    withoutErrorMessage({
      ...node,
      status: "succeeded",
      outputArtifactIds: [...outputArtifactIds],
      finishedAt: now
    })
  );
}

export function failNode(
  workflow: Workflow,
  nodeId: string,
  errorMessage: string,
  now = new Date().toISOString()
): Workflow {
  return updateNode(workflow, nodeId, (node) => {
    const retryCount = node.retryCount + 1;
    const canRetry = retryCount < node.maxRetries;

    return {
      ...node,
      status: canRetry ? "pending" : "failed",
      retryCount,
      finishedAt: now,
      errorMessage
    };
  });
}

export function blockDependents(workflow: Workflow, failedNodeId: string): Workflow {
  const blockedIds = collectDependentIds(workflow.nodes, failedNodeId);

  return {
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      blockedIds.has(node.id) && node.status !== "succeeded"
        ? { ...node, status: "blocked" }
        : { ...node }
    )
  };
}

function updateNode(
  workflow: Workflow,
  nodeId: string,
  updater: (node: WorkflowNode) => WorkflowNode
): Workflow {
  let found = false;
  const nodes = workflow.nodes.map((node) => {
    if (node.id !== nodeId) {
      return { ...node };
    }

    found = true;
    return updater({
      ...node,
      dependsOn: [...node.dependsOn],
      inputArtifactIds: [...node.inputArtifactIds],
      outputArtifactIds: [...node.outputArtifactIds]
    });
  });

  if (!found) {
    throw new Error(`Workflow node ${nodeId} does not exist`);
  }

  return { ...workflow, nodes };
}

function assertUniqueNodeIds(nodes: WorkflowNode[]): void {
  const seen = new Set<string>();

  for (const node of nodes) {
    if (seen.has(node.id)) {
      throw new Error(`Duplicate workflow node id ${node.id}`);
    }

    seen.add(node.id);
  }
}

function collectDependentIds(
  nodes: WorkflowNode[],
  failedNodeId: string
): Set<string> {
  const blockedIds = new Set<string>();
  const queue = [failedNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }

    for (const node of nodes) {
      if (node.dependsOn.includes(currentId) && !blockedIds.has(node.id)) {
        blockedIds.add(node.id);
        queue.push(node.id);
      }
    }
  }

  return blockedIds;
}

function withoutErrorMessage(node: WorkflowNode): WorkflowNode {
  const { errorMessage: _errorMessage, ...cleanNode } = node;
  return cleanNode;
}
