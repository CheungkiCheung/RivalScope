import type {
  ClaimKind,
  FindingCategory,
  FindingSeverity,
  Prisma,
  ReportStatus,
  WorkflowNodeStatus,
  AgentRunStatus,
  ToolCallStatus,
  ModelCallStatus
} from "@prisma/client";
import type { Workflow } from "@rivalscope/core";
import type {
  Artifact,
  WorkflowAgentRunRecord
} from "@rivalscope/agents";

export interface PersistedWorkflowNodeRecord {
  id: string;
  nodeKey: string;
}

export interface PersistAnalysisRepositories {
  workflow: {
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
    createModelCalls(
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
  artifact: {
    create(input: {
      projectId: string;
      kind: string;
      value: Prisma.InputJsonValue;
    }): Promise<{ id: string }>;
  };
  intelligence: {
    createFact(input: {
      projectId: string;
      competitorId: string;
      dimension: string;
      statement: string;
      confidence: number;
      chunkIds: string[];
    }): Promise<{ id: string }>;
    createClaim(input: {
      projectId: string;
      dimension: string;
      statement: string;
      confidence: number;
      kind: ClaimKind;
      factIds: string[];
    }): Promise<{ id: string }>;
    createReport(input: {
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
    }): Promise<{ id: string }>;
    createReviewFindings(inputs: Array<{
      projectId: string;
      reportId?: string;
      severity: FindingSeverity;
      category: FindingCategory;
      message: string;
      targetType?: string;
      targetId?: string;
      targetDimension?: string;
      repairSuggestion?: string;
    }>): Promise<unknown>;
  };
}

export interface PersistAnalysisExecutionInput {
  projectId: string;
  competitors: Array<{ id: string; name: string }>;
  workflowRecord: {
    id: string;
    nodes: PersistedWorkflowNodeRecord[];
  };
  workflow: Workflow;
  agentRuns: WorkflowAgentRunRecord[];
  artifacts: Artifact[];
  repositories: PersistAnalysisRepositories;
}

export interface PersistAnalysisExecutionResult {
  workflow: Workflow;
  artifacts: Array<{ id: string }>;
  report?: { id: string };
}

export async function persistAnalysisExecution(
  input: PersistAnalysisExecutionInput
): Promise<PersistAnalysisExecutionResult> {
  const persistedArtifacts = await persistArtifacts(
    input.projectId,
    input.artifacts,
    input.repositories.artifact
  );

  const persistedArtifactIds = new Map(
    input.artifacts.map((artifact, index) => [artifact.id, persistedArtifacts[index]?.id])
  );

  const persistedRunIds = new Map<string, string>();

  for (const agentRun of input.agentRuns) {
    const workflowNode = input.workflowRecord.nodes.find(
      (node) => node.nodeKey === agentRun.nodeId
    );

    if (!workflowNode) {
      continue;
    }

    const persistedRun = await input.repositories.workflow.createAgentRun({
      workflowNodeId: workflowNode.id,
      agentName: agentRun.run.agentName,
      status: toDbAgentRunStatus(agentRun.run.status),
      input: agentRun.run.input as Prisma.InputJsonValue,
      ...(agentRun.run.output !== undefined
        ? { output: agentRun.run.output as Prisma.InputJsonValue }
        : {}),
      ...(agentRun.run.errorMessage !== undefined
        ? { errorMessage: agentRun.run.errorMessage }
        : {}),
      startedAt: new Date(agentRun.run.startedAt),
      ...(agentRun.run.finishedAt
        ? { finishedAt: new Date(agentRun.run.finishedAt) }
        : {})
    });
    persistedRunIds.set(agentRun.run.id, persistedRun.id);

    await input.repositories.workflow.createToolCalls(
      persistedRun.id,
      agentRun.toolCalls.map((toolCall) => ({
        toolName: toolCall.toolName,
        status: toDbToolCallStatus(toolCall.status),
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
    await input.repositories.workflow.createModelCalls(
      persistedRun.id,
      agentRun.modelCalls.map((modelCall) => ({
        provider: modelCall.provider,
        ...(modelCall.model !== undefined ? { model: modelCall.model } : {}),
        task: modelCall.task,
        status: toDbModelCallStatus(modelCall.status),
        ...(modelCall.responseFormat !== undefined
          ? { responseFormat: modelCall.responseFormat }
          : {}),
        input: modelCall.input as Prisma.InputJsonValue,
        ...(modelCall.output !== undefined
          ? { output: modelCall.output as Prisma.InputJsonValue }
          : {}),
        ...(modelCall.usage !== undefined
          ? { usage: modelCall.usage as Prisma.InputJsonValue }
          : {}),
        ...(modelCall.errorMessage !== undefined
          ? { errorMessage: modelCall.errorMessage }
          : {}),
        startedAt: new Date(modelCall.startedAt),
        finishedAt: new Date(modelCall.finishedAt)
      }))
    );
  }

  const updatedWorkflow: Workflow = {
    ...input.workflow,
    nodes: input.workflow.nodes.map((node) => ({
      ...node,
      inputArtifactIds: node.inputArtifactIds.map(
        (artifactId) => persistedArtifactIds.get(artifactId) ?? artifactId
      ),
      outputArtifactIds: node.outputArtifactIds.map(
        (artifactId) => persistedArtifactIds.get(artifactId) ?? artifactId
      ),
      ...(node.currentAgentRunId
        ? {
            currentAgentRunId:
              persistedRunIds.get(node.currentAgentRunId) ?? node.currentAgentRunId
          }
        : {}),
      ...(node.startedAt ? { startedAt: node.startedAt } : {}),
      ...(node.finishedAt ? { finishedAt: node.finishedAt } : {}),
      ...(node.errorMessage ? { errorMessage: node.errorMessage } : {})
    }))
  };

  await input.repositories.workflow.updateNodeStatuses(
    input.workflowRecord.id,
    updatedWorkflow.nodes.map((node) => ({
      nodeKey: node.id,
      status: toDbNodeStatus(node.status),
      inputArtifactIds: node.inputArtifactIds,
      outputArtifactIds: node.outputArtifactIds,
      retryCount: node.retryCount,
      ...(node.currentAgentRunId
        ? { currentAgentRunId: node.currentAgentRunId }
        : {}),
      ...(node.startedAt ? { startedAt: new Date(node.startedAt) } : {}),
      ...(node.finishedAt ? { finishedAt: new Date(node.finishedAt) } : {}),
      ...(node.errorMessage ? { errorMessage: node.errorMessage } : {})
    }))
  );

  const intelligence = shouldPersistIntelligence(input.workflow, input.artifacts)
    ? await persistIntelligence(
        input.projectId,
        input.competitors,
        input.artifacts,
        input.repositories.intelligence
      )
    : undefined;

  return {
    workflow: updatedWorkflow,
    artifacts: persistedArtifacts,
    ...(intelligence ? { report: intelligence.report } : {})
  };
}

async function persistArtifacts(
  projectId: string,
  artifacts: Artifact[],
  repository: PersistAnalysisRepositories["artifact"]
) {
  return Promise.all(
    artifacts.map((artifact) =>
      repository.create({
        projectId,
        kind: artifact.kind,
        value: artifact.value as Prisma.InputJsonValue
      })
    )
  );
}

async function persistIntelligence(
  projectId: string,
  competitors: Array<{ id: string; name: string }>,
  artifacts: Artifact[],
  repository: PersistAnalysisRepositories["intelligence"]
) {
  const factsArtifact = findArtifact<{
    facts: Array<{
      id: string;
      competitorId: string;
      dimension: string;
      statement: string;
      sourceChunkIds: string[];
      confidence: number;
    }>;
  }>(artifacts, "facts");
  const claimsArtifact = findArtifact<{
    claims: Array<{
      id: string;
      dimension: string;
      statement: string;
      factIds: string[];
      confidence: number;
      kind: string;
    }>;
  }>(artifacts, "claims");
  const reportArtifact = findArtifact<{
    title: string;
    sections: Array<{
      id: string;
      title: string;
      body: string;
      claimIds: string[];
    }>;
  }>(artifacts, "report");
  const findingsArtifact = findArtifact<{
    qualityScore: number;
    findings: Array<{
      severity: string;
      category: string;
      message: string;
      targetType?: string;
      targetId?: string;
      dimension?: string;
      repairSuggestion?: string;
    }>;
  }>(artifacts, "review_findings");
  validateClaimDimensions(factsArtifact, claimsArtifact);

  const competitorByKey = new Map(
    competitors.flatMap((competitor) => [
      [competitor.id.toLowerCase(), competitor.id],
      [competitor.name.toLowerCase(), competitor.id]
    ])
  );
  const persistedFactIds = new Map<string, string>();

  for (const fact of factsArtifact.facts) {
    const competitorId = competitorByKey.get(fact.competitorId.toLowerCase());

    if (fact.sourceChunkIds.length === 0) {
      throw new Error(
        `Fact ${fact.id} cannot be persisted without source chunks.`
      );
    }

    if (!competitorId) {
      throw new Error(
        `Fact ${fact.id} references unknown competitor ${fact.competitorId}`
      );
    }

    const persistedFact = await repository.createFact({
      projectId,
      competitorId,
      dimension: fact.dimension,
      statement: fact.statement,
      confidence: fact.confidence,
      chunkIds: fact.sourceChunkIds
    });
    persistedFactIds.set(fact.id, persistedFact.id);
  }

  const persistedClaimIds = new Map<string, string>();
  for (const claim of claimsArtifact.claims) {
    const factIds = claim.factIds
      .map((factId) => persistedFactIds.get(factId))
      .filter((factId): factId is string => Boolean(factId));

    if (factIds.length === 0) {
      continue;
    }

    const persistedClaim = await repository.createClaim({
      projectId,
      dimension: claim.dimension,
      statement: claim.statement,
      confidence: claim.confidence,
      kind: toClaimKind(claim.kind),
      factIds
    });
    persistedClaimIds.set(claim.id, persistedClaim.id);
  }

  const report = await repository.createReport({
    projectId,
    title: reportArtifact.title,
    qualityScore: findingsArtifact.qualityScore,
    status: findingsArtifact.findings.length === 0 ? "FINAL" : "REVIEWED",
    sections: reportArtifact.sections.map((section, index) => ({
      sectionKey: section.id,
      title: section.title,
      body: section.body,
      ordinal: index,
      claimIds: section.claimIds
        .map((claimId) => persistedClaimIds.get(claimId))
        .filter((claimId): claimId is string => Boolean(claimId))
    }))
  });

  await repository.createReviewFindings(
    findingsArtifact.findings.map((finding) => ({
      projectId,
      reportId: report.id,
      severity: toFindingSeverity(finding.severity),
      category: toFindingCategory(finding.category),
      message: finding.message,
      ...(finding.targetType !== undefined ? { targetType: finding.targetType } : {}),
      ...(finding.targetId !== undefined ? { targetId: finding.targetId } : {}),
      ...(finding.dimension !== undefined
        ? { targetDimension: finding.dimension }
        : {}),
      ...(finding.repairSuggestion !== undefined
        ? { repairSuggestion: finding.repairSuggestion }
        : {})
    }))
  );

  return { report };
}

function shouldPersistIntelligence(workflow: Workflow, artifacts: Artifact[]): boolean {
  if (!workflow.nodes.every((node) => node.status === "succeeded")) {
    return false;
  }

  const artifactKinds = new Set(artifacts.map((artifact) => artifact.kind));

  return ["facts", "claims", "report", "review_findings"].every((kind) =>
    artifactKinds.has(kind as Artifact["kind"])
  );
}

function findArtifact<T>(artifacts: Artifact[], kind: string): T {
  const artifact = [...artifacts].reverse().find((candidate) => candidate.kind === kind);

  if (!artifact) {
    throw new Error(`Missing artifact ${kind}`);
  }

  return artifact.value as T;
}

function validateClaimDimensions(
  factsArtifact: {
    facts: Array<{
      id: string;
      dimension: string;
    }>;
  },
  claimsArtifact: {
    claims: Array<{
      id: string;
      dimension: string;
      factIds: string[];
    }>;
  }
) {
  for (const claim of claimsArtifact.claims) {
    const sourceClaimDimensions = new Set(
      claim.factIds
        .map((factId) => factsArtifact.facts.find((fact) => fact.id === factId))
        .filter(
          (fact): fact is (typeof factsArtifact)["facts"][number] =>
            fact !== undefined
        )
        .map((fact) => fact.dimension)
    );

    if (
      sourceClaimDimensions.size > 1 ||
      !sourceClaimDimensions.has(claim.dimension)
    ) {
      const offendingFactIds = claim.factIds.filter((factId) => {
        const fact = factsArtifact.facts.find((candidate) => candidate.id === factId);
        return fact !== undefined && fact.dimension !== claim.dimension;
      });

      throw new Error(
        `Claim ${claim.id} cites facts outside its dimension: ${offendingFactIds.join(", ")}.`
      );
    }
  }
}

function toClaimKind(kind: string): ClaimKind {
  if (kind === "comparative") {
    return "COMPARATIVE";
  }

  if (kind === "recommendation") {
    return "RECOMMENDATION";
  }

  return "SINGLE_COMPETITOR";
}

function toFindingSeverity(severity: string): FindingSeverity {
  if (severity === "low") {
    return "LOW";
  }

  if (severity === "medium") {
    return "MEDIUM";
  }

  return "HIGH";
}

function toFindingCategory(category: string): FindingCategory {
  const mapping: Record<string, FindingCategory> = {
    unsupported_claim: "UNSUPPORTED_CLAIM",
    unknown_fact: "UNKNOWN_FACT",
    untraced_fact: "UNTRACED_FACT",
    low_confidence: "LOW_CONFIDENCE",
    uncited_report_section: "UNCITED_REPORT_SECTION",
    unknown_claim: "UNKNOWN_CLAIM",
    missing_dimension: "MISSING_DIMENSION"
  };

  return mapping[category] ?? "UNSUPPORTED_CLAIM";
}

function toDbNodeStatus(status: Workflow["nodes"][number]["status"]): WorkflowNodeStatus {
  const mapping: Record<Workflow["nodes"][number]["status"], WorkflowNodeStatus> = {
    pending: "PENDING",
    ready: "READY",
    running: "RUNNING",
    succeeded: "SUCCEEDED",
    failed: "FAILED",
    skipped: "SKIPPED",
    blocked: "BLOCKED"
  };

  return mapping[status];
}

function toDbAgentRunStatus(status: WorkflowAgentRunRecord["run"]["status"]): AgentRunStatus {
  const mapping: Record<WorkflowAgentRunRecord["run"]["status"], AgentRunStatus> = {
    running: "RUNNING",
    succeeded: "SUCCEEDED",
    failed: "FAILED"
  };

  return mapping[status];
}

function toDbToolCallStatus(status: WorkflowAgentRunRecord["toolCalls"][number]["status"]): ToolCallStatus {
  const mapping: Record<WorkflowAgentRunRecord["toolCalls"][number]["status"], ToolCallStatus> = {
    succeeded: "SUCCEEDED",
    failed: "FAILED"
  };

  return mapping[status];
}

function toDbModelCallStatus(status: WorkflowAgentRunRecord["modelCalls"][number]["status"]): ModelCallStatus {
  return status === "succeeded" ? "SUCCEEDED" : "FAILED";
}
