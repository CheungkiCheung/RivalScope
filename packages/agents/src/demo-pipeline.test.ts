import { describe, expect, it } from "vitest";
import { createWorkflow } from "@rivalscope/core";
import {
  createDemoAnalysisWorkflowAgents,
  createDemoAnalysisWorkflowNodes
} from "./analysis-agents";
import { InMemoryArtifactStore } from "./artifacts";
import { createDemoFixtures } from "./demo-fixtures";
import { runWorkflow } from "./workflow-runner";

describe("deterministic demo evidence pipeline", () => {
  it("runs the target DAG offline and emits final-shaped evidence artifacts", async () => {
    const artifacts = new InMemoryArtifactStore();
    const requirementsArtifact = artifacts.put({
      kind: "analysis_requirements",
      value: {
        projectId: "project_1",
        requiredDimensions: ["pricing", "positioning", "developer_experience"],
        competitors: [
          { name: "Cursor" },
          { name: "Codex" },
          { name: "Trae" }
        ]
      }
    });
    const workflow = createWorkflow({
      id: "workflow_project_1",
      projectId: "project_1",
      nodes: createDemoAnalysisWorkflowNodes([requirementsArtifact.id])
    });

    const result = await runWorkflow({
      workflow,
      artifacts,
      agents: createDemoAnalysisWorkflowAgents()
    });
    const artifactList = artifacts.list();
    const claims = latest<{
      claims: Array<{
        id: string;
        status: string;
        verdict: string;
        evidenceSpanIds: string[];
        counterEvidenceCount: number;
      }>;
    }>(artifactList, "claims").claims;
    const traceValidation = latest<{
      status: string;
      checkedClaimIds: string[];
      checkedEvidenceSpanIds: string[];
      reportBlockIds: string[];
    }>(artifactList, "trace_validation");
    const reportBlocks = latest<{
      reportBlocks: Array<{
        id: string;
        claimIds: string[];
        evidenceSpanIds: string[];
      }>;
    }>(artifactList, "report_blocks").reportBlocks;

    expect(result.workflow.nodes.map((node) => node.id)).toEqual([
      "research_planner",
      "collector",
      "snapshot_parser",
      "extractor",
      "knowledge_structurer",
      "analyst",
      "skeptic",
      "confidence_scorer",
      "writer",
      "critic",
      "trace_validator"
    ]);
    expect(result.workflow.nodes.every((node) => node.status === "succeeded")).toBe(
      true
    );
    expect(result.agentRuns).toHaveLength(11);
    expect(result.agentRuns.flatMap((run) => run.toolCalls)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolName: "demo_source_discovery" }),
        expect.objectContaining({ toolName: "demo_snapshot_fetch" })
      ])
    );
    expect(artifactList.map((artifact) => artifact.kind)).toEqual(
      expect.arrayContaining([
        "source_candidates",
        "policy_decisions",
        "source_snapshots",
        "parsed_documents",
        "evidence_spans",
        "atomic_facts",
        "knowledge_items",
        "claims",
        "review_findings",
        "trace_validation",
        "report_blocks",
        "model_runs"
      ])
    );
    expect(claims.some((claim) => claim.evidenceSpanIds.length > 0)).toBe(true);
    expect(claims.some((claim) => claim.counterEvidenceCount > 0)).toBe(true);
    expect(claims.some((claim) => claim.status === "approved")).toBe(true);
    expect(claims.some((claim) => claim.verdict === "needs_more_evidence")).toBe(
      true
    );
    expect(
      claims.some((claim) =>
        ["refuted", "hypothesis"].includes(claim.verdict)
      )
    ).toBe(true);
    expect(reportBlocks.length).toBeGreaterThan(0);
    expect(reportBlocks.every((block) => block.claimIds.length > 0)).toBe(true);
    expect(reportBlocks.every((block) => block.evidenceSpanIds.length > 0)).toBe(
      true
    );
    expect(traceValidation.status).toBe("passed");
    expect(traceValidation.checkedClaimIds.length).toBeGreaterThan(0);
    expect(traceValidation.checkedEvidenceSpanIds.length).toBeGreaterThan(0);
    expect(traceValidation.reportBlockIds).toEqual(
      reportBlocks.map((block) => block.id)
    );
  });

  it("emits confidence scorer model runs with input claim id provenance", async () => {
    const artifacts = new InMemoryArtifactStore();
    const requirementsArtifact = artifacts.put({
      kind: "analysis_requirements",
      value: {
        projectId: "project_1",
        requiredDimensions: ["pricing"],
        competitors: [{ name: "Cursor" }]
      }
    });
    const workflow = createWorkflow({
      id: "workflow_project_1",
      projectId: "project_1",
      nodes: createDemoAnalysisWorkflowNodes([requirementsArtifact.id])
    });

    await runWorkflow({
      workflow,
      artifacts,
      agents: createDemoAnalysisWorkflowAgents()
    });

    const claims = latest<{ claims: Array<{ id: string }> }>(
      artifacts.list(),
      "claims"
    ).claims;
    const modelRuns = latest<{
      modelRuns: Array<{
        provider: string;
        model: string;
        inputClaimIds?: string[];
        input?: { claimIds?: string[] };
      }>;
    }>(artifacts.list(), "model_runs").modelRuns;

    expect(modelRuns).toContainEqual(
      expect.objectContaining({
        provider: "fixture",
        model: "deterministic-confidence-v1",
        input: {
          claimIds: claims.map((claim) => claim.id)
        }
      })
    );
    expect(modelRuns[0]).not.toHaveProperty("inputClaimIds");
  });

  it("creates canonical demo fixtures without retaining project_1 in serialized payloads", () => {
    const fixtures = createDemoFixtures("project_custom");

    expect(JSON.stringify(fixtures)).not.toContain("project_1");
    expect(fixtures.sourceSnapshots.every((snapshot) => snapshot.projectId === "project_custom")).toBe(
      true
    );
    expect(fixtures.evidenceSpans.every((span) => span.projectId === "project_custom")).toBe(
      true
    );
    expect(fixtures.claims.every((claim) => claim.projectId === "project_custom")).toBe(
      true
    );
  });

  it("emits demo fixture payloads with the requested project id", async () => {
    const projectId = "project_custom";
    const artifacts = new InMemoryArtifactStore();
    const requirementsArtifact = artifacts.put({
      kind: "analysis_requirements",
      value: {
        projectId,
        requiredDimensions: ["pricing"],
        competitors: [{ name: "Cursor" }]
      }
    });
    const workflow = createWorkflow({
      id: `workflow_${projectId}`,
      projectId,
      nodes: createDemoAnalysisWorkflowNodes([requirementsArtifact.id])
    });

    await runWorkflow({
      workflow,
      artifacts,
      agents: createDemoAnalysisWorkflowAgents()
    });

    const serializedArtifacts = JSON.stringify(artifacts.list());
    const snapshots = latest<{
      projectId: string;
      snapshots: Array<{ projectId: string }>;
    }>(artifacts.list(), "source_snapshots");
    const claims = latest<{
      projectId: string;
      claims: Array<{ projectId: string }>;
    }>(artifacts.list(), "claims");
    const traceValidation = latest<{ projectId: string }>(
      artifacts.list(),
      "trace_validation"
    );

    expect(snapshots.projectId).toBe(projectId);
    expect(snapshots.snapshots.every((snapshot) => snapshot.projectId === projectId)).toBe(
      true
    );
    expect(claims.projectId).toBe(projectId);
    expect(claims.claims.every((claim) => claim.projectId === projectId)).toBe(
      true
    );
    expect(traceValidation.projectId).toBe(projectId);
    expect(serializedArtifacts).not.toContain("project_1");
  });
});

function latest<T>(artifacts: ReturnType<InMemoryArtifactStore["list"]>, kind: string): T {
  const artifact = [...artifacts].reverse().find((candidate) => candidate.kind === kind);

  if (!artifact) {
    throw new Error(`Missing artifact ${kind}`);
  }

  return artifact.value as T;
}
