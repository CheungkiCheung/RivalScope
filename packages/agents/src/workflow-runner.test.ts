import { describe, expect, it } from "vitest";
import { createWorkflow } from "@rivalscope/core";
import {
  createAnalysisWorkflowAgents,
  createExtractAgent,
  createCriticAgent
} from "./analysis-agents";
import { InMemoryArtifactStore } from "./artifacts";
import {
  runWorkflow
} from "./workflow-runner";
import { runAgent } from "./agent";

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
        {
          id: "extract",
          type: "agent",
          agentName: "extract",
          dependsOn: [],
          status: "pending",
          inputArtifactIds: [sourceArtifact.id],
          outputArtifactIds: [],
          retryCount: 0,
          maxRetries: 1
        },
        {
          id: "analyze",
          type: "agent",
          agentName: "analyze",
          dependsOn: ["extract"],
          status: "pending",
          inputArtifactIds: [],
          outputArtifactIds: [],
          retryCount: 0,
          maxRetries: 1
        },
        {
          id: "write",
          type: "agent",
          agentName: "write",
          dependsOn: ["analyze"],
          status: "pending",
          inputArtifactIds: [],
          outputArtifactIds: [],
          retryCount: 0,
          maxRetries: 1
        },
        {
          id: "critique",
          type: "agent",
          agentName: "critique",
          dependsOn: ["write"],
          status: "pending",
          inputArtifactIds: [],
          outputArtifactIds: [],
          retryCount: 0,
          maxRetries: 1
        }
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
    expect(result.agentRuns).toHaveLength(4);
    expect(result.agentRuns.map((run) => run.nodeId)).toEqual([
      "extract",
      "analyze",
      "write",
      "critique"
    ]);

    const critiqueNode = result.workflow.nodes.find(
      (node) => node.id === "critique"
    );
    expect(critiqueNode?.currentAgentRunId).toBe(result.agentRuns[3]?.run.id);
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
        {
          id: "extract",
          type: "agent",
          agentName: "missing_agent",
          dependsOn: [],
          status: "pending",
          inputArtifactIds: [],
          outputArtifactIds: [],
          retryCount: 0,
          maxRetries: 1
        },
        {
          id: "analyze",
          type: "agent",
          agentName: "analyze",
          dependsOn: ["extract"],
          status: "pending",
          inputArtifactIds: [],
          outputArtifactIds: [],
          retryCount: 0,
          maxRetries: 1
        }
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
        {
          id: "artifact_requirements",
          kind: "analysis_requirements",
          createdAt: "2026-05-11T00:00:00.000Z",
          value: {
            competitors: [
              { name: "Cursor" },
              { name: "Codex" },
              { name: "Trae" }
            ],
            requiredDimensions: ["pricing", "positioning"]
          }
        },
        {
          id: "artifact_sources",
          kind: "source_chunks",
          createdAt: "2026-05-11T00:00:01.000Z",
          value: {
            chunks: [
              {
                id: "chunk_trae",
                sourceId: "manual_notes",
                ordinal: 0,
                text: "Trae emphasizes AI-assisted development workflows for product engineering teams.",
                tokenCount: 8
              }
            ]
          }
        }
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
});

describe("critic agent", () => {
  it("flags unsupported claims, unknown fact references, missing dimensions, and uncited report sections", async () => {
    const critic = createCriticAgent();
    const result = await runAgent(critic, {
      projectId: "project_1",
      artifacts: [
        {
          id: "artifact_requirements",
          kind: "analysis_requirements",
          createdAt: "2026-05-11T00:00:00.000Z",
          value: {
            requiredDimensions: ["pricing", "positioning", "developer_experience"]
          }
        },
        {
          id: "artifact_facts",
          kind: "facts",
          createdAt: "2026-05-11T00:00:01.000Z",
          value: {
            facts: [
              {
                id: "fact_1",
                projectId: "project_1",
                competitorId: "cursor",
                dimension: "pricing",
                statement: "Cursor offers paid plans.",
                sourceChunkIds: ["chunk_1"],
                confidence: 0.9
              }
            ]
          }
        },
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
    expect(JSON.stringify(output.value)).toContain(
      "has no cited facts"
    );
    expect(JSON.stringify(output.value)).toContain(
      "unknown fact fact_missing"
    );
    expect(JSON.stringify(output.value)).toContain(
      "Missing required dimension developer_experience"
    );
    expect(JSON.stringify(output.value)).toContain(
      "section_summary has no cited claims"
    );
    expect(JSON.stringify(output.value)).toContain(
      "low confidence"
    );
  });
});
