import type {
  AgentRunStatus,
  AtomicFactPolarity,
  ClaimKind,
  ClaimStatus,
  ClaimType,
  ClaimVerdict,
  EvidenceSpanType,
  FindingCategory,
  FindingSeverity,
  FindingTargetType,
  Prisma,
  PrismaClient,
  ReportBlockStatus,
  ReportStatus,
  SourceKind,
  ToolCallStatus,
  TraceEdgeKind,
  TraceValidationStatus,
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
  atomicFactIds?: string[];
  evidenceSpanIds?: string[];
  confidenceBreakdown?: Prisma.InputJsonValue;
  sourceQuality?: number;
  freshness?: number;
  counterEvidenceCount?: number;
  type?: ClaimType;
  status?: ClaimStatus;
  verdict?: ClaimVerdict;
}

export interface CreateSourceSnapshotInput {
  projectId: string;
  sourceId: string;
  sourceKind: SourceKind;
  title: string;
  canonicalUrl: string;
  retrievedAt: Date;
  contentHash: string;
  rawText: string;
  metadata: Prisma.InputJsonValue;
}

export interface CreateEvidenceSpanInput {
  projectId: string;
  snapshotId: string;
  sourceId: string;
  text: string;
  startOffset: number;
  endOffset: number;
  quoteHash: string;
  spanType: EvidenceSpanType;
  qualityScore: number;
  capturedAt: Date;
}

export interface CreateAtomicFactInput {
  projectId: string;
  competitorId: string;
  dimension: string;
  statement: string;
  confidence: number;
  polarity: AtomicFactPolarity;
  extractedAt: Date;
  evidenceSpanIds: string[];
}

export interface CreateKnowledgeItemInput {
  projectId: string;
  competitorId: string;
  dimension: string;
  label: string;
  summary: string;
  confidence: number;
  atomicFactIds: string[];
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
    evidenceSpanIds?: string[];
    status?: ReportBlockStatus;
  }>;
}

export interface CreateReviewFindingInput {
  projectId: string;
  reportId?: string;
  severity: FindingSeverity;
  category: FindingCategory;
  message: string;
  targetType?: FindingTargetType;
  targetId?: string;
  agentName?: string;
}

export interface CreateTraceValidationResultInput {
  projectId: string;
  status: TraceValidationStatus;
  checkedClaimIds: string[];
  checkedEvidenceSpanIds: string[];
  reportBlockIds: string[];
  findings: Prisma.InputJsonValue;
  validatedAt: Date;
}

export interface CreateTraceEdgeInput {
  projectId: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  kind: TraceEdgeKind;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateModelRunInput {
  projectId: string;
  agentRunId?: string;
  provider: string;
  model: string;
  promptHash: string;
  input: Prisma.InputJsonValue;
  output?: Prisma.InputJsonValue;
  status: AgentRunStatus;
  tokenUsage?: Prisma.InputJsonValue;
  costUsd?: number;
  startedAt: Date;
  finishedAt?: Date;
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
        sourceSnapshots: {
          include: {
            evidenceSpans: true
          },
          orderBy: { retrievedAt: "desc" }
        },
        atomicFacts: {
          include: {
            competitor: true,
            evidenceSpans: { include: { evidenceSpan: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        knowledgeItems: {
          include: {
            competitor: true,
            atomicFacts: { include: { atomicFact: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        claims: {
          include: {
            atomicFacts: { include: { atomicFact: true } },
            evidenceSpans: { include: { evidenceSpan: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        workflows: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            nodes: {
              include: {
                agentRuns: {
                  orderBy: { startedAt: "desc" },
                  include: { toolCalls: true }
                }
              }
            }
          }
        },
        reports: {
          include: {
            blocks: {
              include: {
                claims: { include: { claim: true } },
                evidenceSpans: { include: { evidenceSpan: true } }
              },
              orderBy: { ordinal: "asc" }
            },
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
        },
        traceValidations: {
          orderBy: { validatedAt: "desc" },
          take: 1
        },
        traceEdges: {
          orderBy: { createdAt: "asc" }
        },
        modelRuns: {
          orderBy: { startedAt: "asc" }
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
  }) {
    const data: Prisma.AgentRunUncheckedCreateInput = {
      workflowNodeId: input.workflowNodeId,
      agentName: input.agentName,
      status: input.status,
      input: input.input,
      startedAt: input.startedAt,
      toolCalls: {
        create: input.toolCalls ?? []
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
      include: { toolCalls: true }
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

  async createSourceSnapshot(input: CreateSourceSnapshotInput) {
    return this.db.sourceSnapshot.create({
      data: input,
      include: { evidenceSpans: true }
    });
  }

  async createEvidenceSpan(input: CreateEvidenceSpanInput) {
    return this.db.evidenceSpan.create({
      data: input,
      include: { snapshot: true }
    });
  }

  async createFact(input: CreateFactInput) {
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

  async createAtomicFact(input: CreateAtomicFactInput) {
    return this.db.atomicFact.create({
      data: {
        projectId: input.projectId,
        competitorId: input.competitorId,
        dimension: input.dimension,
        statement: input.statement,
        confidence: input.confidence,
        polarity: input.polarity,
        extractedAt: input.extractedAt,
        evidenceSpans: {
          create: input.evidenceSpanIds.map((evidenceSpanId) => ({
            evidenceSpan: { connect: { id: evidenceSpanId } }
          }))
        }
      },
      include: { evidenceSpans: true }
    });
  }

  async createKnowledgeItem(input: CreateKnowledgeItemInput) {
    return this.db.knowledgeItem.create({
      data: {
        projectId: input.projectId,
        competitorId: input.competitorId,
        dimension: input.dimension,
        label: input.label,
        summary: input.summary,
        confidence: input.confidence,
        atomicFacts: {
          create: input.atomicFactIds.map((atomicFactId) => ({
            atomicFact: { connect: { id: atomicFactId } }
          }))
        }
      },
      include: { atomicFacts: true }
    });
  }

  async createClaim(input: CreateClaimInput) {
    const usesSnapshotEvidence = (input.evidenceSpanIds?.length ?? 0) > 0;
    const legacyFactIds = usesSnapshotEvidence ? [] : input.factIds;
    const atomicFactIds = input.atomicFactIds ?? (usesSnapshotEvidence ? input.factIds : []);

    if ((input.atomicFactIds?.length ?? 0) > 0 && input.evidenceSpanIds?.length === 0) {
      throw new Error("Snapshot claim creation requires at least one evidence span");
    }

    if ((input.evidenceSpanIds?.length ?? 0) > 0 && atomicFactIds.length === 0) {
      throw new Error("Snapshot claim creation requires at least one atomic fact");
    }

    const data: Prisma.ClaimUncheckedCreateInput = {
      projectId: input.projectId,
      dimension: input.dimension,
      statement: input.statement,
      confidence: input.confidence,
        kind: input.kind,
        counterEvidenceCount: input.counterEvidenceCount ?? 0
      };

    if (input.confidenceBreakdown !== undefined) {
      data.confidenceBreakdown = input.confidenceBreakdown;
    }

    if (input.sourceQuality !== undefined) {
      data.sourceQuality = input.sourceQuality;
    }

    if (input.freshness !== undefined) {
      data.freshness = input.freshness;
    }

    if (input.type !== undefined) {
      data.type = input.type;
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (input.verdict !== undefined) {
      data.verdict = input.verdict;
    }

    return this.db.claim.create({
      data: {
        ...data,
        facts: {
          create: legacyFactIds.map((factId) => ({
            fact: { connect: { id: factId } }
          }))
        },
        atomicFacts: {
          create: atomicFactIds.map((atomicFactId) => ({
            atomicFact: { connect: { id: atomicFactId } }
          }))
        },
        evidenceSpans: {
          create: (input.evidenceSpanIds ?? []).map((evidenceSpanId) => ({
            evidenceSpan: { connect: { id: evidenceSpanId } }
          }))
        }
      },
      include: { facts: true, atomicFacts: true, evidenceSpans: true }
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
      },
      blocks: {
        create: input.sections.map((section) => ({
          projectId: input.projectId,
          blockKey: section.sectionKey,
          title: section.title,
          body: section.body,
          ordinal: section.ordinal,
          status: section.status ?? "DRAFT",
          claims: {
            create: section.claimIds.map((claimId) => ({
              claim: { connect: { id: claimId } }
            }))
          },
          evidenceSpans: {
            create: (section.evidenceSpanIds ?? []).map((evidenceSpanId) => ({
              evidenceSpan: { connect: { id: evidenceSpanId } }
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
        blocks: {
          include: { claims: true, evidenceSpans: true },
          orderBy: { ordinal: "asc" }
        },
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

  async createTraceValidationResult(input: CreateTraceValidationResultInput) {
    return this.db.traceValidationResult.create({
      data: input
    });
  }

  async createTraceEdges(inputs: CreateTraceEdgeInput[]) {
    if (inputs.length === 0) {
      return { count: 0 };
    }

    return this.db.traceEdge.createMany({
      data: inputs
    });
  }

  async createModelRuns(inputs: CreateModelRunInput[]) {
    if (inputs.length === 0) {
      return { count: 0 };
    }

    return this.db.modelRun.createMany({
      data: inputs.map((input) => ({
        projectId: input.projectId,
        agentRunId: input.agentRunId ?? null,
        provider: input.provider,
        model: input.model,
        promptHash: input.promptHash,
        input: input.input,
        ...(input.output !== undefined ? { output: input.output } : {}),
        status: input.status,
        ...(input.tokenUsage !== undefined ? { tokenUsage: input.tokenUsage } : {}),
        ...(input.costUsd !== undefined ? { costUsd: input.costUsd } : {}),
        startedAt: input.startedAt,
        ...(input.finishedAt !== undefined ? { finishedAt: input.finishedAt } : {})
      }))
    });
  }
}
