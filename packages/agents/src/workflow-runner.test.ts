import { describe, expect, it } from "vitest";
import { createWorkflow } from "@rivalscope/core";
import {
  createAnalysisWorkflowAgents,
  createAnalystAgent,
  createCriticAgent,
  createExtractAgent,
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
    expect(JSON.stringify(output.value)).toContain("has no cited facts");
    expect(JSON.stringify(output.value)).toContain("unknown fact fact_missing");
    expect(JSON.stringify(output.value)).toContain(
      "Missing required dimension developer_experience"
    );
    expect(JSON.stringify(output.value)).toContain(
      "section_summary has no cited claims"
    );
    expect(JSON.stringify(output.value)).toContain("low confidence");
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
