import type {
  AgentRunStatus,
  ClaimKind,
  FindingCategory,
  FindingSeverity,
  Prisma,
  PrismaClient,
  ReportStatus,
  SourceKind,
  ToolCallStatus,
  ModelCallStatus,
  WorkflowNodeStatus,
  WorkflowNodeType
} from "@prisma/client";

export interface CreateProjectInput {
  owner: {
    email: string;
    name: string;
  };
  name: string;
  description?: string;
  competitors: Array<{
    name: string;
    website?: string;
    isPrimary?: boolean;
  }>;
  dimensions: Array<{
    key: string;
    label: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface CreateSourceInput {
  projectId: string;
  kind: SourceKind;
  title: string;
  uri: string;
  chunks: Array<{
    ordinal: number;
    text: string;
    tokenCount: number;
  }>;
}

export interface CreateWorkflowInput {
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
}

export interface CreateArtifactInput {
  projectId: string;
  kind: string;
  value: Prisma.InputJsonValue;
}

export interface CreateFactInput {
  projectId: string;
  competitorId: string;
  dimension: string;
  statement: string;
  confidence: number;
  chunkIds: string[];
}

export interface CreateClaimInput {
  projectId: string;
  dimension: string;
  statement: string;
  confidence: number;
  kind: ClaimKind;
  factIds: string[];
}

export interface CreateReportInput {
  projectId: string;
  title: string;
  status?: ReportStatus;
  qualityScore?: number;
  sections: Array<{
    sectionKey: string;
    title: string;
    body: string;
    ordinal: number;
    claimIds: string[];
  }>;
}

export interface CreateReviewFindingInput {
  projectId: string;
  reportId?: string;
  severity: FindingSeverity;
  category: FindingCategory;
  message: string;
  targetType?: string;
  targetId?: string;
  targetDimension?: string;
  repairSuggestion?: string;
}

export class ProjectRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateProjectInput) {
    return this.db.project.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        owner: {
          connectOrCreate: {
            where: { email: input.owner.email },
            create: input.owner
          }
        },
        competitors: {
          create: input.competitors.map((competitor) => ({
            name: competitor.name,
            website: competitor.website ?? null,
            isPrimary: competitor.isPrimary ?? false
          }))
        },
        analysisDimensions: {
          create: input.dimensions.map((dimension) => ({
            key: dimension.key,
            label: dimension.label,
            description: dimension.description ?? null,
            required: dimension.required ?? true
          }))
        }
      },
      include: {
        competitors: true,
        analysisDimensions: true,
        owner: true
      }
    });
  }

  async list() {
    return this.db.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        competitors: true,
        analysisDimensions: true,
        reports: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });
  }

  async get(projectId: string) {
    return this.db.project.findUnique({
      where: { id: projectId },
      include: {
        competitors: true,
        analysisDimensions: true,
        sources: { include: { chunks: true } },
        artifacts: {
          orderBy: { createdAt: "desc" },
          take: 30
        },
        workflows: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            nodes: {
              include: {
                agentRuns: {
                  orderBy: { startedAt: "desc" },
                  include: { toolCalls: true, modelCalls: true }
                }
              }
            }
          }
        },
        reports: {
          include: {
            sections: {
              include: {
                claims: {
                  include: {
                    claim: {
                      include: {
                        facts: {
                          include: {
                            fact: {
                              include: {
                                competitor: true,
                                chunks: { include: { chunk: true } }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              orderBy: { ordinal: "asc" }
            },
            reviewFindings: { orderBy: { createdAt: "asc" } }
          },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });
  }
}

export class SourceRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateSourceInput) {
    return this.db.source.create({
      data: {
        projectId: input.projectId,
        kind: input.kind,
        title: input.title,
        uri: input.uri,
        chunks: {
          create: input.chunks
        }
      },
      include: { chunks: true }
    });
  }
}

export class WorkflowRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateWorkflowInput) {
    return this.db.workflow.create({
      data: {
        projectId: input.projectId,
        nodes: {
          create: input.nodes.map((node) => ({
            nodeKey: node.nodeKey,
            type: node.type,
            agentName: node.agentName,
            dependsOn: node.dependsOn,
            status: node.status ?? "PENDING",
            inputArtifactIds: node.inputArtifactIds ?? [],
            outputArtifactIds: node.outputArtifactIds ?? [],
            retryCount: node.retryCount ?? 0,
            maxRetries: node.maxRetries ?? 1
          }))
        }
      },
      include: { nodes: true }
    });
  }

  async recordAgentRun(input: {
    workflowNodeId: string;
    agentName: string;
    status: AgentRunStatus;
    input: Prisma.InputJsonValue;
    output?: Prisma.InputJsonValue;
    errorMessage?: string;
    startedAt: Date;
    finishedAt?: Date;
    toolCalls?: Array<{
      toolName: string;
      status: ToolCallStatus;
      input: Prisma.InputJsonValue;
      output?: Prisma.InputJsonValue;
      errorMessage?: string;
      startedAt: Date;
      finishedAt: Date;
    }>;
    modelCalls?: Array<{
      provider: string;
      model?: string;
      task: string;
      status: ModelCallStatus;
      responseFormat?: string;
      input: Prisma.InputJsonValue;
      output?: Prisma.InputJsonValue;
      usage?: Prisma.InputJsonValue;
      errorMessage?: string;
      startedAt: Date;
      finishedAt: Date;
    }>;
  }) {
    const data: Prisma.AgentRunUncheckedCreateInput = {
      workflowNodeId: input.workflowNodeId,
      agentName: input.agentName,
      status: input.status,
      input: input.input,
      startedAt: input.startedAt,
      toolCalls: {
        create: input.toolCalls ?? []
      },
      modelCalls: {
        create: input.modelCalls ?? []
      }
    };

    if (input.output !== undefined) {
      data.output = input.output;
    }

    if (input.errorMessage !== undefined) {
      data.errorMessage = input.errorMessage;
    }

    if (input.finishedAt !== undefined) {
      data.finishedAt = input.finishedAt;
    }

    return this.db.agentRun.create({
      data,
      include: { toolCalls: true, modelCalls: true }
    });
  }

  async updateNodeStatuses(
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
  ) {
    return this.db.$transaction(
      nodes.map((node) => {
        const data: Prisma.WorkflowNodeUpdateInput = {
          status: node.status,
          inputArtifactIds: node.inputArtifactIds,
          outputArtifactIds: node.outputArtifactIds,
          retryCount: node.retryCount
        };

        if (node.currentAgentRunId !== undefined) {
          data.currentAgentRunId = node.currentAgentRunId;
        }

        if (node.startedAt !== undefined) {
          data.startedAt = node.startedAt;
        }

        if (node.finishedAt !== undefined) {
          data.finishedAt = node.finishedAt;
        }

        if (node.errorMessage !== undefined) {
          data.errorMessage = node.errorMessage;
        }

        return this.db.workflowNode.update({
          where: {
            workflowId_nodeKey: {
              workflowId,
              nodeKey: node.nodeKey
            }
          },
          data
        });
      })
    );
  }

  async createAgentRun(input: {
    workflowNodeId: string;
    agentName: string;
    status: AgentRunStatus;
    input: Prisma.InputJsonValue;
    output?: Prisma.InputJsonValue;
    errorMessage?: string;
    startedAt: Date;
    finishedAt?: Date;
  }) {
    const data: Prisma.AgentRunUncheckedCreateInput = {
      workflowNodeId: input.workflowNodeId,
      agentName: input.agentName,
      status: input.status,
      input: input.input,
      startedAt: input.startedAt
    };

    if (input.output !== undefined) {
      data.output = input.output;
    }

    if (input.errorMessage !== undefined) {
      data.errorMessage = input.errorMessage;
    }

    if (input.finishedAt !== undefined) {
      data.finishedAt = input.finishedAt;
    }

    return this.db.agentRun.create({ data });
  }

  async createToolCalls(
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
  ) {
    if (toolCalls.length === 0) {
      return { count: 0 };
    }

    return this.db.toolCall.createMany({
      data: toolCalls.map((toolCall) => ({
        agentRunId,
        toolName: toolCall.toolName,
        status: toolCall.status,
        input: toolCall.input,
        ...(toolCall.output !== undefined ? { output: toolCall.output } : {}),
        ...(toolCall.errorMessage !== undefined
          ? { errorMessage: toolCall.errorMessage }
          : {}),
        startedAt: toolCall.startedAt,
        finishedAt: toolCall.finishedAt
      }))
    });
  }

  async createModelCalls(
    agentRunId: string,
    modelCalls: Array<{
      provider: string;
      model?: string;
      task: string;
      status: ModelCallStatus;
      responseFormat?: string;
      input: Prisma.InputJsonValue;
      output?: Prisma.InputJsonValue;
      usage?: Prisma.InputJsonValue;
      errorMessage?: string;
      startedAt: Date;
      finishedAt: Date;
    }>
  ) {
    if (modelCalls.length === 0) {
      return { count: 0 };
    }

    return this.db.modelCall.createMany({
      data: modelCalls.map((modelCall) => ({
        agentRunId,
        provider: modelCall.provider,
        ...(modelCall.model !== undefined ? { model: modelCall.model } : {}),
        task: modelCall.task,
        status: modelCall.status,
        ...(modelCall.responseFormat !== undefined
          ? { responseFormat: modelCall.responseFormat }
          : {}),
        input: modelCall.input,
        ...(modelCall.output !== undefined ? { output: modelCall.output } : {}),
        ...(modelCall.usage !== undefined ? { usage: modelCall.usage } : {}),
        ...(modelCall.errorMessage !== undefined
          ? { errorMessage: modelCall.errorMessage }
          : {}),
        startedAt: modelCall.startedAt,
        finishedAt: modelCall.finishedAt
      }))
    });
  }
}

export class ArtifactRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateArtifactInput) {
    return this.db.artifact.create({ data: input });
  }

  async listByProject(projectId: string) {
    return this.db.artifact.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" }
    });
  }
}

export class IntelligenceRepository {
  constructor(private readonly db: PrismaClient) {}

  async createFact(input: CreateFactInput) {
    if (input.chunkIds.length === 0) {
      throw new Error("Cannot create fact without source chunk ids.");
    }

    return this.db.fact.create({
      data: {
        projectId: input.projectId,
        competitorId: input.competitorId,
        dimension: input.dimension,
        statement: input.statement,
        confidence: input.confidence,
        chunks: {
          create: input.chunkIds.map((chunkId) => ({
            chunk: { connect: { id: chunkId } }
          }))
        }
      },
      include: { chunks: true }
    });
  }

  async createClaim(input: CreateClaimInput) {
    return this.db.claim.create({
      data: {
        projectId: input.projectId,
        dimension: input.dimension,
        statement: input.statement,
        confidence: input.confidence,
        kind: input.kind,
        facts: {
          create: input.factIds.map((factId) => ({
            fact: { connect: { id: factId } }
          }))
        }
      },
      include: { facts: true }
    });
  }

  async createReport(input: CreateReportInput) {
    const data: Prisma.ReportUncheckedCreateInput = {
      projectId: input.projectId,
      title: input.title,
      status: input.status ?? "DRAFT",
      sections: {
        create: input.sections.map((section) => ({
          sectionKey: section.sectionKey,
          title: section.title,
          body: section.body,
          ordinal: section.ordinal,
          claims: {
            create: section.claimIds.map((claimId) => ({
              claim: { connect: { id: claimId } }
            }))
          }
        }))
      }
    };

    if (input.qualityScore !== undefined) {
      data.qualityScore = input.qualityScore;
    }

    return this.db.report.create({
      data,
      include: {
        sections: {
          include: { claims: true },
          orderBy: { ordinal: "asc" }
        }
      }
    });
  }

  async createReviewFindings(inputs: CreateReviewFindingInput[]) {
    if (inputs.length === 0) {
      return { count: 0 };
    }

    return this.db.reviewFinding.createMany({
      data: inputs
    });
  }
}
