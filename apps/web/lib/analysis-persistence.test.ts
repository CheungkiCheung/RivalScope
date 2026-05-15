import { describe, expect, it, vi } from "vitest";
import type { Workflow } from "@rivalscope/core";
import type { Artifact } from "@rivalscope/agents";
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
  it("persists routed research artifacts and remaps their workflow output ids", async () => {
    const workflow: Workflow = {
      id: "workflow_project_1",
      projectId: "project_1",
      nodes: [
        {
          id: "research_plan",
          type: "agent",
          agentName: "research_plan",
          dependsOn: [],
          status: "succeeded",
          inputArtifactIds: ["artifact_temp_requirements"],
          outputArtifactIds: ["artifact_temp_research_plan"],
          retryCount: 0,
          maxRetries: 1,
          currentAgentRunId: "agent_run_temp_research_plan"
        },
        {
          id: "research_branches",
          type: "agent",
          agentName: "research_branches",
          dependsOn: ["research_plan"],
          status: "succeeded",
          inputArtifactIds: [],
          outputArtifactIds: ["artifact_temp_research_branch_results"],
          retryCount: 0,
          maxRetries: 1,
          currentAgentRunId: "agent_run_temp_research_branches"
        },
        {
          id: "research_synthesis",
          type: "agent",
          agentName: "research_synthesis",
          dependsOn: ["research_branches"],
          status: "succeeded",
          inputArtifactIds: [],
          outputArtifactIds: ["artifact_temp_research_synthesis"],
          retryCount: 0,
          maxRetries: 1,
          currentAgentRunId: "agent_run_temp_research_synthesis"
        }
      ]
    };
    const artifacts: Artifact[] = [
      createArtifact(
        "artifact_temp_requirements",
        "analysis_requirements",
        {
          competitors: [{ id: "competitor_cursor", name: "Cursor" }],
          requiredDimensions: ["pricing"]
        },
        "2026-05-11T00:00:00.000Z"
      ),
      createArtifact(
        "artifact_temp_research_plan",
        "research_plan",
        {
          projectId: "project_1",
          strategy: "competitor_dimension_matrix",
          branches: []
        },
        "2026-05-11T00:00:01.000Z"
      ),
      createArtifact(
        "artifact_temp_research_branch_results",
        "research_branch_results",
        {
          projectId: "project_1",
          branchResults: []
        },
        "2026-05-11T00:00:02.000Z"
      ),
      createArtifact(
        "artifact_temp_research_synthesis",
        "research_synthesis",
        {
          projectId: "project_1",
          totalBranches: 0,
          succeededBranches: 0,
          partialBranches: 0,
          failedBranches: 0,
          evidenceGaps: [],
          branchResults: [],
          includedClaimIds: [],
          excludedClaimIds: []
        },
        "2026-05-11T00:00:03.000Z"
      )
    ];
    const repository = {
      workflow: {
        createAgentRun: vi
          .fn()
          .mockImplementation(async (input: { agentName: string }) => ({
            id: `db_run_${input.agentName}`
          })),
        createToolCalls: vi.fn().mockResolvedValue({ count: 0 }),
        createModelCalls: vi.fn().mockResolvedValue({ count: 0 }),
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
        createFact: vi
          .fn()
          .mockImplementation(async (input: { competitorId: string }) => ({
            id: `db_fact_${input.competitorId}`
          })),
        createClaim: vi.fn(),
        createReport: vi.fn(),
        createReviewFindings: vi.fn()
      }
    };

    const result = await persistAnalysisExecution({
      projectId: "project_1",
      competitors: [{ id: "competitor_cursor", name: "Cursor" }],
      workflowRecord: {
        id: "workflow_db_1",
        nodes: [
          { id: "db_node_research_plan", nodeKey: "research_plan" },
          { id: "db_node_research_branches", nodeKey: "research_branches" },
          { id: "db_node_research_synthesis", nodeKey: "research_synthesis" }
        ]
      },
      workflow,
      agentRuns: [
        {
          nodeId: "research_plan",
          run: {
            id: "agent_run_temp_research_plan",
            agentName: "research_plan",
            status: "succeeded",
            input: {},
            output: {},
            startedAt: "2026-05-11T00:00:00.000Z",
            finishedAt: "2026-05-11T00:00:01.000Z"
          },
          toolCalls: [],
          modelCalls: []
        },
        {
          nodeId: "research_branches",
          run: {
            id: "agent_run_temp_research_branches",
            agentName: "research_branches",
            status: "succeeded",
            input: {},
            output: {},
            startedAt: "2026-05-11T00:00:01.000Z",
            finishedAt: "2026-05-11T00:00:02.000Z"
          },
          toolCalls: [],
          modelCalls: []
        },
        {
          nodeId: "research_synthesis",
          run: {
            id: "agent_run_temp_research_synthesis",
            agentName: "research_synthesis",
            status: "succeeded",
            input: {},
            output: {},
            startedAt: "2026-05-11T00:00:02.000Z",
            finishedAt: "2026-05-11T00:00:03.000Z"
          },
          toolCalls: [],
          modelCalls: []
        }
      ],
      artifacts,
      repositories: repository
    });

    expect(repository.artifact.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "research_plan" })
    );
    expect(repository.artifact.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "research_branch_results" })
    );
    expect(repository.artifact.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "research_synthesis" })
    );
    expect(repository.workflow.updateNodeStatuses).toHaveBeenCalledWith(
      "workflow_db_1",
      expect.arrayContaining([
        expect.objectContaining({
          nodeKey: "research_synthesis",
          outputArtifactIds: ["db_artifact_research_synthesis"]
        })
      ])
    );
    expect(repository.intelligence.createFact).not.toHaveBeenCalled();
    expect(repository.intelligence.createReport).not.toHaveBeenCalled();
    expect(result.report).toBeUndefined();
  });

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
          findings: [
            {
              severity: "high",
              category: "untraced_fact",
              message: "Claim cites a fact without source chunks.",
              targetType: "claim",
              targetId: "claim_temp_1",
              dimension: "pricing",
              repairSuggestion:
                "Remove the claim or rerun source ingestion before publishing."
            }
          ]
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
        createModelCalls: vi.fn().mockResolvedValue({ count: 1 }),
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
          ],
          modelCalls: [
            {
              id: "model_call_temp_1",
              provider: "mock",
              model: "mock-fixture",
              task: "extract_facts",
              status: "succeeded",
              responseFormat: "json_object",
              input: { prompt: "facts" },
              output: { content: "{\"facts\":[]}" },
              usage: {
                inputTokens: 12,
                outputTokens: 8,
                totalTokens: 20
              },
              startedAt: "2026-05-11T00:00:00.500Z",
              finishedAt: "2026-05-11T00:00:01.500Z"
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
          toolCalls: [],
          modelCalls: []
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
          toolCalls: [],
          modelCalls: []
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
          toolCalls: [],
          modelCalls: []
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
    expect(repository.workflow.createModelCalls).toHaveBeenCalledWith("db_run_extract", [
      expect.objectContaining({
        provider: "mock",
        model: "mock-fixture",
        task: "extract_facts",
        status: "SUCCEEDED",
        responseFormat: "json_object",
        input: { prompt: "facts" },
        output: { content: "{\"facts\":[]}" },
        usage: {
          inputTokens: 12,
          outputTokens: 8,
          totalTokens: 20
        }
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
    expect(repository.intelligence.createReviewFindings).toHaveBeenCalledWith([
      expect.objectContaining({
        targetType: "claim",
        targetId: "claim_temp_1",
        targetDimension: "pricing",
        category: "UNTRACED_FACT",
        repairSuggestion:
          "Remove the claim or rerun source ingestion before publishing."
      })
    ]);
    expect(result.workflow.nodes.find((node) => node.id === "write")?.outputArtifactIds).toEqual([
      "db_artifact_report"
    ]);
  });

  it("persists failed workflow state without requiring downstream intelligence artifacts", async () => {
    const workflow: Workflow = {
      id: "workflow_project_1",
      projectId: "project_1",
      nodes: [
        {
          id: "extract",
          type: "agent",
          agentName: "extract",
          dependsOn: [],
          status: "failed",
          inputArtifactIds: ["artifact_temp_source", "artifact_temp_requirements"],
          outputArtifactIds: [],
          retryCount: 1,
          maxRetries: 1,
          currentAgentRunId: "agent_run_temp_extract",
          startedAt: "2026-05-11T00:00:00.000Z",
          finishedAt: "2026-05-11T00:00:02.000Z",
          errorMessage: "Model fact fact_1 references unknown competitor GhostWriter"
        },
        {
          id: "analyze",
          type: "agent",
          agentName: "analyze",
          dependsOn: ["extract"],
          status: "blocked",
          inputArtifactIds: [],
          outputArtifactIds: [],
          retryCount: 0,
          maxRetries: 1
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
          requiredDimensions: ["pricing"],
          competitors: [{ id: "competitor_cursor", name: "Cursor" }]
        },
        "2026-05-11T00:00:01.000Z"
      )
    ];
    const repository = {
      workflow: {
        createAgentRun: vi.fn().mockResolvedValue({ id: "db_run_extract" }),
        createToolCalls: vi.fn().mockResolvedValue({ count: 0 }),
        createModelCalls: vi.fn().mockResolvedValue({ count: 0 }),
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
        createClaim: vi.fn(),
        createReport: vi.fn(),
        createReviewFindings: vi.fn()
      }
    };

    const result = await persistAnalysisExecution({
      projectId: "project_1",
      competitors: [{ id: "competitor_cursor", name: "Cursor" }],
      workflowRecord: {
        id: "workflow_db_1",
        nodes: [
          { id: "db_node_extract", nodeKey: "extract" },
          { id: "db_node_analyze", nodeKey: "analyze" }
        ]
      },
      workflow,
      agentRuns: [
        {
          nodeId: "extract",
          run: {
            id: "agent_run_temp_extract",
            agentName: "extract",
            status: "failed",
            input: {},
            errorMessage: "Model fact fact_1 references unknown competitor GhostWriter",
            startedAt: "2026-05-11T00:00:00.000Z",
            finishedAt: "2026-05-11T00:00:02.000Z"
          },
          toolCalls: [],
          modelCalls: [
            {
              id: "model_call_temp_1",
              provider: "mock",
              task: "extract_facts",
              status: "failed",
              input: { prompt: "facts" },
              errorMessage: "Model fact fact_1 references unknown competitor GhostWriter",
              startedAt: "2026-05-11T00:00:00.500Z",
              finishedAt: "2026-05-11T00:00:01.500Z"
            }
          ]
        }
      ],
      artifacts,
      repositories: repository
    });

    expect(repository.workflow.createAgentRun).toHaveBeenCalledTimes(1);
    expect(repository.workflow.createModelCalls).toHaveBeenCalledWith("db_run_extract", [
      expect.objectContaining({
        provider: "mock",
        task: "extract_facts",
        status: "FAILED",
        errorMessage: "Model fact fact_1 references unknown competitor GhostWriter"
      })
    ]);
    expect(repository.workflow.updateNodeStatuses).toHaveBeenCalledWith(
      "workflow_db_1",
      expect.arrayContaining([
        expect.objectContaining({
          nodeKey: "extract",
          status: "FAILED",
          currentAgentRunId: "db_run_extract"
        }),
        expect.objectContaining({
          nodeKey: "analyze",
          status: "BLOCKED"
        })
      ])
    );
    expect(repository.intelligence.createFact).not.toHaveBeenCalled();
    expect(repository.intelligence.createReport).not.toHaveBeenCalled();
    expect(result.report).toBeUndefined();
  });

  it("rejects persisted facts that do not cite source chunks before writing intelligence rows", async () => {
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
          inputArtifactIds: ["artifact_temp_source"],
          outputArtifactIds: ["artifact_temp_facts"],
          retryCount: 0,
          maxRetries: 1
        },
        {
          id: "analyze",
          type: "agent",
          agentName: "analyze",
          dependsOn: ["extract"],
          status: "succeeded",
          inputArtifactIds: ["artifact_temp_facts"],
          outputArtifactIds: ["artifact_temp_claims"],
          retryCount: 0,
          maxRetries: 1
        },
        {
          id: "write",
          type: "agent",
          agentName: "write",
          dependsOn: ["analyze"],
          status: "succeeded",
          inputArtifactIds: ["artifact_temp_claims"],
          outputArtifactIds: ["artifact_temp_report"],
          retryCount: 0,
          maxRetries: 1
        },
        {
          id: "critique",
          type: "agent",
          agentName: "critique",
          dependsOn: ["write"],
          status: "succeeded",
          inputArtifactIds: ["artifact_temp_report"],
          outputArtifactIds: ["artifact_temp_findings"],
          retryCount: 0,
          maxRetries: 1
        }
      ]
    };
    const artifacts: Artifact[] = [
      createArtifact(
        "artifact_temp_facts",
        "facts",
        {
          projectId: "project_1",
          facts: [
            {
              id: "fact_untraced",
              projectId: "project_1",
              competitorId: "Cursor",
              dimension: "pricing",
              statement: "Cursor has an untraced pricing claim.",
              sourceChunkIds: [],
              confidence: 0.72
            }
          ]
        },
        "2026-05-11T00:00:00.000Z"
      ),
      createArtifact(
        "artifact_temp_claims",
        "claims",
        {
          projectId: "project_1",
          claims: [
            {
              id: "claim_untraced",
              projectId: "project_1",
              dimension: "pricing",
              statement: "Cursor has an untraced pricing claim.",
              factIds: ["fact_untraced"],
              confidence: 0.7,
              kind: "single_competitor"
            }
          ]
        },
        "2026-05-11T00:00:01.000Z"
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
              body: "Cursor has an untraced pricing claim.",
              claimIds: ["claim_untraced"]
            }
          ]
        },
        "2026-05-11T00:00:02.000Z"
      ),
      createArtifact(
        "artifact_temp_findings",
        "review_findings",
        {
          projectId: "project_1",
          status: "needs_revision",
          qualityScore: 80,
          findings: []
        },
        "2026-05-11T00:00:03.000Z"
      )
    ];
    const repository = {
      workflow: {
        createAgentRun: vi.fn().mockResolvedValue({ id: "db_run_extract" }),
        createToolCalls: vi.fn().mockResolvedValue({ count: 0 }),
        createModelCalls: vi.fn().mockResolvedValue({ count: 0 }),
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
        createClaim: vi.fn(),
        createReport: vi.fn(),
        createReviewFindings: vi.fn()
      }
    };

    await expect(
      persistAnalysisExecution({
        projectId: "project_1",
        competitors: [{ id: "competitor_cursor", name: "Cursor" }],
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
        agentRuns: [],
        artifacts,
        repositories: repository
      })
    ).rejects.toThrow(
      "Fact fact_untraced cannot be persisted without source chunks."
    );
    expect(repository.intelligence.createFact).not.toHaveBeenCalled();
    expect(repository.intelligence.createReport).not.toHaveBeenCalled();
  });

  it("rejects claims that mix fact dimensions before writing intelligence rows", async () => {
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
          inputArtifactIds: ["artifact_temp_source"],
          outputArtifactIds: ["artifact_temp_facts"],
          retryCount: 0,
          maxRetries: 1
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
          maxRetries: 1
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
          maxRetries: 1
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
          maxRetries: 1
        }
      ]
    };
    const artifacts: Artifact[] = [
      createArtifact(
        "artifact_temp_facts",
        "facts",
        {
          projectId: "project_1",
          facts: [
            {
              id: "fact_pricing",
              projectId: "project_1",
              competitorId: "Cursor",
              dimension: "pricing",
              statement: "Cursor has a pricing fact.",
              sourceChunkIds: ["chunk_1"],
              confidence: 0.9
            },
            {
              id: "fact_positioning",
              projectId: "project_1",
              competitorId: "Cursor",
              dimension: "positioning",
              statement: "Cursor has a positioning fact.",
              sourceChunkIds: ["chunk_2"],
              confidence: 0.9
            }
          ]
        },
        "2026-05-11T00:00:00.000Z"
      ),
      createArtifact(
        "artifact_temp_claims",
        "claims",
        {
          projectId: "project_1",
          claims: [
            {
              id: "claim_mixed_dimensions",
              projectId: "project_1",
              dimension: "pricing",
              statement: "Cursor has a mixed-dimension claim.",
              factIds: ["fact_pricing", "fact_positioning"],
              confidence: 0.7,
              kind: "comparative"
            }
          ]
        },
        "2026-05-11T00:00:01.000Z"
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
              body: "Cursor has a mixed-dimension claim.",
              claimIds: ["claim_mixed_dimensions"]
            }
          ]
        },
        "2026-05-11T00:00:02.000Z"
      ),
      createArtifact(
        "artifact_temp_findings",
        "review_findings",
        {
          projectId: "project_1",
          status: "needs_revision",
          qualityScore: 80,
          findings: []
        },
        "2026-05-11T00:00:03.000Z"
      )
    ];
    const repository = {
      workflow: {
        createAgentRun: vi.fn().mockResolvedValue({ id: "db_run_extract" }),
        createToolCalls: vi.fn().mockResolvedValue({ count: 0 }),
        createModelCalls: vi.fn().mockResolvedValue({ count: 0 }),
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
        createClaim: vi.fn(),
        createReport: vi.fn(),
        createReviewFindings: vi.fn()
      }
    };

    await expect(
      persistAnalysisExecution({
        projectId: "project_1",
        competitors: [{ id: "competitor_cursor", name: "Cursor" }],
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
        agentRuns: [],
        artifacts,
        repositories: repository
      })
    ).rejects.toThrow(
      "Claim claim_mixed_dimensions cites facts outside its dimension: fact_positioning."
    );
    expect(repository.intelligence.createFact).not.toHaveBeenCalled();
    expect(repository.intelligence.createClaim).not.toHaveBeenCalled();
    expect(repository.intelligence.createReport).not.toHaveBeenCalled();
  });
});
