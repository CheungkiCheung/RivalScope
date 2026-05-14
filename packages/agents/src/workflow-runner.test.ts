import { describe, expect, it } from "vitest";
import { createWorkflow } from "@rivalscope/core";
import {
  createAnalysisWorkflowAgents,
  createAnalystAgent,
  createApplyRepairAgent,
  createClaimTrustSnapshotAgent,
  createCriticAgent,
  createExtractAgent,
  createFinalEvaluatorAgent,
  createRepairPlannerAgent,
  createWriterAgent
} from "./analysis-agents";
import { runAgent } from "./agent";
import { InMemoryArtifactStore } from "./artifacts";
import { MockModelClient } from "./model-client";
import { runWorkflow } from "./workflow-runner";

describe("workflow runner", () => {
  it("executes the extract -> analyze -> write -> critique chain with artifacts", async () => {
    const artifacts = new InMemoryArtifactStore();
    const sourceArtifact = artifacts.put({
      kind: "source_chunks",
      value: {
        projectId: "project_1",
        chunks: [
          {
            id: "chunk_cursor_pricing",
            sourceId: "src_cursor",
            ordinal: 0,
            text: "Cursor offers individual Pro and Team plans for AI coding.",
            tokenCount: 10
          },
          {
            id: "chunk_codex_positioning",
            sourceId: "src_codex",
            ordinal: 0,
            text: "Codex focuses on software engineering tasks through a coding agent workflow.",
            tokenCount: 11
          }
        ]
      }
    });
    const workflow = createWorkflow({
      id: "workflow_1",
      projectId: "project_1",
      nodes: [
        createWorkflowNode("extract", "extract", [], [sourceArtifact.id]),
        createWorkflowNode("analyze", "analyze", ["extract"]),
        createWorkflowNode("write", "write", ["analyze"]),
        createWorkflowNode("critique", "critique", ["write"])
      ]
    });

    const result = await runWorkflow({
      workflow,
      artifacts,
      agents: createAnalysisWorkflowAgents()
    });

    expect(result.workflow.nodes.every((node) => node.status === "succeeded")).toBe(
      true
    );
    expect(result.agentRuns.map((run) => run.nodeId)).toEqual([
      "extract",
      "analyze",
      "write",
      "critique"
    ]);
    expect(
      result.agentRuns.map((agentRun) => ({
        nodeId: agentRun.nodeId,
        runId: agentRun.run.id
      }))
    ).toEqual(
      result.workflow.nodes.map((node) => ({
        nodeId: node.id,
        runId: node.currentAgentRunId
      }))
    );

    const critiqueNode = result.workflow.nodes.find(
      (node) => node.id === "critique"
    );
    const critiqueArtifact = artifacts.get(critiqueNode?.outputArtifactIds[0] ?? "");

    expect(critiqueArtifact?.kind).toBe("review_findings");
    expect(critiqueArtifact?.value).toMatchObject({
      status: "approved",
      qualityScore: 100,
      findings: []
    });
  });

  it("executes the repair loop and emits final quality delta", async () => {
    const artifacts = new InMemoryArtifactStore();
    const sourceArtifact = artifacts.put({
      kind: "source_chunks",
      value: {
        projectId: "project_1",
        chunks: [
          {
            id: "chunk_cursor_pricing",
            sourceId: "src_cursor",
            ordinal: 0,
            text: "Cursor offers individual Pro and Team plans for AI coding.",
            tokenCount: 10
          }
        ]
      }
    });
    const requirementsArtifact = artifacts.put({
      kind: "analysis_requirements",
      value: {
        competitors: [{ id: "competitor_cursor", name: "Cursor" }],
        requiredDimensions: ["pricing", "developer_experience"]
      }
    });
    const workflow = createWorkflow({
      id: "workflow_1",
      projectId: "project_1",
      nodes: [
        createWorkflowNode("extract", "extract", [], [
          sourceArtifact.id,
          requirementsArtifact.id
        ]),
        createWorkflowNode("analyze", "analyze", ["extract"]),
        createWorkflowNode("write", "write", ["analyze"]),
        createWorkflowNode("critique", "critique", ["write"]),
        createWorkflowNode("repair", "repair", ["critique"]),
        createWorkflowNode("apply_repair", "apply_repair", ["repair"]),
        createWorkflowNode("final_eval", "final_eval", ["apply_repair"]),
        createWorkflowNode("trust_snapshot", "trust_snapshot", ["final_eval"])
      ]
    });

    const result = await runWorkflow({
      workflow,
      artifacts,
      agents: createAnalysisWorkflowAgents()
    });

    expect(result.workflow.nodes.every((node) => node.status === "succeeded")).toBe(
      true
    );
    expect(result.agentRuns.map((run) => run.nodeId)).toEqual([
      "extract",
      "analyze",
      "write",
      "critique",
      "repair",
      "apply_repair",
      "final_eval",
      "trust_snapshot"
    ]);

    const finalEvalNode = result.workflow.nodes.find(
      (node) => node.id === "final_eval"
    );
    const finalEvalArtifact = artifacts.get(
      finalEvalNode?.outputArtifactIds[0] ?? ""
    );

    expect(finalEvalArtifact?.kind).toBe("final_eval");
    expect(finalEvalArtifact?.value).toMatchObject({
      status: "unchanged",
      draftQualityScore: 90,
      repairedQualityScore: 90,
      delta: 0,
      unresolvedGaps: ["developer_experience"]
    });
  });

  it("blocks downstream nodes when an agent fails permanently", async () => {
    const artifacts = new InMemoryArtifactStore();
    const workflow = createWorkflow({
      id: "workflow_1",
      projectId: "project_1",
      nodes: [
        createWorkflowNode("extract", "missing_agent", []),
        createWorkflowNode("analyze", "analyze", ["extract"])
      ]
    });

    const result = await runWorkflow({
      workflow,
      artifacts,
      agents: createAnalysisWorkflowAgents()
    });

    expect(result.workflow.nodes.find((node) => node.id === "extract")?.status).toBe(
      "failed"
    );
    expect(result.workflow.nodes.find((node) => node.id === "analyze")?.status).toBe(
      "blocked"
    );
  });
});

describe("extract agent", () => {
  it("uses configured competitor names when assigning facts", async () => {
    const extract = createExtractAgent();

    const result = await runAgent(extract, {
      projectId: "project_1",
      artifacts: [
        createRequirementsArtifact({
          competitors: [{ name: "Cursor" }, { name: "Codex" }, { name: "Trae" }],
          requiredDimensions: ["pricing", "positioning"]
        }),
        createSourceChunksArtifact([
          {
            id: "chunk_trae",
            sourceId: "manual_notes",
            ordinal: 0,
            text: "Trae emphasizes AI-assisted development workflows for product engineering teams.",
            tokenCount: 8
          }
        ])
      ]
    });

    expect(result.output.value).toMatchObject({
      facts: [
        {
          competitorId: "Trae",
          dimension: "developer_experience"
        }
      ]
    });
  });

  it("fails before artifact creation when deterministic extraction cannot map a chunk to an allowed competitor", async () => {
    const extract = createExtractAgent();

    await expect(
      runAgent(extract, {
        projectId: "project_1",
        artifacts: [
          createRequirementsArtifact({
            competitors: [{ id: "competitor_cursor", name: "Cursor" }]
          }),
          createSourceChunksArtifact([
            {
              id: "chunk_unknown",
              sourceId: "source_unknown",
              ordinal: 0,
              text: "This source discusses pricing without naming the vendor.",
              tokenCount: 8
            }
          ])
        ]
      })
    ).rejects.toThrow(
      "Could not assign chunk chunk_unknown to a configured competitor"
    );
  });

  it("can use a model client for schema-validated fact extraction", async () => {
    const model = new MockModelClient([
      {
        content: JSON.stringify({
          facts: [
            {
              id: "fact_model_1",
              projectId: "attacker_project",
              competitorId: "Cursor",
              dimension: "pricing",
              statement: "Cursor offers paid Pro and Team plans.",
              sourceChunkIds: ["chunk_cursor_pricing"],
              confidence: 0.91
            }
          ]
        })
      }
    ]);
    const extract = createExtractAgent({ model });

    const result = await runAgent(extract, {
      projectId: "project_1",
      artifacts: [
        createRequirementsArtifact({
          competitors: [{ id: "competitor_cursor", name: "Cursor" }],
          requiredDimensions: ["pricing"]
        }),
        createSourceChunksArtifact([
          {
            id: "chunk_cursor_pricing",
            sourceId: "source_cursor",
            ordinal: 0,
            text: "Cursor offers paid Pro and Team plans.",
            tokenCount: 7
          }
        ])
      ]
    });

    expect(result.output.value).toMatchObject({
      facts: [
        {
          id: "fact_1",
          projectId: "project_1",
          competitorId: "competitor_cursor",
          sourceChunkIds: ["chunk_cursor_pricing"]
        }
      ]
    });
    expect(model.calls[0]).toMatchObject({
      task: "extract_facts",
      responseFormat: "json_object"
    });
    expect(result.modelCalls).toHaveLength(1);
    expect(result.modelCalls[0]).toMatchObject({
      provider: "mock",
      task: "extract_facts",
      status: "succeeded"
    });
    expect(result.modelCalls[0]?.usage).toBeUndefined();
  });

  it("rejects model facts assigned to competitors outside the project allowlist", async () => {
    const extract = createExtractAgent({
      model: new MockModelClient([
        {
          content: JSON.stringify({
            facts: [
              {
                competitorId: "GhostWriter",
                dimension: "pricing",
                statement: "GhostWriter offers a free plan.",
                sourceChunkIds: ["chunk_cursor_pricing"],
                confidence: 0.9
              }
            ]
          })
        }
      ])
    });
    const execution = runAgent(extract, {
      projectId: "project_1",
      artifacts: [
        createRequirementsArtifact({
          competitors: [{ id: "competitor_cursor", name: "Cursor" }],
          requiredDimensions: ["pricing"]
        }),
        createSourceChunksArtifact([
          {
            id: "chunk_cursor_pricing",
            sourceId: "source_cursor",
            ordinal: 0,
            text: "Cursor offers paid plans.",
            tokenCount: 4
          }
        ])
      ]
    });

    await expect(execution).rejects.toThrow(
      "Model fact fact_1 references unknown competitor GhostWriter"
    );
    await expect(execution).rejects.toMatchObject({
      modelCalls: [
        expect.objectContaining({
          provider: "mock",
          task: "extract_facts",
          status: "failed",
          errorMessage:
            "Model fact fact_1 references unknown competitor GhostWriter"
        })
      ]
    });
  });

  it("rejects model facts that cite unknown source chunks", async () => {
    const extract = createExtractAgent({
      model: new MockModelClient([
        {
          content: JSON.stringify({
            facts: [
              {
                competitorId: "Cursor",
                dimension: "pricing",
                statement: "Cursor offers paid plans.",
                sourceChunkIds: ["chunk_missing"],
                confidence: 0.9
              }
            ]
          })
        }
      ])
    });
    const execution = runAgent(extract, {
      projectId: "project_1",
      artifacts: [
        createRequirementsArtifact({
          competitors: [{ name: "Cursor" }]
        }),
        createSourceChunksArtifact([
          {
            id: "chunk_cursor_pricing",
            sourceId: "source_cursor",
            ordinal: 0,
            text: "Cursor offers paid plans.",
            tokenCount: 4
          }
        ])
      ]
    });

    await expect(execution).rejects.toThrow(
      "Model fact fact_1 cites unknown source chunk chunk_missing"
    );
    await expect(execution).rejects.toMatchObject({
      modelCalls: [
        expect.objectContaining({
          provider: "mock",
          task: "extract_facts",
          status: "failed",
          errorMessage:
            "Model fact fact_1 cites unknown source chunk chunk_missing"
        })
      ]
    });
  });

  it("keeps model calls on failed workflow runs", async () => {
    const artifacts = new InMemoryArtifactStore();
    const sourceArtifact = artifacts.put({
      kind: "source_chunks",
      value: {
        projectId: "project_1",
        chunks: [
          {
            id: "chunk_cursor_pricing",
            sourceId: "source_cursor",
            ordinal: 0,
            text: "Cursor offers paid plans.",
            tokenCount: 4
          }
        ]
      }
    });
    const requirementsArtifact = artifacts.put({
      kind: "analysis_requirements",
      value: {
        competitors: [{ id: "competitor_cursor", name: "Cursor" }],
        requiredDimensions: ["pricing"]
      }
    });
    const workflow = createWorkflow({
      id: "workflow_1",
      projectId: "project_1",
      nodes: [
        createWorkflowNode("extract", "extract", [], [
          sourceArtifact.id,
          requirementsArtifact.id
        ]),
        createWorkflowNode("analyze", "analyze", ["extract"])
      ]
    });

    const result = await runWorkflow({
      workflow,
      artifacts,
      agents: {
        extract: createExtractAgent({
          model: new MockModelClient([{ content: "not json" }])
        })
      }
    });

    expect(result.workflow.nodes.find((node) => node.id === "extract")?.status).toBe(
      "failed"
    );
    expect(result.workflow.nodes.find((node) => node.id === "analyze")?.status).toBe(
      "blocked"
    );
    expect(result.agentRuns[0]?.modelCalls).toHaveLength(1);
    expect(result.agentRuns[0]?.modelCalls[0]).toMatchObject({
      provider: "mock",
      task: "extract_facts",
      status: "failed",
      errorMessage: "Model output for extract_facts was not valid JSON"
    });
  });

  it("records deterministic attribution failures as failed workflow runs", async () => {
    const artifacts = new InMemoryArtifactStore();
    const sourceArtifact = artifacts.put({
      kind: "source_chunks",
      value: {
        projectId: "project_1",
        chunks: [
          {
            id: "chunk_unknown",
            sourceId: "source_unknown",
            ordinal: 0,
            text: "This source discusses pricing without naming the vendor.",
            tokenCount: 8
          }
        ]
      }
    });
    const requirementsArtifact = artifacts.put({
      kind: "analysis_requirements",
      value: {
        competitors: [{ id: "competitor_cursor", name: "Cursor" }],
        requiredDimensions: ["pricing"]
      }
    });
    const workflow = createWorkflow({
      id: "workflow_1",
      projectId: "project_1",
      nodes: [
        createWorkflowNode("extract", "extract", [], [
          sourceArtifact.id,
          requirementsArtifact.id
        ]),
        createWorkflowNode("analyze", "analyze", ["extract"])
      ]
    });

    const result = await runWorkflow({
      workflow,
      artifacts,
      agents: createAnalysisWorkflowAgents()
    });

    expect(result.workflow.nodes.find((node) => node.id === "extract")?.status).toBe(
      "failed"
    );
    expect(result.workflow.nodes.find((node) => node.id === "analyze")?.status).toBe(
      "blocked"
    );
    expect(result.agentRuns[0]?.run).toMatchObject({
      agentName: "extract",
      status: "failed",
      errorMessage: "Could not assign chunk chunk_unknown to a configured competitor"
    });
  });
});

describe("analyst agent", () => {
  it("can use a model client for schema-validated claim synthesis", async () => {
    const model = new MockModelClient([
      {
        content: JSON.stringify({
          claims: [
            {
              id: "claim_model_1",
              projectId: "attacker_project",
              dimension: "pricing",
              statement: "Cursor monetizes through paid individual and team plans.",
              factIds: ["fact_1"],
              confidence: 0.84,
              kind: "single_competitor"
            }
          ]
        })
      }
    ]);
    const analyst = createAnalystAgent({ model });

    const result = await runAgent(analyst, {
      projectId: "project_1",
      artifacts: [createFactsArtifact()]
    });

    expect(result.output.value).toMatchObject({
      claims: [
        {
          id: "claim_1",
          projectId: "project_1",
          factIds: ["fact_1"]
        }
      ]
    });
    expect(model.calls[0]).toMatchObject({
      task: "synthesize_claims",
      responseFormat: "json_object"
    });
    expect(result.modelCalls[0]).toMatchObject({
      provider: "mock",
      task: "synthesize_claims",
      status: "succeeded"
    });
  });

  it("rejects model claims that cite unknown facts", async () => {
    const analyst = createAnalystAgent({
      model: new MockModelClient([
        {
          content: JSON.stringify({
            claims: [
              {
                dimension: "pricing",
                statement: "Cursor has paid plans.",
                factIds: ["fact_missing"],
                confidence: 0.82,
                kind: "single_competitor"
              }
            ]
          })
        }
      ])
    });
    const execution = runAgent(analyst, {
      projectId: "project_1",
      artifacts: [createFactsArtifact()]
    });

    await expect(execution).rejects.toThrow(
      "Model claim claim_1 cites unknown fact fact_missing"
    );
    await expect(execution).rejects.toMatchObject({
      modelCalls: [
        expect.objectContaining({
          provider: "mock",
          task: "synthesize_claims",
          status: "failed",
          errorMessage: "Model claim claim_1 cites unknown fact fact_missing"
        })
      ]
    });
  });
});

describe("critic agent", () => {
  it("flags unsupported claims, unknown fact references, missing dimensions, and uncited report sections", async () => {
    const critic = createCriticAgent();
    const result = await runAgent(critic, {
      projectId: "project_1",
      artifacts: [
        createRequirementsArtifact({
          requiredDimensions: ["pricing", "positioning", "developer_experience"]
        }),
        createFactsArtifact(),
        {
          id: "artifact_claims",
          kind: "claims",
          createdAt: "2026-05-11T00:00:02.000Z",
          value: {
            claims: [
              {
                id: "claim_no_facts",
                projectId: "project_1",
                dimension: "pricing",
                statement: "Cursor has multiple plans.",
                factIds: [],
                confidence: 0.8,
                kind: "single_competitor"
              },
              {
                id: "claim_unknown_fact",
                projectId: "project_1",
                dimension: "positioning",
                statement: "Codex is positioned as an agent workflow.",
                factIds: ["fact_missing"],
                confidence: 0.82,
                kind: "single_competitor"
              },
              {
                id: "claim_low_confidence",
                projectId: "project_1",
                dimension: "pricing",
                statement: "Cursor is likely cheaper than every competitor.",
                factIds: ["fact_1"],
                confidence: 0.49,
                kind: "comparative"
              }
            ]
          }
        },
        {
          id: "artifact_report",
          kind: "report",
          createdAt: "2026-05-11T00:00:03.000Z",
          value: {
            sections: [
              {
                id: "section_summary",
                title: "Executive Summary",
                body: "The market is competitive.",
                claimIds: []
              },
              {
                id: "section_pricing",
                title: "Pricing",
                body: "Cursor has paid plans.",
                claimIds: ["claim_low_confidence"]
              }
            ]
          }
        }
      ]
    });

    const output = result.output as {
      kind: string;
      value: unknown;
    };

    expect(output.kind).toBe("review_findings");
    expect(output.value).toMatchObject({
      status: "needs_revision",
      qualityScore: 20
    });
    const review = output.value as {
      status: string;
      qualityScore: number;
      findings: Array<{
        severity: string;
        category: string;
        message: string;
        targetType: string;
        targetId: string;
        dimension?: string;
        repairSuggestion: string;
      }>;
    };

    expect(review.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "unsupported_claim",
          targetType: "claim",
          targetId: "claim_no_facts",
          dimension: "pricing",
          repairSuggestion:
            "Remove the claim or attach at least one valid supporting fact before publication."
        }),
        expect.objectContaining({
          category: "unknown_fact",
          targetType: "claim",
          targetId: "claim_unknown_fact",
          dimension: "positioning",
          repairSuggestion:
            "Replace unknown fact references with persisted facts or rerun extraction for this claim."
        }),
        expect.objectContaining({
          category: "low_confidence",
          targetType: "claim",
          targetId: "claim_low_confidence",
          dimension: "pricing",
          repairSuggestion:
            "Downgrade the claim wording or collect stronger evidence before keeping it in the report."
        }),
        expect.objectContaining({
          category: "uncited_report_section",
          targetType: "section",
          targetId: "section_summary",
          repairSuggestion:
            "Attach at least one evidence-backed claim to this section or remove the section."
        }),
        expect.objectContaining({
          category: "missing_dimension",
          targetType: "dimension",
          targetId: "developer_experience",
          dimension: "developer_experience",
          repairSuggestion:
            "Collect or synthesize evidence-backed claims for the missing required dimension."
        })
      ])
    );
  });
});

describe("repair agent", () => {
  it("plans targeted claim removals and unresolved dimension gaps without inventing claims", async () => {
    const repair = createRepairPlannerAgent();

    const result = await runAgent(repair, {
      projectId: "project_1",
      artifacts: [
        createFactsArtifact(),
        createClaimsArtifact([
          {
            id: "claim_supported",
            projectId: "project_1",
            dimension: "pricing",
            statement: "Cursor has paid plans.",
            factIds: ["fact_1"],
            confidence: 0.84,
            kind: "single_competitor"
          },
          {
            id: "claim_unsupported",
            projectId: "project_1",
            dimension: "positioning",
            statement: "Cursor beats every competitor.",
            factIds: [],
            confidence: 0.82,
            kind: "comparative"
          }
        ]),
        createReportArtifact([
          {
            id: "section_summary",
            title: "Executive Summary",
            body: [
              "Cursor has paid plans.",
              "Cursor beats every competitor."
            ].join("\n"),
            claimIds: ["claim_supported", "claim_unsupported"]
          }
        ]),
        createReviewFindingsArtifact({
          qualityScore: 70,
          findings: [
            {
              id: "finding_claim_unsupported",
              severity: "high",
              category: "unsupported_claim",
              message: "Claim claim_unsupported has no cited facts.",
              targetType: "claim",
              targetId: "claim_unsupported",
              dimension: "positioning",
              repairSuggestion: "Remove the claim."
            },
            {
              id: "finding_missing_developer_experience",
              severity: "medium",
              category: "missing_dimension",
              message: "Missing required dimension developer_experience.",
              targetType: "dimension",
              targetId: "developer_experience",
              dimension: "developer_experience",
              repairSuggestion: "Collect evidence for developer experience."
            }
          ]
        })
      ]
    });

    expect(result.output.kind).toBe("repair_result");
    expect(result.output.value).toMatchObject({
      projectId: "project_1",
      draftQualityScore: 70,
      plannedQualityScore: 90,
      delta: 20,
      actions: [
        {
          type: "remove_claim_from_report",
          targetType: "claim",
          targetId: "claim_unsupported",
          severity: "high",
          status: "planned"
        },
        {
          type: "mark_dimension_gap",
          targetType: "dimension",
          targetId: "developer_experience",
          severity: "medium",
          status: "unresolved"
        }
      ],
      unresolvedGaps: ["developer_experience"]
    });
  });

  it("applies repair plans by removing unsafe claim references from the report", async () => {
    const applyRepair = createApplyRepairAgent();

    const result = await runAgent(applyRepair, {
      projectId: "project_1",
      artifacts: [
        createClaimsArtifact([
          {
            id: "claim_supported",
            projectId: "project_1",
            dimension: "pricing",
            statement: "Cursor has paid plans.",
            factIds: ["fact_1"],
            confidence: 0.84,
            kind: "single_competitor"
          },
          {
            id: "claim_unsupported",
            projectId: "project_1",
            dimension: "positioning",
            statement: "Cursor beats every competitor.",
            factIds: [],
            confidence: 0.82,
            kind: "comparative"
          }
        ]),
        createReportArtifact([
          {
            id: "section_summary",
            title: "Executive Summary",
            body: [
              "Cursor has paid plans.",
              "Cursor beats every competitor."
            ].join("\n"),
            claimIds: ["claim_supported", "claim_unsupported"]
          }
        ]),
        createRepairResultArtifact({
          draftQualityScore: 70,
          plannedQualityScore: 90,
          actions: [
            {
              id: "repair_remove_claim_unsupported",
              type: "remove_claim_from_report",
              targetType: "claim",
              targetId: "claim_unsupported",
              severity: "high",
              status: "planned",
              reason: "Claim claim_unsupported has no cited facts.",
              repairSuggestion: "Remove the claim."
            }
          ],
          unresolvedGaps: []
        })
      ]
    });

    expect(result.output.kind).toBe("report");
    expect(result.output.value).toMatchObject({
      title: "Competitive Intelligence Report",
      sections: [
        {
          id: "section_summary",
          title: "Executive Summary",
          body: "Cursor has paid plans.",
          claimIds: ["claim_supported"]
        }
      ],
      repair: {
        appliedActionIds: ["repair_remove_claim_unsupported"],
        removedClaimIds: ["claim_unsupported"]
      }
    });
  });

  it("summarizes final repair quality delta from the repaired report", async () => {
    const finalEvaluator = createFinalEvaluatorAgent();

    const result = await runAgent(finalEvaluator, {
      projectId: "project_1",
      artifacts: [
        createRepairResultArtifact({
          draftQualityScore: 70,
          plannedQualityScore: 90,
          actions: [
            {
              id: "repair_remove_claim_unsupported",
              type: "remove_claim_from_report",
              targetType: "claim",
              targetId: "claim_unsupported",
              severity: "high",
              status: "applied",
              reason: "Claim claim_unsupported has no cited facts.",
              repairSuggestion: "Remove the claim."
            },
            {
              id: "repair_gap_developer_experience",
              type: "mark_dimension_gap",
              targetType: "dimension",
              targetId: "developer_experience",
              severity: "medium",
              status: "unresolved",
              reason: "Missing required dimension developer_experience.",
              repairSuggestion: "Collect evidence for developer experience."
            }
          ],
          unresolvedGaps: ["developer_experience"]
        }),
        createReportArtifact(
          [
            {
              id: "section_summary",
              title: "Executive Summary",
              body: "Cursor has paid plans.",
              claimIds: ["claim_supported"]
            }
          ],
          {
            appliedActionIds: ["repair_remove_claim_unsupported"],
            removedClaimIds: ["claim_unsupported"]
          }
        )
      ]
    });

    expect(result.output.kind).toBe("final_eval");
    expect(result.output.value).toMatchObject({
      status: "improved",
      draftQualityScore: 70,
      repairedQualityScore: 90,
      delta: 20,
      actions: [
        {
          id: "repair_remove_claim_unsupported",
          status: "applied"
        },
        {
          id: "repair_gap_developer_experience",
          status: "unresolved"
        }
      ],
      unresolvedGaps: ["developer_experience"]
    });
  });

  it("creates before and after claim trust snapshots for repaired reports", async () => {
    const snapshot = createClaimTrustSnapshotAgent();

    const result = await runAgent(snapshot, {
      projectId: "project_1",
      artifacts: [
        createSourcesArtifact([
          {
            id: "source_1",
            projectId: "project_1",
            kind: "url",
            title: "Cursor pricing",
            uri: "https://cursor.com/pricing",
            collectedAt: "2026-05-13T00:00:00.000Z"
          }
        ]),
        createSourceChunksArtifact([
          {
            id: "chunk_1",
            sourceId: "source_1",
            ordinal: 0,
            text: "Cursor offers paid plans.",
            tokenCount: 5
          }
        ]),
        createFactsArtifact(),
        createClaimsArtifact([
          {
            id: "claim_supported",
            projectId: "project_1",
            dimension: "pricing",
            statement: "Cursor offers paid plans.",
            factIds: ["fact_1"],
            confidence: 0.84,
            kind: "single_competitor"
          },
          {
            id: "claim_overstated",
            projectId: "project_1",
            dimension: "pricing",
            statement:
              "Cursor guarantees the cheapest enterprise contract for every buyer.",
            factIds: ["fact_1"],
            confidence: 0.9,
            kind: "comparative"
          }
        ]),
        createReportArtifact([
          {
            id: "section_summary",
            title: "Executive Summary",
            body: [
              "Cursor offers paid plans.",
              "Cursor guarantees the cheapest enterprise contract for every buyer."
            ].join("\n"),
            claimIds: ["claim_supported", "claim_overstated"]
          }
        ]),
        createRepairResultArtifact({
          draftQualityScore: 100,
          plannedQualityScore: 100,
          actions: [
            {
              id: "repair_remove_claim_overstated",
              type: "remove_claim_from_report",
              targetType: "claim",
              targetId: "claim_overstated",
              severity: "high",
              status: "planned",
              reason:
                "Claim claim_overstated has weak lexical support from cited evidence.",
              repairSuggestion:
                "Remove this claim or collect stronger evidence before publication."
            }
          ],
          unresolvedGaps: []
        }),
        createReportArtifact(
          [
            {
              id: "section_summary",
              title: "Executive Summary",
              body: "Cursor offers paid plans.",
              claimIds: ["claim_supported"]
            }
          ],
          {
            appliedActionIds: ["repair_remove_claim_overstated"],
            removedClaimIds: ["claim_overstated"]
          }
        ),
        createFinalEvalArtifact({
          draftQualityScore: 100,
          repairedQualityScore: 100,
          delta: 0
        })
      ]
    });

    expect(result.output.kind).toBe("claim_trust_snapshot");
    expect(result.output.value).toMatchObject({
      projectId: "project_1",
      trustDelta: expect.any(Number),
      claims: [
        {
          claimId: "claim_supported",
          status: "kept",
          finalScore: expect.any(Number)
        },
        {
          claimId: "claim_overstated",
          status: "removed",
          finalScore: null,
          finalRiskLevel: null
        }
      ]
    });
    const value = result.output.value as {
      draftAverageTrust: number;
      finalAverageTrust: number;
      trustDelta: number;
    };
    expect(value.finalAverageTrust).toBeGreaterThan(value.draftAverageTrust);
    expect(value.trustDelta).toBe(
      value.finalAverageTrust - value.draftAverageTrust
    );
  });

  it("plans repair for structurally cited claims with weak semantic support", async () => {
    const repair = createRepairPlannerAgent();

    const result = await runAgent(repair, {
      projectId: "project_1",
      artifacts: [
        createSourcesArtifact([
          {
            id: "source_1",
            projectId: "project_1",
            kind: "url",
            title: "Cursor pricing",
            uri: "https://cursor.com/pricing",
            collectedAt: "2026-05-13T00:00:00.000Z"
          }
        ]),
        createSourceChunksArtifact([
          {
            id: "chunk_1",
            sourceId: "source_1",
            ordinal: 0,
            text: "Cursor offers paid plans.",
            tokenCount: 5
          }
        ]),
        createFactsArtifact(),
        createClaimsArtifact([
          {
            id: "claim_overstated",
            projectId: "project_1",
            dimension: "pricing",
            statement:
              "Cursor guarantees the cheapest enterprise contract for every buyer.",
            factIds: ["fact_1"],
            confidence: 0.9,
            kind: "comparative"
          }
        ]),
        createReportArtifact([
          {
            id: "section_summary",
            title: "Executive Summary",
            body:
              "Cursor guarantees the cheapest enterprise contract for every buyer.",
            claimIds: ["claim_overstated"]
          }
        ]),
        createReviewFindingsArtifact({
          qualityScore: 100,
          findings: []
        })
      ]
    });

    expect(result.output.kind).toBe("repair_result");
    expect(result.output.value).toMatchObject({
      draftQualityScore: 100,
      plannedQualityScore: 100,
      actions: [
        {
          type: "remove_claim_from_report",
          targetType: "claim",
          targetId: "claim_overstated",
          severity: "high",
          status: "planned",
          reason:
            "Claim claim_overstated has weak lexical support from cited evidence."
        }
      ]
    });
  });
});

describe("writer agent", () => {
  it("rejects report sections that cite unknown claims before emitting a report artifact", async () => {
    const writer = createWriterAgent({
      buildSections: () => [
        {
          id: "section_summary",
          title: "Executive Summary",
          body: "Cursor has paid plans.",
          claimIds: ["claim_missing"]
        }
      ]
    });

    await expect(
      runAgent(writer, {
        projectId: "project_1",
        artifacts: [
          {
            id: "artifact_claims",
            kind: "claims",
            createdAt: "2026-05-11T00:00:02.000Z",
            value: {
              claims: [
                {
                  id: "claim_1",
                  projectId: "project_1",
                  dimension: "pricing",
                  statement: "Cursor has paid plans.",
                  factIds: ["fact_1"],
                  confidence: 0.84,
                  kind: "single_competitor"
                }
              ]
            }
          }
        ]
      })
    ).rejects.toThrow(
      "Report section section_summary cites unknown claim claim_missing"
    );
  });
});

function createWorkflowNode(
  id: string,
  agentName: string,
  dependsOn: string[],
  inputArtifactIds: string[] = []
) {
  return {
    id,
    type: "agent" as const,
    agentName,
    dependsOn,
    status: "pending" as const,
    inputArtifactIds,
    outputArtifactIds: [],
    retryCount: 0,
    maxRetries: 1
  };
}

function createRequirementsArtifact(value: {
  competitors?: Array<{ id?: string; name: string }>;
  requiredDimensions?: string[];
}) {
  return {
    id: "artifact_requirements",
    kind: "analysis_requirements" as const,
    createdAt: "2026-05-11T00:00:00.000Z",
    value
  };
}

function createSourceChunksArtifact(
  chunks: Array<{
    id: string;
    sourceId: string;
    ordinal: number;
    text: string;
    tokenCount: number;
  }>
) {
  return {
    id: "artifact_sources",
    kind: "source_chunks" as const,
    createdAt: "2026-05-11T00:00:01.000Z",
    value: { chunks }
  };
}

function createSourcesArtifact(
  sources: Array<{
    id: string;
    projectId: string;
    kind: string;
    title: string;
    uri: string;
    collectedAt: string;
  }>
) {
  return {
    id: "artifact_source_records",
    kind: "sources" as const,
    createdAt: "2026-05-11T00:00:01.000Z",
    value: { sources }
  };
}

function createFactsArtifact() {
  return {
    id: "artifact_facts",
    kind: "facts" as const,
    createdAt: "2026-05-11T00:00:00.000Z",
    value: {
      facts: [
        {
          id: "fact_1",
          projectId: "project_1",
          competitorId: "Cursor",
          dimension: "pricing",
          statement: "Cursor offers paid plans.",
          sourceChunkIds: ["chunk_1"],
          confidence: 0.91
        }
      ]
    }
  };
}

function createClaimsArtifact(
  claims: Array<{
    id: string;
    projectId: string;
    dimension: string;
    statement: string;
    factIds: string[];
    confidence: number;
    kind: string;
  }>
) {
  return {
    id: "artifact_claims",
    kind: "claims" as const,
    createdAt: "2026-05-11T00:00:02.000Z",
    value: { claims }
  };
}

function createReportArtifact(
  sections: Array<{
    id: string;
    title: string;
    body: string;
    claimIds: string[];
  }>,
  repair?: {
    appliedActionIds: string[];
    removedClaimIds: string[];
  }
) {
  return {
    id: "artifact_report",
    kind: "report" as const,
    createdAt: "2026-05-11T00:00:03.000Z",
    value: {
      projectId: "project_1",
      title: "Competitive Intelligence Report",
      sections,
      ...(repair ? { repair } : {})
    }
  };
}

function createReviewFindingsArtifact(value: {
  qualityScore: number;
  findings: Array<{
    id: string;
    severity: string;
    category: string;
    message: string;
    targetType: string;
    targetId: string;
    dimension?: string;
    repairSuggestion: string;
  }>;
}) {
  return {
    id: "artifact_review_findings",
    kind: "review_findings" as const,
    createdAt: "2026-05-11T00:00:04.000Z",
    value
  };
}

function createRepairResultArtifact(value: {
  draftQualityScore: number;
  plannedQualityScore: number;
  actions: Array<{
    id: string;
    type: string;
    targetType: string;
    targetId: string;
    severity: string;
    status: string;
    reason: string;
    repairSuggestion: string;
  }>;
  unresolvedGaps: string[];
}) {
  return {
    id: "artifact_repair_result",
    kind: "repair_result" as const,
    createdAt: "2026-05-11T00:00:05.000Z",
    value: {
      projectId: "project_1",
      ...value,
      delta: value.plannedQualityScore - value.draftQualityScore
    }
  };
}

function createFinalEvalArtifact(value: {
  draftQualityScore: number;
  repairedQualityScore: number;
  delta: number;
}) {
  return {
    id: "artifact_final_eval",
    kind: "final_eval" as const,
    createdAt: "2026-05-11T00:00:06.000Z",
    value: {
      projectId: "project_1",
      status: value.delta > 0 ? "improved" : "unchanged",
      ...value,
      actions: [],
      unresolvedGaps: []
    }
  };
}
