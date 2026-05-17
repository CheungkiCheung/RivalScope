import type {
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
  ReportBlockStatus,
  ReportStatus,
  SourceKind,
  TraceValidationStatus,
  TraceEdgeKind,
  WorkflowNodeStatus,
  AgentRunStatus,
  ToolCallStatus
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
    createSourceSnapshot?(input: {
      projectId: string;
      sourceId: string;
      sourceKind: SourceKind;
      title: string;
      canonicalUrl: string;
      retrievedAt: Date;
      contentHash: string;
      rawText: string;
      metadata: Prisma.InputJsonValue;
    }): Promise<{ id: string }>;
    createEvidenceSpan?(input: {
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
    }): Promise<{ id: string }>;
    createFact(input: {
      projectId: string;
      competitorId: string;
      dimension: string;
      statement: string;
      confidence: number;
      chunkIds: string[];
    }): Promise<{ id: string }>;
    createAtomicFact?(input: {
      projectId: string;
      competitorId: string;
      dimension: string;
      statement: string;
      confidence: number;
      polarity: AtomicFactPolarity;
      extractedAt: Date;
      evidenceSpanIds: string[];
    }): Promise<{ id: string }>;
    createKnowledgeItem?(input: {
      projectId: string;
      competitorId: string;
      dimension: string;
      label: string;
      summary: string;
      confidence: number;
      atomicFactIds: string[];
    }): Promise<{ id: string }>;
    createClaim(input: {
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
        evidenceSpanIds?: string[];
        status?: ReportBlockStatus;
      }>;
    }): Promise<{
      id: string;
      blocks?: Array<{ id: string; blockKey: string }>;
    }>;
    createReviewFindings(inputs: Array<{
      projectId: string;
      reportId?: string;
      severity: FindingSeverity;
      category: FindingCategory;
      message: string;
      targetType?: FindingTargetType;
      targetId?: string;
      agentName?: string;
    }>): Promise<unknown>;
    createTraceValidationResult?(input: {
      projectId: string;
      status: TraceValidationStatus;
      checkedClaimIds: string[];
      checkedEvidenceSpanIds: string[];
      reportBlockIds: string[];
      findings: Prisma.InputJsonValue;
      validatedAt: Date;
    }): Promise<{ id: string }>;
    createTraceEdges?(inputs: Array<{
      projectId: string;
      fromType: string;
      fromId: string;
      toType: string;
      toId: string;
      kind: TraceEdgeKind;
      metadata?: Prisma.InputJsonValue;
    }>): Promise<unknown>;
    createModelRuns?(inputs: Array<{
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
  report: { id: string };
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

  const intelligence = await persistIntelligence(
    input.projectId,
    input.competitors,
    input.artifacts,
    input.repositories.intelligence
  );

  return {
    workflow: updatedWorkflow,
    artifacts: persistedArtifacts,
    report: intelligence.report
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
  if (hasArtifact(artifacts, "source_snapshots")) {
    return persistSnapshotIntelligence(projectId, competitors, artifacts, repository);
  }

  return persistLegacyIntelligence(projectId, competitors, artifacts, repository);
}

async function persistLegacyIntelligence(
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
    }>;
  }>(artifacts, "review_findings");

  const competitorByKey = new Map(
    competitors.map((competitor) => [competitor.name.toLowerCase(), competitor.id])
  );
  const persistedFactIds = new Map<string, string>();

  for (const fact of factsArtifact.facts) {
    const competitorId =
      competitorByKey.get(fact.competitorId.toLowerCase()) ?? competitors[0]?.id;

    if (!competitorId) {
      continue;
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
      message: finding.message
    }))
  );

  return { report };
}

async function persistSnapshotIntelligence(
  projectId: string,
  competitors: Array<{ id: string; name: string }>,
  artifacts: Artifact[],
  repository: PersistAnalysisRepositories["intelligence"]
) {
  assertRepositoryMethod(repository.createSourceSnapshot, "createSourceSnapshot");
  assertRepositoryMethod(repository.createEvidenceSpan, "createEvidenceSpan");
  assertRepositoryMethod(repository.createAtomicFact, "createAtomicFact");
  assertRepositoryMethod(repository.createKnowledgeItem, "createKnowledgeItem");
  assertRepositoryMethod(
    repository.createTraceValidationResult,
    "createTraceValidationResult"
  );
  assertRepositoryMethod(repository.createTraceEdges, "createTraceEdges");
  assertRepositoryMethod(repository.createModelRuns, "createModelRuns");

  const snapshotsArtifact = findArtifact<{
    snapshots: Array<{
      id: string;
      projectId: string;
      sourceId: string;
      sourceKind: string;
      title: string;
      canonicalUrl: string;
      retrievedAt: string;
      contentHash: string;
      rawText: string;
      metadata: unknown;
    }>;
  }>(artifacts, "source_snapshots");
  const evidenceSpansArtifact = findArtifact<{
    evidenceSpans: Array<{
      id: string;
      projectId: string;
      snapshotId: string;
      sourceId: string;
      text: string;
      startOffset: number;
      endOffset: number;
      quoteHash: string;
      spanType: string;
      qualityScore: number;
      capturedAt: string;
    }>;
  }>(artifacts, "evidence_spans");
  const atomicFactsArtifact = findArtifact<{
    atomicFacts: Array<{
      id: string;
      projectId: string;
      competitorId: string;
      dimension: string;
      statement: string;
      evidenceSpanIds: string[];
      confidence: number;
      polarity: string;
      extractedAt: string;
    }>;
  }>(artifacts, "atomic_facts");
  const knowledgeArtifact = findOptionalArtifact<{
    knowledgeItems: Array<{
      id: string;
      projectId: string;
      competitorId: string;
      dimension: string;
      label: string;
      summary: string;
      atomicFactIds: string[];
      confidence: number;
    }>;
  }>(artifacts, "knowledge_items") ?? { knowledgeItems: [] };
  const claimsArtifact = findArtifact<{
    claims: Array<{
      id: string;
      dimension: string;
      statement: string;
      factIds: string[];
      evidenceSpanIds?: string[];
      confidence: number;
      confidenceBreakdown?: unknown;
      sourceQuality?: number;
      freshness?: number;
      counterEvidenceCount?: number;
      kind: string;
      type?: string;
      status?: string;
      verdict?: string;
    }>;
  }>(artifacts, "claims");
  const reportArtifact = findArtifact<{
    title: string;
    reportBlocks: Array<{
      id: string;
      title: string;
      body: string;
      ordinal: number;
      claimIds: string[];
      evidenceSpanIds: string[];
      status?: string;
    }>;
  }>(artifacts, "report_blocks");
  const findingsArtifact = findArtifact<{
    qualityScore: number;
    findings: Array<{
      severity: string;
      category: string;
      message: string;
      targetType?: string;
      targetId?: string;
      agentName?: string;
    }>;
  }>(artifacts, "review_findings");
  const traceArtifact = findArtifact<{
    status: string;
    checkedClaimIds: string[];
    checkedEvidenceSpanIds: string[];
    findings: unknown[];
    reportBlockIds?: string[];
    validatedAt?: string;
  }>(artifacts, "trace_validation");
  const modelRunsArtifact = findOptionalArtifact<{
    modelRuns: Array<{
      provider: string;
      model: string;
      promptHash: string;
      input?: unknown;
      inputClaimIds?: string[];
      output?: unknown;
      status: string;
      tokenUsage?: unknown;
      costUsd?: number;
      startedAt?: string;
      finishedAt?: string;
    }>;
  }>(artifacts, "model_runs") ?? { modelRuns: [] };

  const competitorByKey = new Map(
    competitors.map((competitor) => [competitor.name.toLowerCase(), competitor.id])
  );
  const snapshotIds = new Map<string, string>();
  const evidenceSpanIds = new Map<string, string>();
  const atomicFactIds = new Map<string, string>();
  const claimIds = new Map<string, string>();
  const reportBlockIds = new Map<string, string>();
  const traceEdges: Array<{
    projectId: string;
    fromType: string;
    fromId: string;
    toType: string;
    toId: string;
    kind: TraceEdgeKind;
    metadata?: Prisma.InputJsonValue;
  }> = [];

  for (const snapshot of snapshotsArtifact.snapshots) {
    const persistedSnapshot = await repository.createSourceSnapshot({
      projectId,
      sourceId: snapshot.sourceId,
      sourceKind: toSourceKind(snapshot.sourceKind),
      title: snapshot.title,
      canonicalUrl: snapshot.canonicalUrl,
      retrievedAt: new Date(snapshot.retrievedAt),
      contentHash: snapshot.contentHash,
      rawText: snapshot.rawText,
      metadata: snapshot.metadata as Prisma.InputJsonValue
    });
    snapshotIds.set(snapshot.id, persistedSnapshot.id);
  }

  for (const span of evidenceSpansArtifact.evidenceSpans) {
    const snapshotId = getRequiredMapping(
      snapshotIds,
      span.snapshotId,
      `Missing source snapshot mapping ${span.snapshotId} for evidence span ${span.id}`
    );

    const persistedSpan = await repository.createEvidenceSpan({
      projectId,
      snapshotId,
      sourceId: span.sourceId,
      text: span.text,
      startOffset: span.startOffset,
      endOffset: span.endOffset,
      quoteHash: span.quoteHash,
      spanType: toEvidenceSpanType(span.spanType),
      qualityScore: span.qualityScore,
      capturedAt: new Date(span.capturedAt)
    });
    evidenceSpanIds.set(span.id, persistedSpan.id);
    traceEdges.push({
      projectId,
      fromType: "source_snapshot",
      fromId: snapshotId,
      toType: "evidence_span",
      toId: persistedSpan.id,
      kind: "SOURCE_SNAPSHOT_TO_EVIDENCE_SPAN"
    });
  }

  for (const atomicFact of atomicFactsArtifact.atomicFacts) {
    const competitorId =
      competitorByKey.get(atomicFact.competitorId.toLowerCase()) ?? competitors[0]?.id;

    if (!competitorId) {
      throw new Error(`Missing competitor mapping for atomic fact ${atomicFact.id}`);
    }

    const persistedEvidenceSpanIds = atomicFact.evidenceSpanIds.map((spanId) =>
      getRequiredMapping(
        evidenceSpanIds,
        spanId,
        `Missing evidence span mapping ${spanId} for atomic fact ${atomicFact.id}`
      )
    );

    const persistedAtomicFact = await repository.createAtomicFact({
      projectId,
      competitorId,
      dimension: atomicFact.dimension,
      statement: atomicFact.statement,
      confidence: atomicFact.confidence,
      polarity: toAtomicFactPolarity(atomicFact.polarity),
      extractedAt: new Date(atomicFact.extractedAt),
      evidenceSpanIds: persistedEvidenceSpanIds
    });
    atomicFactIds.set(atomicFact.id, persistedAtomicFact.id);
    for (const evidenceSpanId of persistedEvidenceSpanIds) {
      traceEdges.push({
        projectId,
        fromType: "evidence_span",
        fromId: evidenceSpanId,
        toType: "atomic_fact",
        toId: persistedAtomicFact.id,
        kind: "EVIDENCE_SPAN_TO_ATOMIC_FACT"
      });
    }
  }

  for (const knowledgeItem of knowledgeArtifact.knowledgeItems) {
    const competitorId =
      competitorByKey.get(knowledgeItem.competitorId.toLowerCase()) ??
      competitors[0]?.id;

    if (!competitorId) {
      throw new Error(`Missing competitor mapping for knowledge item ${knowledgeItem.id}`);
    }

    const persistedAtomicFactIds = knowledgeItem.atomicFactIds.map((factId) =>
      getRequiredMapping(
        atomicFactIds,
        factId,
        `Missing atomic fact mapping ${factId} for knowledge item ${knowledgeItem.id}`
      )
    );

    await repository.createKnowledgeItem({
      projectId,
      competitorId,
      dimension: knowledgeItem.dimension,
      label: knowledgeItem.label,
      summary: knowledgeItem.summary,
      confidence: knowledgeItem.confidence,
      atomicFactIds: persistedAtomicFactIds
    });
  }

  for (const claim of claimsArtifact.claims) {
    if (claim.factIds.length === 0) {
      throw new Error(`Claim ${claim.id} must cite at least one atomic fact`);
    }

    if ((claim.evidenceSpanIds ?? []).length === 0) {
      throw new Error(`Claim ${claim.id} must cite at least one evidence span`);
    }

    const persistedAtomicFactIds = claim.factIds.map((factId) =>
      getRequiredMapping(
        atomicFactIds,
        factId,
        `Missing atomic fact mapping ${factId} for claim ${claim.id}`
      )
    );
    const persistedEvidenceSpanIds = (claim.evidenceSpanIds ?? []).map((spanId) =>
      getRequiredMapping(
        evidenceSpanIds,
        spanId,
        `Missing evidence span mapping ${spanId} for claim ${claim.id}`
      )
    );

    const persistedClaim = await repository.createClaim({
      projectId,
      dimension: claim.dimension,
      statement: claim.statement,
      confidence: claim.confidence,
      kind: toClaimKind(claim.kind),
      factIds: persistedAtomicFactIds,
      atomicFactIds: persistedAtomicFactIds,
      evidenceSpanIds: persistedEvidenceSpanIds,
      ...(claim.confidenceBreakdown !== undefined
        ? { confidenceBreakdown: claim.confidenceBreakdown as Prisma.InputJsonValue }
        : {}),
      ...(claim.sourceQuality !== undefined
        ? { sourceQuality: claim.sourceQuality }
        : {}),
      ...(claim.freshness !== undefined ? { freshness: claim.freshness } : {}),
      ...(claim.counterEvidenceCount !== undefined
        ? { counterEvidenceCount: claim.counterEvidenceCount }
        : {}),
      ...(claim.type ? { type: toClaimType(claim.type) } : {}),
      ...(claim.status ? { status: toClaimStatus(claim.status) } : {}),
      ...(claim.verdict ? { verdict: toClaimVerdict(claim.verdict) } : {})
    });
    claimIds.set(claim.id, persistedClaim.id);
    for (const atomicFactId of persistedAtomicFactIds) {
      traceEdges.push({
        projectId,
        fromType: "atomic_fact",
        fromId: atomicFactId,
        toType: "claim",
        toId: persistedClaim.id,
        kind: "ATOMIC_FACT_TO_CLAIM"
      });
    }
    for (const factId of claim.factIds) {
      const atomicFact = atomicFactsArtifact.atomicFacts.find(
        (candidate) => candidate.id === factId
      );

      if (!atomicFact) {
        continue;
      }

      const semanticEdgeKind = getClaimSemanticTraceEdgeKind(
        atomicFact,
        claim,
        evidenceSpansArtifact.evidenceSpans
      );

      if (semanticEdgeKind) {
        traceEdges.push({
          projectId,
          fromType: "atomic_fact",
          fromId: getRequiredMapping(
            atomicFactIds,
            atomicFact.id,
            `Missing atomic fact mapping ${atomicFact.id} for claim ${claim.id}`
          ),
          toType: "claim",
          toId: persistedClaim.id,
          kind: semanticEdgeKind
        });
      }
    }
  }

  const report = await repository.createReport({
    projectId,
    title: reportArtifact.title,
    qualityScore: findingsArtifact.qualityScore,
    status: findingsArtifact.findings.length === 0 ? "FINAL" : "REVIEWED",
    sections: reportArtifact.reportBlocks.map((block) => ({
      sectionKey: block.id,
      title: block.title,
      body: block.body,
      ordinal: block.ordinal,
      claimIds: block.claimIds.map((claimId) =>
        getRequiredMapping(
          claimIds,
          claimId,
          `Missing claim mapping ${claimId} for report block ${block.id}`
        )
      ),
      evidenceSpanIds: block.evidenceSpanIds.map((spanId) =>
        getRequiredMapping(
          evidenceSpanIds,
          spanId,
          `Missing evidence span mapping ${spanId} for report block ${block.id}`
        )
      ),
      ...(block.status ? { status: toReportBlockStatus(block.status) } : {})
    }))
  });
  const reportBlocks = getReportBlocks(report);
  for (const block of reportArtifact.reportBlocks) {
    const reportBlockId = getRequiredMapping(
      new Map(reportBlocks.map((candidate) => [candidate.blockKey, candidate.id])),
      block.id,
      `Missing report block mapping ${block.id}`
    );
    reportBlockIds.set(block.id, reportBlockId);

    for (const claimId of block.claimIds) {
      traceEdges.push({
        projectId,
        fromType: "claim",
        fromId: getRequiredMapping(
          claimIds,
          claimId,
          `Missing claim mapping ${claimId} for report block ${block.id}`
        ),
        toType: "report_block",
        toId: reportBlockId,
        kind: "CLAIM_TO_REPORT_BLOCK"
      });
    }
  }

  await repository.createReviewFindings(
    findingsArtifact.findings.map((finding) => ({
      projectId,
      reportId: report.id,
      severity: toFindingSeverity(finding.severity),
      category: toFindingCategory(finding.category),
      message: finding.message,
      ...(finding.targetType ? { targetType: toFindingTargetType(finding.targetType) } : {}),
      ...(finding.targetId
        ? { targetId: remapFindingTargetId(finding.targetType, finding.targetId, claimIds, evidenceSpanIds) }
        : {}),
      ...(finding.agentName ? { agentName: finding.agentName } : {})
    }))
  );

  await repository.createModelRuns(
    modelRunsArtifact.modelRuns.map((modelRun) => ({
      projectId,
      provider: modelRun.provider,
      model: modelRun.model,
      promptHash: modelRun.promptHash,
      input: getModelRunInput(modelRun) as Prisma.InputJsonValue,
      ...(modelRun.output !== undefined
        ? { output: modelRun.output as Prisma.InputJsonValue }
        : {}),
      status: toDbAgentRunStatus(modelRun.status as WorkflowAgentRunRecord["run"]["status"]),
      ...(modelRun.tokenUsage !== undefined
        ? { tokenUsage: modelRun.tokenUsage as Prisma.InputJsonValue }
        : {}),
      ...(modelRun.costUsd !== undefined ? { costUsd: modelRun.costUsd } : {}),
      startedAt: modelRun.startedAt ? new Date(modelRun.startedAt) : new Date(),
      ...(modelRun.finishedAt ? { finishedAt: new Date(modelRun.finishedAt) } : {})
    }))
  );

  const remappedTraceReportBlockIds = (traceArtifact.reportBlockIds ?? []).map((blockId) =>
    getRequiredMapping(
      reportBlockIds,
      blockId,
      `Missing report block mapping ${blockId}`
    )
  );
  const traceValidation = await repository.createTraceValidationResult({
    projectId,
    status: toTraceValidationStatus(traceArtifact.status),
    checkedClaimIds: traceArtifact.checkedClaimIds.map((claimId) =>
      getRequiredMapping(
        claimIds,
        claimId,
        `Missing claim mapping ${claimId} for trace validation`
      )
    ),
    checkedEvidenceSpanIds: traceArtifact.checkedEvidenceSpanIds.map((spanId) =>
      getRequiredMapping(
        evidenceSpanIds,
        spanId,
        `Missing evidence span mapping ${spanId} for trace validation`
      )
    ),
    reportBlockIds: remappedTraceReportBlockIds,
    findings: traceArtifact.findings as Prisma.InputJsonValue,
    validatedAt: traceArtifact.validatedAt
      ? new Date(traceArtifact.validatedAt)
      : new Date()
  });

  for (const reportBlockId of remappedTraceReportBlockIds) {
    traceEdges.push({
      projectId,
      fromType: "report_block",
      fromId: reportBlockId,
      toType: "trace_validation_result",
      toId: traceValidation.id,
      kind: "TRACE_VALIDATED_BY"
    });
  }
  await repository.createTraceEdges(traceEdges);

  return { report };
}

function findArtifact<T>(artifacts: Artifact[], kind: string): T {
  const artifact = [...artifacts].reverse().find((candidate) => candidate.kind === kind);

  if (!artifact) {
    throw new Error(`Missing artifact ${kind}`);
  }

  return artifact.value as T;
}

function findOptionalArtifact<T>(artifacts: Artifact[], kind: string): T | undefined {
  const artifact = [...artifacts].reverse().find((candidate) => candidate.kind === kind);
  return artifact?.value as T | undefined;
}

function hasArtifact(artifacts: Artifact[], kind: string): boolean {
  return artifacts.some((artifact) => artifact.kind === kind);
}

function getRequiredMapping(
  mappings: Map<string, string>,
  id: string,
  message: string
): string {
  const value = mappings.get(id);

  if (!value) {
    throw new Error(message);
  }

  return value;
}

function getReportBlocks(report: { blocks?: Array<{ id: string; blockKey: string }> }) {
  return report.blocks ?? [];
}

function assertRepositoryMethod<T>(
  method: T | undefined,
  methodName: string
): asserts method is T {
  if (!method) {
    throw new Error(`Repository is missing ${methodName}`);
  }
}

function toSourceKind(kind: string): SourceKind {
  const normalized = kind.toLowerCase();

  if (normalized === "markdown") {
    return "MARKDOWN";
  }

  if (normalized === "pdf") {
    return "PDF";
  }

  if (normalized === "text") {
    return "TEXT";
  }

  return "URL";
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

function toClaimType(type: string): ClaimType {
  const mapping: Record<string, ClaimType> = {
    capability: "CAPABILITY",
    pricing: "PRICING",
    positioning: "POSITIONING",
    risk: "RISK",
    recommendation: "RECOMMENDATION"
  };

  return mapping[type] ?? "CAPABILITY";
}

function toClaimStatus(status: string): ClaimStatus {
  const mapping: Record<string, ClaimStatus> = {
    draft: "DRAFT",
    needs_evidence: "NEEDS_EVIDENCE",
    needs_review: "NEEDS_REVIEW",
    approved: "APPROVED",
    rejected: "REJECTED"
  };

  return mapping[status] ?? "DRAFT";
}

function toClaimVerdict(verdict: string): ClaimVerdict {
  const mapping: Record<string, ClaimVerdict> = {
    supported: "SUPPORTED",
    needs_more_evidence: "NEEDS_MORE_EVIDENCE",
    refuted: "REFUTED",
    hypothesis: "HYPOTHESIS"
  };

  return mapping[verdict] ?? "HYPOTHESIS";
}

function toEvidenceSpanType(spanType: string): EvidenceSpanType {
  const mapping: Record<string, EvidenceSpanType> = {
    supporting: "SUPPORTING",
    counter: "COUNTER",
    context: "CONTEXT"
  };

  return mapping[spanType] ?? "SUPPORTING";
}

function toAtomicFactPolarity(polarity: string): AtomicFactPolarity {
  const mapping: Record<string, AtomicFactPolarity> = {
    supports: "SUPPORTS",
    contradicts: "CONTRADICTS",
    context: "CONTEXT"
  };

  return mapping[polarity] ?? "SUPPORTS";
}

function getClaimSemanticTraceEdgeKind(
  atomicFact: {
    polarity: string;
    evidenceSpanIds: string[];
  },
  claim: {
    status?: string;
    verdict?: string;
  },
  evidenceSpans: Array<{ id: string; spanType: string }>
): TraceEdgeKind | undefined {
  const citedSpanTypes = new Set(
    atomicFact.evidenceSpanIds
      .map((spanId) => evidenceSpans.find((span) => span.id === spanId)?.spanType)
      .filter((spanType): spanType is string => Boolean(spanType))
  );

  if (atomicFact.polarity === "contradicts" || citedSpanTypes.has("counter")) {
    return claim.verdict === "refuted" || claim.status === "rejected"
      ? "REFUTES"
      : "QUALIFIES";
  }

  if (atomicFact.polarity === "context" || citedSpanTypes.has("context")) {
    return "QUALIFIES";
  }

  if (atomicFact.polarity === "supports" && citedSpanTypes.has("supporting")) {
    return "SUPPORTS";
  }

  return undefined;
}

function getModelRunInput(modelRun: {
  input?: unknown;
  inputClaimIds?: string[];
}): unknown {
  if (modelRun.input !== undefined) {
    return modelRun.input;
  }

  if (modelRun.inputClaimIds !== undefined) {
    return { claimIds: modelRun.inputClaimIds };
  }

  return {};
}

function toReportBlockStatus(status: string): ReportBlockStatus {
  const mapping: Record<string, ReportBlockStatus> = {
    draft: "DRAFT",
    ready: "READY",
    blocked: "BLOCKED"
  };

  return mapping[status] ?? "DRAFT";
}

function toFindingSeverity(severity: string): FindingSeverity {
  if (severity === "critical") {
    return "CRITICAL";
  }

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
    unknown_evidence_span: "UNKNOWN_EVIDENCE_SPAN",
    low_confidence: "LOW_CONFIDENCE",
    uncited_report_section: "UNCITED_REPORT_SECTION",
    unknown_claim: "UNKNOWN_CLAIM",
    missing_dimension: "MISSING_DIMENSION",
    trace_gap: "TRACE_GAP",
    counter_evidence: "COUNTER_EVIDENCE",
    role_violation: "ROLE_VIOLATION"
  };

  return mapping[category] ?? "UNSUPPORTED_CLAIM";
}

function toFindingTargetType(targetType: string): FindingTargetType {
  const mapping: Record<string, FindingTargetType> = {
    claim: "CLAIM",
    evidence_span: "EVIDENCE_SPAN",
    report_block: "REPORT_BLOCK",
    agent_run: "AGENT_RUN"
  };

  return mapping[targetType] ?? "CLAIM";
}

function toTraceValidationStatus(status: string): TraceValidationStatus {
  const mapping: Record<string, TraceValidationStatus> = {
    passed: "PASSED",
    failed: "FAILED",
    needs_review: "NEEDS_REVIEW"
  };

  return mapping[status] ?? "FAILED";
}

function remapFindingTargetId(
  targetType: string | undefined,
  targetId: string,
  claimIds: Map<string, string>,
  evidenceSpanIds: Map<string, string>
): string {
  if (targetType === "claim") {
    return claimIds.get(targetId) ?? targetId;
  }

  if (targetType === "evidence_span") {
    return evidenceSpanIds.get(targetId) ?? targetId;
  }

  return targetId;
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
