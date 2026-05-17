import { describe, expect, it, vi } from "vitest";
import { createWorkflow, type Workflow } from "@rivalscope/core";
import {
  ArtifactRepository,
  IntelligenceRepository,
  ProjectRepository,
  WorkflowRepository
} from "@rivalscope/db";
import {
  createDemoAnalysisWorkflowAgents,
  createDemoAnalysisWorkflowNodes,
  InMemoryArtifactStore,
  runWorkflow,
  type Artifact
} from "@rivalscope/agents";
import { PrismaClient } from "@prisma/client";
import { persistAnalysisExecution } from "./analysis-persistence";

function createArtifact<T>(
  id: string,
  kind: Artifact["kind"],
  value: T,
  createdAt: string
): Artifact<T> {
  return { id, kind, value, createdAt };
}

describe("persistAnalysisExecution", () => {
  it("persists agent runs, tool calls, and remaps temporary artifact ids to database ids", async () => {
    const workflow: Workflow = {
      id: "workflow_project_1",
      projectId: "project_1",
      nodes: [
        {
          id: "extract",
          type: "agent",
          agentName: "extract",
          dependsOn: [],
          status: "succeeded",
          inputArtifactIds: ["artifact_temp_source", "artifact_temp_requirements"],
          outputArtifactIds: ["artifact_temp_facts"],
          retryCount: 0,
          maxRetries: 1,
          currentAgentRunId: "agent_run_temp_extract",
          startedAt: "2026-05-11T00:00:00.000Z",
          finishedAt: "2026-05-11T00:00:02.000Z"
        },
        {
          id: "analyze",
          type: "agent",
          agentName: "analyze",
          dependsOn: ["extract"],
          status: "succeeded",
          inputArtifactIds: [],
          outputArtifactIds: ["artifact_temp_claims"],
          retryCount: 0,
          maxRetries: 1,
          currentAgentRunId: "agent_run_temp_analyze",
          startedAt: "2026-05-11T00:00:03.000Z",
          finishedAt: "2026-05-11T00:00:04.000Z"
        },
        {
          id: "write",
          type: "agent",
          agentName: "write",
          dependsOn: ["analyze"],
          status: "succeeded",
          inputArtifactIds: [],
          outputArtifactIds: ["artifact_temp_report"],
          retryCount: 0,
          maxRetries: 1,
          currentAgentRunId: "agent_run_temp_write",
          startedAt: "2026-05-11T00:00:05.000Z",
          finishedAt: "2026-05-11T00:00:06.000Z"
        },
        {
          id: "critique",
          type: "agent",
          agentName: "critique",
          dependsOn: ["write"],
          status: "succeeded",
          inputArtifactIds: [],
          outputArtifactIds: ["artifact_temp_findings"],
          retryCount: 0,
          maxRetries: 1,
          currentAgentRunId: "agent_run_temp_critique",
          startedAt: "2026-05-11T00:00:07.000Z",
          finishedAt: "2026-05-11T00:00:08.000Z"
        }
      ]
    };

    const artifacts: Artifact[] = [
      createArtifact(
        "artifact_temp_source",
        "source_chunks",
        {
          projectId: "project_1",
          chunks: [
            {
              id: "chunk_1",
              sourceId: "source_1",
              ordinal: 0,
              text: "Cursor offers individual Pro and Team plans.",
              tokenCount: 7
            }
          ]
        },
        "2026-05-11T00:00:00.000Z"
      ),
      createArtifact(
        "artifact_temp_requirements",
        "analysis_requirements",
        {
          requiredDimensions: ["pricing", "positioning"],
          competitors: [{ name: "Cursor" }, { name: "Codex" }]
        },
        "2026-05-11T00:00:01.000Z"
      ),
      createArtifact(
        "artifact_temp_facts",
        "facts",
        {
          projectId: "project_1",
          facts: [
            {
              id: "fact_1",
              projectId: "project_1",
              competitorId: "Cursor",
              dimension: "pricing",
              statement: "Cursor offers individual Pro and Team plans.",
              sourceChunkIds: ["chunk_1"],
              confidence: 0.86
            }
          ]
        },
        "2026-05-11T00:00:02.000Z"
      ),
      createArtifact(
        "artifact_temp_claims",
        "claims",
        {
          projectId: "project_1",
          claims: [
            {
              id: "claim_1",
              projectId: "project_1",
              dimension: "pricing",
              statement: "Cursor offers individual Pro and Team plans.",
              factIds: ["fact_1"],
              confidence: 0.84,
              kind: "single_competitor"
            }
          ]
        },
        "2026-05-11T00:00:03.000Z"
      ),
      createArtifact(
        "artifact_temp_report",
        "report",
        {
          projectId: "project_1",
          title: "Competitive Intelligence Report",
          sections: [
            {
              id: "section_summary",
              title: "Executive Summary",
              body: "Cursor offers individual Pro and Team plans.",
              claimIds: ["claim_1"]
            }
          ]
        },
        "2026-05-11T00:00:04.000Z"
      ),
      createArtifact(
        "artifact_temp_findings",
        "review_findings",
        {
          projectId: "project_1",
          status: "approved",
          qualityScore: 100,
          findings: []
        },
        "2026-05-11T00:00:05.000Z"
      )
    ];

    const repository = {
      workflow: {
        createAgentRun: vi
          .fn()
          .mockImplementation(async (input: { agentName: string }) => ({
            id: `db_run_${input.agentName}`
          })),
        createToolCalls: vi.fn().mockResolvedValue({ count: 1 }),
        updateNodeStatuses: vi.fn().mockResolvedValue([])
      },
      artifact: {
        create: vi
          .fn()
          .mockImplementation(
            async (input: { kind: string; value: unknown }) => ({
              id: `db_artifact_${String(input.kind)}`,
              kind: input.kind,
              value: input.value
            })
          )
      },
      intelligence: {
        createFact: vi
          .fn()
          .mockImplementation(async (input: { competitorId: string }) => ({
            id: `db_fact_${input.competitorId}`
          })),
        createClaim: vi.fn().mockResolvedValue({ id: "db_claim_1" }),
        createReport: vi.fn().mockResolvedValue({ id: "db_report_1" }),
        createReviewFindings: vi.fn().mockResolvedValue({ count: 0 })
      }
    };

    const result = await persistAnalysisExecution({
      projectId: "project_1",
      competitors: [
        { id: "competitor_cursor", name: "Cursor" },
        { id: "competitor_codex", name: "Codex" }
      ],
      workflowRecord: {
        id: "workflow_db_1",
        nodes: [
          { id: "db_node_extract", nodeKey: "extract" },
          { id: "db_node_analyze", nodeKey: "analyze" },
          { id: "db_node_write", nodeKey: "write" },
          { id: "db_node_critique", nodeKey: "critique" }
        ]
      },
      workflow,
      agentRuns: [
        {
          nodeId: "extract",
          run: {
            id: "agent_run_temp_extract",
            agentName: "extract",
            status: "succeeded",
            input: {},
            output: {},
            startedAt: "2026-05-11T00:00:00.000Z",
            finishedAt: "2026-05-11T00:00:02.000Z"
          },
          toolCalls: [
            {
              id: "tool_call_temp_1",
              toolName: "fetch",
              status: "succeeded",
              input: { url: "https://example.com" },
              output: { status: 200 },
              startedAt: "2026-05-11T00:00:00.000Z",
              finishedAt: "2026-05-11T00:00:01.000Z"
            }
          ]
        },
        {
          nodeId: "analyze",
          run: {
            id: "agent_run_temp_analyze",
            agentName: "analyze",
            status: "succeeded",
            input: {},
            output: {},
            startedAt: "2026-05-11T00:00:03.000Z",
            finishedAt: "2026-05-11T00:00:04.000Z"
          },
          toolCalls: []
        },
        {
          nodeId: "write",
          run: {
            id: "agent_run_temp_write",
            agentName: "write",
            status: "succeeded",
            input: {},
            output: {},
            startedAt: "2026-05-11T00:00:05.000Z",
            finishedAt: "2026-05-11T00:00:06.000Z"
          },
          toolCalls: []
        },
        {
          nodeId: "critique",
          run: {
            id: "agent_run_temp_critique",
            agentName: "critique",
            status: "succeeded",
            input: {},
            output: {},
            startedAt: "2026-05-11T00:00:07.000Z",
            finishedAt: "2026-05-11T00:00:08.000Z"
          },
          toolCalls: []
        }
      ],
      artifacts,
      repositories: repository
    });

    expect(repository.workflow.createAgentRun).toHaveBeenCalledTimes(4);
    expect(repository.workflow.createToolCalls).toHaveBeenCalledWith("db_run_extract", [
      expect.objectContaining({
        toolName: "fetch",
        status: "SUCCEEDED"
      })
    ]);
    expect(repository.workflow.updateNodeStatuses).toHaveBeenCalledWith(
      "workflow_db_1",
      expect.arrayContaining([
        expect.objectContaining({
          nodeKey: "extract",
          currentAgentRunId: "db_run_extract",
          outputArtifactIds: ["db_artifact_facts"]
        }),
        expect.objectContaining({
          nodeKey: "critique",
          currentAgentRunId: "db_run_critique",
          outputArtifactIds: ["db_artifact_review_findings"]
        })
      ])
    );
    expect(repository.intelligence.createFact).toHaveBeenCalledWith(
      expect.objectContaining({
        competitorId: "competitor_cursor"
      })
    );
    expect(result.workflow.nodes.find((node) => node.id === "write")?.outputArtifactIds).toEqual([
      "db_artifact_report"
    ]);
  });

  it("persists snapshot evidence lineage, confidence breakdowns, findings, trace validation, and report blocks", async () => {
    const workflow: Workflow = {
      id: "workflow_project_1",
      projectId: "project_1",
      nodes: [
        {
          id: "trace_validator",
          type: "agent",
          agentName: "trace_validator",
          dependsOn: [],
          status: "succeeded",
          inputArtifactIds: [],
          outputArtifactIds: ["artifact_temp_trace_validation"],
          retryCount: 0,
          maxRetries: 1,
          currentAgentRunId: "agent_run_trace_validator"
        }
      ]
    };

    const artifacts: Artifact[] = [
      createArtifact(
        "artifact_temp_snapshots",
        "source_snapshots",
        {
          projectId: "project_1",
          snapshots: [
            {
              id: "snapshot_1",
              projectId: "project_1",
              sourceId: "source_cursor_pricing",
              sourceKind: "url",
              title: "Cursor pricing",
              canonicalUrl: "https://cursor.com/pricing",
              retrievedAt: "2026-05-11T00:00:00.000Z",
              contentHash: "sha256:cursor-pricing",
              rawText: "Cursor offers Pro and Team plans.",
              metadata: {
                sourceType: "pricing_page",
                publisher: "Cursor",
                qualityScore: 0.92
              }
            }
          ]
        },
        "2026-05-11T00:00:00.000Z"
      ),
      createArtifact(
        "artifact_temp_spans",
        "evidence_spans",
        {
          projectId: "project_1",
          evidenceSpans: [
            {
              id: "span_1",
              projectId: "project_1",
              snapshotId: "snapshot_1",
              sourceId: "source_cursor_pricing",
              text: "Cursor offers Pro and Team plans.",
              startOffset: 0,
              endOffset: 33,
              quoteHash: "sha256:span-1",
              spanType: "supporting",
              qualityScore: 0.92,
              capturedAt: "2026-05-11T00:01:00.000Z"
            }
          ]
        },
        "2026-05-11T00:00:01.000Z"
      ),
      createArtifact(
        "artifact_temp_atomic_facts",
        "atomic_facts",
        {
          projectId: "project_1",
          atomicFacts: [
            {
              id: "atomic_fact_1",
              projectId: "project_1",
              competitorId: "Cursor",
              dimension: "pricing",
              statement: "Cursor offers Pro and Team plans.",
              evidenceSpanIds: ["span_1"],
              confidence: 0.9,
              polarity: "supports",
              extractedAt: "2026-05-11T00:02:00.000Z"
            }
          ]
        },
        "2026-05-11T00:00:02.000Z"
      ),
      createArtifact(
        "artifact_temp_knowledge",
        "knowledge_items",
        {
          projectId: "project_1",
          knowledgeItems: [
            {
              id: "knowledge_1",
              projectId: "project_1",
              competitorId: "Cursor",
              dimension: "pricing",
              label: "Plan packaging",
              summary: "Cursor packages paid usage into Pro and Team plans.",
              atomicFactIds: ["atomic_fact_1"],
              confidence: 0.87
            }
          ]
        },
        "2026-05-11T00:00:03.000Z"
      ),
      createArtifact(
        "artifact_temp_claims",
        "claims",
        {
          projectId: "project_1",
          claims: [
            {
              id: "claim_1",
              projectId: "project_1",
              dimension: "pricing",
              statement: "Cursor has multiple paid plan types.",
              factIds: ["atomic_fact_1"],
              evidenceSpanIds: ["span_1"],
              confidence: 0.84,
              confidenceBreakdown: {
                evidenceStrength: 0.86,
                sourceQuality: 0.92,
                freshness: 0.9,
                corroboration: 0.74,
                counterEvidencePenalty: 0.05
              },
              sourceQuality: 0.92,
              freshness: 0.9,
              counterEvidenceCount: 0,
              kind: "single_competitor",
              type: "pricing",
              status: "approved",
              verdict: "supported"
            }
          ]
        },
        "2026-05-11T00:00:04.000Z"
      ),
      createArtifact(
        "artifact_temp_report",
        "report_blocks",
        {
          projectId: "project_1",
          title: "Competitive Intelligence Report",
          reportBlocks: [
            {
              id: "block_1",
              projectId: "project_1",
              title: "Pricing",
              body: "Cursor has multiple paid plan types.",
              ordinal: 0,
              claimIds: ["claim_1"],
              evidenceSpanIds: ["span_1"],
              status: "ready"
            }
          ]
        },
        "2026-05-11T00:00:05.000Z"
      ),
      createArtifact(
        "artifact_temp_findings",
        "review_findings",
        {
          projectId: "project_1",
          status: "approved",
          qualityScore: 96,
          findings: [
            {
              id: "finding_1",
              severity: "low",
              category: "trace_gap",
              message: "One claim would benefit from a second corroborating source.",
              targetType: "claim",
              targetId: "claim_1",
              agentName: "skeptic"
            }
          ]
        },
        "2026-05-11T00:00:06.000Z"
      ),
      createArtifact(
        "artifact_temp_trace_validation",
        "trace_validation",
        {
          projectId: "project_1",
          status: "passed",
          checkedClaimIds: ["claim_1"],
          checkedEvidenceSpanIds: ["span_1"],
          findings: [],
          reportBlockIds: ["block_1"],
          validatedAt: "2026-05-11T00:00:07.000Z"
        },
        "2026-05-11T00:00:07.000Z"
      ),
      createArtifact(
        "artifact_temp_model_runs",
        "model_runs",
        {
          projectId: "project_1",
          modelRuns: [
            {
              id: "model_run_1",
              provider: "fixture",
              model: "deterministic-confidence-v1",
              promptHash: "sha256:model-run",
              input: { claimIds: ["claim_1"] },
              output: { scoredClaimIds: ["claim_1"] },
              status: "succeeded",
              startedAt: "2026-05-11T00:00:06.000Z",
              finishedAt: "2026-05-11T00:00:07.000Z"
            }
          ]
        },
        "2026-05-11T00:00:08.000Z"
      )
    ];

    const repository = {
      workflow: {
        createAgentRun: vi.fn().mockResolvedValue({ id: "db_run_trace_validator" }),
        createToolCalls: vi.fn().mockResolvedValue({ count: 0 }),
        updateNodeStatuses: vi.fn().mockResolvedValue([])
      },
      artifact: {
        create: vi
          .fn()
          .mockImplementation(async (input: { kind: string }) => ({
            id: `db_artifact_${input.kind}`
          }))
      },
      intelligence: {
        createSourceSnapshot: vi.fn().mockResolvedValue({ id: "db_snapshot_1" }),
        createEvidenceSpan: vi.fn().mockResolvedValue({ id: "db_span_1" }),
        createFact: vi.fn().mockResolvedValue({ id: "db_legacy_fact_unused" }),
        createAtomicFact: vi.fn().mockResolvedValue({ id: "db_atomic_fact_1" }),
        createKnowledgeItem: vi.fn().mockResolvedValue({ id: "db_knowledge_1" }),
        createClaim: vi.fn().mockResolvedValue({ id: "db_claim_1" }),
        createReport: vi.fn().mockResolvedValue({
          id: "db_report_1",
          blocks: [{ id: "db_report_block_1", blockKey: "block_1" }]
        }),
        createReviewFindings: vi.fn().mockResolvedValue({ count: 1 }),
        createTraceValidationResult: vi.fn().mockResolvedValue({
          id: "db_trace_validation_1"
        }),
        createTraceEdges: vi.fn().mockResolvedValue({ count: 5 }),
        createModelRuns: vi.fn().mockResolvedValue({ count: 1 })
      }
    };

    await persistAnalysisExecution({
      projectId: "project_1",
      competitors: [{ id: "competitor_cursor", name: "Cursor" }],
      workflowRecord: {
        id: "workflow_db_1",
        nodes: [{ id: "db_node_trace_validator", nodeKey: "trace_validator" }]
      },
      workflow,
      agentRuns: [
        {
          nodeId: "trace_validator",
          run: {
            id: "agent_run_trace_validator",
            agentName: "trace_validator",
            status: "succeeded",
            input: {},
            output: {},
            startedAt: "2026-05-11T00:00:07.000Z",
            finishedAt: "2026-05-11T00:00:08.000Z"
          },
          toolCalls: []
        }
      ],
      artifacts,
      repositories: repository
    });

    expect(repository.intelligence.createSourceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project_1",
        sourceId: "source_cursor_pricing",
        contentHash: "sha256:cursor-pricing"
      })
    );
    expect(repository.intelligence.createEvidenceSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: "db_snapshot_1",
        spanType: "SUPPORTING"
      })
    );
    expect(repository.intelligence.createAtomicFact).toHaveBeenCalledWith(
      expect.objectContaining({
        competitorId: "competitor_cursor",
        evidenceSpanIds: ["db_span_1"]
      })
    );
    expect(repository.intelligence.createClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        factIds: ["db_atomic_fact_1"],
        evidenceSpanIds: ["db_span_1"],
        verdict: "SUPPORTED",
        status: "APPROVED",
        confidenceBreakdown: expect.objectContaining({
          sourceQuality: 0.92
        })
      })
    );
    expect(repository.intelligence.createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: [
          expect.objectContaining({
            sectionKey: "block_1",
            claimIds: ["db_claim_1"],
            evidenceSpanIds: ["db_span_1"]
          })
        ]
      })
    );
    expect(repository.intelligence.createReviewFindings).toHaveBeenCalledWith([
      expect.objectContaining({
        category: "TRACE_GAP",
        targetType: "CLAIM",
        targetId: "db_claim_1"
      })
    ]);
    expect(repository.intelligence.createTraceValidationResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PASSED",
        checkedClaimIds: ["db_claim_1"],
        checkedEvidenceSpanIds: ["db_span_1"],
        reportBlockIds: ["db_report_block_1"]
      })
    );
    expect(repository.intelligence.createTraceEdges).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          fromType: "source_snapshot",
          fromId: "db_snapshot_1",
          toType: "evidence_span",
          toId: "db_span_1",
          kind: "SOURCE_SNAPSHOT_TO_EVIDENCE_SPAN"
        }),
        expect.objectContaining({
          fromType: "evidence_span",
          fromId: "db_span_1",
          toType: "atomic_fact",
          toId: "db_atomic_fact_1",
          kind: "EVIDENCE_SPAN_TO_ATOMIC_FACT"
        }),
        expect.objectContaining({
          fromType: "atomic_fact",
          fromId: "db_atomic_fact_1",
          toType: "claim",
          toId: "db_claim_1",
          kind: "ATOMIC_FACT_TO_CLAIM"
        }),
        expect.objectContaining({
          fromType: "claim",
          fromId: "db_claim_1",
          toType: "report_block",
          toId: "db_report_block_1",
          kind: "CLAIM_TO_REPORT_BLOCK"
        }),
        expect.objectContaining({
          fromType: "report_block",
          fromId: "db_report_block_1",
          toType: "trace_validation_result",
          toId: "db_trace_validation_1",
          kind: "TRACE_VALIDATED_BY"
        })
      ])
    );
    expect(repository.intelligence.createModelRuns).toHaveBeenCalledWith([
      expect.objectContaining({
        projectId: "project_1",
        provider: "fixture",
        model: "deterministic-confidence-v1"
      })
    ]);
  });

  it("fails fast instead of saving a passed trace when a required evidence span mapping is missing", async () => {
    const { input, repository } = createSnapshotPersistenceCase({
      evidenceSpanIdsForAtomicFact: ["missing_span"]
    });

    await expect(persistAnalysisExecution(input)).rejects.toThrow(
      "Missing evidence span mapping missing_span for atomic fact atomic_fact_1"
    );
    expect(repository.intelligence.createTraceValidationResult).not.toHaveBeenCalled();
  });

  it("fails fast when a claim cites an atomic fact that was not persisted", async () => {
    const { input, repository } = createSnapshotPersistenceCase({
      factIdsForClaim: ["missing_atomic_fact"]
    });

    await expect(persistAnalysisExecution(input)).rejects.toThrow(
      "Missing atomic fact mapping missing_atomic_fact for claim claim_1"
    );
    expect(repository.intelligence.createTraceValidationResult).not.toHaveBeenCalled();
  });

  it("fails fast when a report block cites a missing claim", async () => {
    const { input, repository } = createSnapshotPersistenceCase({
      claimIdsForReportBlock: ["missing_claim"]
    });

    await expect(persistAnalysisExecution(input)).rejects.toThrow(
      "Missing claim mapping missing_claim for report block block_1"
    );
    expect(repository.intelligence.createTraceValidationResult).not.toHaveBeenCalled();
  });

  it("fails fast when createReport does not return the persisted report block mapping", async () => {
    const { input, repository } = createSnapshotPersistenceCase({
      reportBlocksFromCreateReport: []
    });

    await expect(persistAnalysisExecution(input)).rejects.toThrow(
      "Missing report block mapping block_1"
    );
    expect(repository.intelligence.createTraceValidationResult).not.toHaveBeenCalled();
  });

  it("fails fast when a snapshot claim does not cite evidence spans", async () => {
    const { input, repository } = createSnapshotPersistenceCase({
      evidenceSpanIdsForClaim: []
    });

    await expect(persistAnalysisExecution(input)).rejects.toThrow(
      "Claim claim_1 must cite at least one evidence span"
    );
    expect(repository.intelligence.createClaim).not.toHaveBeenCalled();
    expect(repository.intelligence.createTraceValidationResult).not.toHaveBeenCalled();
  });

  it("writes semantic supports, refutes, and qualifies edges from fact polarity and span type", async () => {
    const { input, repository } = createSnapshotPersistenceCase({
      evidenceSpans: [
        {
          id: "span_support",
          spanType: "supporting"
        },
        {
          id: "span_counter",
          spanType: "counter"
        },
        {
          id: "span_context",
          spanType: "context"
        }
      ],
      atomicFacts: [
        {
          id: "atomic_fact_support",
          evidenceSpanIds: ["span_support"],
          polarity: "supports"
        },
        {
          id: "atomic_fact_counter",
          evidenceSpanIds: ["span_counter"],
          polarity: "contradicts"
        },
        {
          id: "atomic_fact_context",
          evidenceSpanIds: ["span_context"],
          polarity: "context"
        }
      ],
      factIdsForClaim: [
        "atomic_fact_support",
        "atomic_fact_counter",
        "atomic_fact_context"
      ],
      evidenceSpanIdsForClaim: ["span_support", "span_counter", "span_context"],
      reportBlockEvidenceSpanIds: ["span_support", "span_counter", "span_context"],
      checkedEvidenceSpanIds: ["span_support", "span_counter", "span_context"],
      claimCounterEvidenceCount: 1,
      claimVerdict: "refuted",
      atomicFactPersistedIds: new Map([
        ["atomic_fact_support", "db_atomic_fact_support"],
        ["atomic_fact_counter", "db_atomic_fact_counter"],
        ["atomic_fact_context", "db_atomic_fact_context"]
      ]),
      evidenceSpanPersistedIds: new Map([
        ["span_support", "db_span_support"],
        ["span_counter", "db_span_counter"],
        ["span_context", "db_span_context"]
      ])
    });

    await persistAnalysisExecution(input);

    expect(repository.intelligence.createTraceEdges).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          fromType: "atomic_fact",
          fromId: "db_atomic_fact_support",
          toType: "claim",
          toId: "db_claim_1",
          kind: "SUPPORTS"
        }),
        expect.objectContaining({
          fromType: "atomic_fact",
          fromId: "db_atomic_fact_counter",
          toType: "claim",
          toId: "db_claim_1",
          kind: "REFUTES"
        }),
        expect.objectContaining({
          fromType: "atomic_fact",
          fromId: "db_atomic_fact_context",
          toType: "claim",
          toId: "db_claim_1",
          kind: "QUALIFIES"
        })
      ])
    );
    expect(repository.intelligence.createTraceEdges).not.toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: "db_atomic_fact_support",
          kind: "QUALIFIES"
        })
      ])
    );
  });

  it("persists snapshot evidence for non-project_1 projects without rewriting artifact project ids", async () => {
    const { input, repository } = createSnapshotPersistenceCase({
      projectId: "project_custom"
    });

    await persistAnalysisExecution(input);

    expect(repository.intelligence.createSourceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "project_custom" })
    );
    expect(repository.intelligence.createTraceValidationResult).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "project_custom" })
    );
    expect(JSON.stringify(input.artifacts)).not.toContain("project_1");
  });
});

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("persistAnalysisExecution Prisma readback contract", () => {
  it("persists the demo evidence graph and reads it back through ProjectRepository.get", async () => {
    const db = new PrismaClient();
    const projects = new ProjectRepository(db);
    const workflows = new WorkflowRepository(db);
    const artifactsRepository = new ArtifactRepository(db);
    const intelligence = new IntelligenceRepository(db);
    const ownerEmail = `module-ab-contract-${Date.now()}@example.com`;
    let projectId: string | undefined;

    try {
      const project = await projects.create({
        owner: {
          email: ownerEmail,
          name: "Module AB Contract"
        },
        name: "Module AB Contract Project",
        competitors: [
          { name: "Cursor", isPrimary: true },
          { name: "Codex" },
          { name: "Trae" }
        ],
        dimensions: [
          { key: "pricing", label: "Pricing" },
          { key: "positioning", label: "Positioning" },
          { key: "developer_experience", label: "Developer Experience" }
        ]
      });
      projectId = project.id;

      const artifacts = new InMemoryArtifactStore();
      const requirementsArtifact = artifacts.put({
        kind: "analysis_requirements",
        value: {
          projectId,
          requiredDimensions: ["pricing", "positioning", "developer_experience"],
          competitors: [{ name: "Cursor" }, { name: "Codex" }, { name: "Trae" }]
        }
      });
      const workflow = createWorkflow({
        id: `workflow_${projectId}`,
        projectId,
        nodes: createDemoAnalysisWorkflowNodes([requirementsArtifact.id])
      });
      const workflowRecord = await workflows.create({
        projectId,
        nodes: workflow.nodes.map((node) => ({
          nodeKey: node.id,
          type: "AGENT",
          agentName: node.agentName,
          dependsOn: node.dependsOn,
          status: "PENDING",
          inputArtifactIds: node.inputArtifactIds,
          outputArtifactIds: node.outputArtifactIds,
          retryCount: node.retryCount,
          maxRetries: node.maxRetries
        }))
      });
      const run = await runWorkflow({
        workflow,
        artifacts,
        agents: createDemoAnalysisWorkflowAgents()
      });

      await persistAnalysisExecution({
        projectId,
        competitors: project.competitors.map((competitor) => ({
          id: competitor.id,
          name: competitor.name
        })),
        workflowRecord,
        workflow: run.workflow,
        agentRuns: run.agentRuns,
        artifacts: artifacts.list(),
        repositories: {
          workflow: workflows,
          artifact: artifactsRepository,
          intelligence
        }
      });

      const readback = await projects.get(projectId);

      expect(readback?.sourceSnapshots.length).toBeGreaterThan(0);
      expect(
        readback?.sourceSnapshots.flatMap((snapshot) => snapshot.evidenceSpans).length
      ).toBeGreaterThan(0);
      expect(readback?.atomicFacts.length).toBeGreaterThan(0);
      expect(readback?.claims.length).toBeGreaterThan(0);
      expect(readback?.reports[0]?.blocks.length).toBeGreaterThan(0);
      expect(readback?.traceValidations.length).toBe(1);
      expect(readback?.traceEdges.map((edge) => edge.kind)).toEqual(
        expect.arrayContaining([
          "SOURCE_SNAPSHOT_TO_EVIDENCE_SPAN",
          "EVIDENCE_SPAN_TO_ATOMIC_FACT",
          "ATOMIC_FACT_TO_CLAIM",
          "CLAIM_TO_REPORT_BLOCK",
          "TRACE_VALIDATED_BY",
          "SUPPORTS",
          "REFUTES",
          "QUALIFIES"
        ])
      );
      expect(readback?.modelRuns).toContainEqual(
        expect.objectContaining({
          provider: "fixture",
          model: "deterministic-confidence-v1",
          input: expect.objectContaining({
            claimIds: expect.arrayContaining(["claim_cursor_paid_plans"])
          })
        })
      );
    } finally {
      if (projectId) {
        await db.project.delete({ where: { id: projectId } }).catch(() => undefined);
      }

      await db.user.delete({ where: { email: ownerEmail } }).catch(() => undefined);
      await db.$disconnect();
    }
  });
});

function createSnapshotPersistenceCase(options: {
  projectId?: string;
  evidenceSpanIdsForAtomicFact?: string[];
  factIdsForClaim?: string[];
  evidenceSpanIdsForClaim?: string[];
  claimIdsForReportBlock?: string[];
  reportBlocksFromCreateReport?: Array<{ id: string; blockKey: string }>;
  evidenceSpans?: Array<{ id: string; spanType: string }>;
  atomicFacts?: Array<{ id: string; evidenceSpanIds: string[]; polarity: string }>;
  evidenceSpanPersistedIds?: Map<string, string>;
  atomicFactPersistedIds?: Map<string, string>;
  spanType?: string;
  atomicFactPolarity?: string;
  claimCounterEvidenceCount?: number;
  claimVerdict?: string;
  reportBlockEvidenceSpanIds?: string[];
  checkedEvidenceSpanIds?: string[];
} = {}) {
  const projectId = options.projectId ?? "project_1";
  const workflow: Workflow = {
    id: `workflow_${projectId}`,
    projectId,
    nodes: [
      {
        id: "trace_validator",
        type: "agent",
        agentName: "trace_validator",
        dependsOn: [],
        status: "succeeded",
        inputArtifactIds: [],
        outputArtifactIds: ["artifact_temp_trace_validation"],
        retryCount: 0,
        maxRetries: 1,
        currentAgentRunId: "agent_run_trace_validator"
      }
    ]
  };
  const evidenceSpanFixtures = options.evidenceSpans ?? [
    {
      id: "span_1",
      spanType: options.spanType ?? "supporting"
    }
  ];
  const atomicFactFixtures = options.atomicFacts ?? [
    {
      id: "atomic_fact_1",
      evidenceSpanIds: options.evidenceSpanIdsForAtomicFact ?? ["span_1"],
      polarity: options.atomicFactPolarity ?? "supports"
    }
  ];
  const artifacts: Artifact[] = [
    createArtifact(
      "artifact_temp_snapshots",
      "source_snapshots",
      {
        projectId,
        snapshots: [
          {
            id: "snapshot_1",
            projectId,
            sourceId: "source_cursor_pricing",
            sourceKind: "url",
            title: "Cursor pricing",
            canonicalUrl: "https://cursor.com/pricing",
            retrievedAt: "2026-05-11T00:00:00.000Z",
            contentHash: `sha256:${projectId}:cursor-pricing`,
            rawText: "Cursor offers Pro and Team plans.",
            metadata: {
              sourceType: "pricing_page",
              publisher: "Cursor",
              qualityScore: 0.92
            }
          }
        ]
      },
      "2026-05-11T00:00:00.000Z"
    ),
    createArtifact(
      "artifact_temp_spans",
      "evidence_spans",
      {
        projectId,
        evidenceSpans: [
          ...evidenceSpanFixtures.map((span, index) => ({
            id: span.id,
            projectId,
            snapshotId: "snapshot_1",
            sourceId: "source_cursor_pricing",
            text: `Evidence span ${span.id}.`,
            startOffset: index * 40,
            endOffset: index * 40 + 30,
            quoteHash: `sha256:${span.id}`,
            spanType: span.spanType,
            qualityScore: 0.92,
            capturedAt: "2026-05-11T00:01:00.000Z"
          }))
        ]
      },
      "2026-05-11T00:00:01.000Z"
    ),
    createArtifact(
      "artifact_temp_atomic_facts",
      "atomic_facts",
      {
        projectId,
        atomicFacts: [
          ...atomicFactFixtures.map((fact) => ({
            id: fact.id,
            projectId,
            competitorId: "Cursor",
            dimension: "pricing",
            statement: `Atomic fact ${fact.id}.`,
            evidenceSpanIds: fact.evidenceSpanIds,
            confidence: 0.9,
            polarity: fact.polarity,
            extractedAt: "2026-05-11T00:02:00.000Z"
          }))
        ]
      },
      "2026-05-11T00:00:02.000Z"
    ),
    createArtifact(
      "artifact_temp_claims",
      "claims",
      {
        projectId,
        claims: [
          {
            id: "claim_1",
            projectId,
            dimension: "pricing",
            statement: "Cursor has multiple paid plan types.",
            factIds: options.factIdsForClaim ?? ["atomic_fact_1"],
            evidenceSpanIds: options.evidenceSpanIdsForClaim ?? ["span_1"],
            confidence: 0.84,
            confidenceBreakdown: {
              evidenceStrength: 0.86,
              sourceQuality: 0.92,
              freshness: 0.9,
              corroboration: 0.74,
              counterEvidencePenalty: 0.05
            },
            sourceQuality: 0.92,
            freshness: 0.9,
            counterEvidenceCount: options.claimCounterEvidenceCount ?? 0,
            kind: "single_competitor",
            type: "pricing",
            status: "approved",
            verdict: options.claimVerdict ?? "supported"
          }
        ]
      },
      "2026-05-11T00:00:04.000Z"
    ),
    createArtifact(
      "artifact_temp_report",
      "report_blocks",
      {
        projectId,
        title: "Competitive Intelligence Report",
        reportBlocks: [
          {
            id: "block_1",
            projectId,
            title: "Pricing",
            body: "Cursor has multiple paid plan types.",
            ordinal: 0,
            claimIds: options.claimIdsForReportBlock ?? ["claim_1"],
            evidenceSpanIds: options.reportBlockEvidenceSpanIds ?? ["span_1"],
            status: "ready"
          }
        ]
      },
      "2026-05-11T00:00:05.000Z"
    ),
    createArtifact(
      "artifact_temp_findings",
      "review_findings",
      {
        projectId,
        status: "approved",
        qualityScore: 96,
        findings: []
      },
      "2026-05-11T00:00:06.000Z"
    ),
    createArtifact(
      "artifact_temp_trace_validation",
      "trace_validation",
      {
        projectId,
        status: "passed",
        checkedClaimIds: ["claim_1"],
        checkedEvidenceSpanIds: options.checkedEvidenceSpanIds ?? ["span_1"],
        findings: [],
        reportBlockIds: ["block_1"],
        validatedAt: "2026-05-11T00:00:07.000Z"
      },
      "2026-05-11T00:00:07.000Z"
    )
  ];
  const repository = {
    workflow: {
      createAgentRun: vi.fn().mockResolvedValue({ id: "db_run_trace_validator" }),
      createToolCalls: vi.fn().mockResolvedValue({ count: 0 }),
      updateNodeStatuses: vi.fn().mockResolvedValue([])
    },
    artifact: {
      create: vi.fn().mockImplementation(async (input: { kind: string }) => ({
        id: `db_artifact_${input.kind}`
      }))
    },
    intelligence: {
      createSourceSnapshot: vi.fn().mockResolvedValue({ id: "db_snapshot_1" }),
      createEvidenceSpan: vi.fn().mockImplementation(
        async (input: { quoteHash: string }) => ({
          id:
            options.evidenceSpanPersistedIds?.get(input.quoteHash.replace("sha256:", "")) ??
            "db_span_1"
        })
      ),
      createFact: vi.fn().mockResolvedValue({ id: "db_legacy_fact_unused" }),
      createAtomicFact: vi.fn().mockImplementation(
        async (input: { statement: string }) => {
          const fixtureId = input.statement.replace(/^Atomic fact /, "").replace(/\.$/, "");
          return {
            id: options.atomicFactPersistedIds?.get(fixtureId) ?? "db_atomic_fact_1"
          };
        }
      ),
      createKnowledgeItem: vi.fn().mockResolvedValue({ id: "db_knowledge_1" }),
      createClaim: vi.fn().mockResolvedValue({ id: "db_claim_1" }),
      createReport: vi.fn().mockResolvedValue({
        id: "db_report_1",
        blocks:
          options.reportBlocksFromCreateReport ?? [
            { id: "db_report_block_1", blockKey: "block_1" }
          ]
      }),
      createReviewFindings: vi.fn().mockResolvedValue({ count: 0 }),
      createTraceValidationResult: vi.fn().mockResolvedValue({
        id: "db_trace_validation_1"
      }),
      createTraceEdges: vi.fn().mockResolvedValue({ count: 5 }),
      createModelRuns: vi.fn().mockResolvedValue({ count: 0 })
    }
  };

  return {
    input: {
      projectId,
      competitors: [{ id: "competitor_cursor", name: "Cursor" }],
      workflowRecord: {
        id: "workflow_db_1",
        nodes: [{ id: "db_node_trace_validator", nodeKey: "trace_validator" }]
      },
      workflow,
      agentRuns: [
        {
          nodeId: "trace_validator",
          run: {
            id: "agent_run_trace_validator",
            agentName: "trace_validator",
            status: "succeeded" as const,
            input: {},
            output: {},
            startedAt: "2026-05-11T00:00:07.000Z",
            finishedAt: "2026-05-11T00:00:08.000Z"
          },
          toolCalls: []
        }
      ],
      artifacts,
      repositories: repository
    },
    repository
  };
}
