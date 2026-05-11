import { describe, expect, it } from "vitest";
import {
  blockDependents,
  createWorkflow,
  failNode,
  getReadyNodes,
  markNodeRunning,
  succeedNode,
  type WorkflowNode
} from "./workflow";

const node = (
  id: string,
  dependsOn: string[] = [],
  maxRetries = 1
): WorkflowNode => ({
  id,
  type: "agent",
  agentName: `${id}-agent`,
  dependsOn,
  status: "pending",
  inputArtifactIds: [],
  outputArtifactIds: [],
  retryCount: 0,
  maxRetries
});

describe("workflow DAG scheduling", () => {
  it("only marks dependency-free pending nodes as ready", () => {
    const workflow = createWorkflow({
      id: "wf_1",
      projectId: "project_1",
      nodes: [node("research"), node("extract", ["research"])]
    });

    const ready = getReadyNodes(workflow);

    expect(ready.map((item) => item.id)).toEqual(["research"]);
  });

  it("unlocks downstream nodes after all dependencies succeed", () => {
    const workflow = createWorkflow({
      id: "wf_1",
      projectId: "project_1",
      nodes: [
        node("research"),
        node("extract", ["research"]),
        node("analyze", ["extract"])
      ]
    });

    const afterResearch = succeedNode(workflow, "research", ["artifact_sources"]);
    const ready = getReadyNodes(afterResearch);

    expect(ready.map((item) => item.id)).toEqual(["extract"]);
  });

  it("keeps nodes immutable when status changes", () => {
    const workflow = createWorkflow({
      id: "wf_1",
      projectId: "project_1",
      nodes: [node("research")]
    });

    const running = markNodeRunning(workflow, "research", "run_1");

    expect(workflow.nodes[0]?.status).toBe("pending");
    expect(running.nodes[0]?.status).toBe("running");
    expect(running).not.toBe(workflow);
    expect(running.nodes[0]).not.toBe(workflow.nodes[0]);
  });

  it("retries failed nodes until max retries is exhausted", () => {
    const workflow = createWorkflow({
      id: "wf_1",
      projectId: "project_1",
      nodes: [node("research", [], 2)]
    });

    const firstFailure = failNode(workflow, "research", "network timeout");
    const secondFailure = failNode(firstFailure, "research", "network timeout");

    expect(firstFailure.nodes[0]?.status).toBe("pending");
    expect(firstFailure.nodes[0]?.retryCount).toBe(1);
    expect(secondFailure.nodes[0]?.status).toBe("failed");
    expect(secondFailure.nodes[0]?.retryCount).toBe(2);
  });

  it("blocks descendants when an upstream node permanently fails", () => {
    const workflow = createWorkflow({
      id: "wf_1",
      projectId: "project_1",
      nodes: [
        node("research", [], 1),
        node("extract", ["research"]),
        node("analyze", ["extract"])
      ]
    });

    const failed = failNode(workflow, "research", "source unavailable");
    const blocked = blockDependents(failed, "research");

    expect(blocked.nodes.find((item) => item.id === "extract")?.status).toBe(
      "blocked"
    );
    expect(blocked.nodes.find((item) => item.id === "analyze")?.status).toBe(
      "blocked"
    );
  });
});
