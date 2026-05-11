import type {
  AgentRunStatus,
  Prisma,
  ToolCallStatus,
  WorkflowNodeStatus,
  WorkflowNodeType
} from "@prisma/client";
import type { ToolCallRecord } from "@rivalscope/agents";

export interface PersistSourceCollectionRepositories {
  workflow: {
    create(input: {
      projectId: string;
      nodes: Array<{
        nodeKey: string;
        type: WorkflowNodeType;
        agentName: string;
        dependsOn: string[];
        status?: WorkflowNodeStatus;
        inputArtifactIds?: string[];
        outputArtifactIds?: string[];
        retryCount?: number;
        maxRetries?: number;
      }>;
    }): Promise<{
      id: string;
      nodes: Array<{ id: string; nodeKey: string }>;
    }>;
    createAgentRun(input: {
      workflowNodeId: string;
      agentName: string;
      status: AgentRunStatus;
      input: Prisma.InputJsonValue;
      output?: Prisma.InputJsonValue;
      errorMessage?: string;
      startedAt: Date;
      finishedAt?: Date;
    }): Promise<{ id: string }>;
    createToolCalls(
      agentRunId: string,
      toolCalls: Array<{
        toolName: string;
        status: ToolCallStatus;
        input: Prisma.InputJsonValue;
        output?: Prisma.InputJsonValue;
        errorMessage?: string;
        startedAt: Date;
        finishedAt: Date;
      }>
    ): Promise<unknown>;
    updateNodeStatuses(
      workflowId: string,
      nodes: Array<{
        nodeKey: string;
        status: WorkflowNodeStatus;
        inputArtifactIds: string[];
        outputArtifactIds: string[];
        retryCount: number;
        currentAgentRunId?: string;
        startedAt?: Date;
        finishedAt?: Date;
        errorMessage?: string;
      }>
    ): Promise<unknown>;
  };
}

export interface PersistSourceCollectionRunInput {
  projectId: string;
  sourceCount: number;
  toolCalls: ToolCallRecord[];
  repositories: PersistSourceCollectionRepositories;
}

const nodeKey = "collect_sources";
const agentName = "source_collector";

export async function persistSourceCollectionRun(
  input: PersistSourceCollectionRunInput
): Promise<void> {
  const workflow = await input.repositories.workflow.create({
    projectId: input.projectId,
    nodes: [
      {
        nodeKey,
        type: "TOOL",
        agentName,
        dependsOn: [],
        status: "PENDING",
        inputArtifactIds: [],
        outputArtifactIds: [],
        retryCount: 0,
        maxRetries: 1
      }
    ]
  });
  const node = workflow.nodes.find((candidate) => candidate.nodeKey === nodeKey);

  if (!node) {
    throw new Error("Source collection workflow node was not created");
  }

  const startedAt = getRunStartedAt(input.toolCalls);
  const finishedAt = getRunFinishedAt(input.toolCalls);
  const run = await input.repositories.workflow.createAgentRun({
    workflowNodeId: node.id,
    agentName,
    status: "SUCCEEDED",
    input: { projectId: input.projectId },
    output: {
      sourceCount: input.sourceCount,
      toolCallCount: input.toolCalls.length
    },
    startedAt,
    finishedAt
  });

  await input.repositories.workflow.createToolCalls(
    run.id,
    input.toolCalls.map((toolCall) => ({
      toolName: toolCall.toolName,
      status: toolCall.status === "failed" ? "FAILED" : "SUCCEEDED",
      input: toolCall.input as Prisma.InputJsonValue,
      ...(toolCall.output !== undefined
        ? { output: toolCall.output as Prisma.InputJsonValue }
        : {}),
      ...(toolCall.errorMessage !== undefined
        ? { errorMessage: toolCall.errorMessage }
        : {}),
      startedAt: new Date(toolCall.startedAt),
      finishedAt: new Date(toolCall.finishedAt)
    }))
  );

  await input.repositories.workflow.updateNodeStatuses(workflow.id, [
    {
      nodeKey,
      status: "SUCCEEDED",
      inputArtifactIds: [],
      outputArtifactIds: [],
      retryCount: 0,
      currentAgentRunId: run.id,
      startedAt,
      finishedAt
    }
  ]);
}

function getRunStartedAt(toolCalls: ToolCallRecord[]): Date {
  const first = toolCalls
    .map((toolCall) => toolCall.startedAt)
    .sort((left, right) => left.localeCompare(right))[0];

  return first ? new Date(first) : new Date();
}

function getRunFinishedAt(toolCalls: ToolCallRecord[]): Date {
  const last = toolCalls
    .map((toolCall) => toolCall.finishedAt)
    .sort((left, right) => right.localeCompare(left))[0];

  return last ? new Date(last) : new Date();
}
