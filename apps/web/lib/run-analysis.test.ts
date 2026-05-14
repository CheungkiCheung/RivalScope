import { describe, expect, it } from "vitest";
import {
  buildAnalysisRequirements,
  buildMvpWorkflowNodes
} from "./run-analysis";

describe("runAnalysis helpers", () => {
  it("builds model-visible requirements with canonical competitor ids and names", () => {
    expect(
      buildAnalysisRequirements({
        competitors: [
          { id: "competitor_cursor", name: "Cursor" },
          { id: "competitor_codex", name: "Codex" }
        ],
        analysisDimensions: [
          { key: "pricing", required: true },
          { key: "positioning", required: false },
          { key: "developer_experience", required: true }
        ]
      })
    ).toEqual({
      competitors: [
        { id: "competitor_cursor", name: "Cursor" },
        { id: "competitor_codex", name: "Codex" }
      ],
      requiredDimensions: ["pricing", "developer_experience"]
    });
  });

  it("marks repair-lift demo projects for deterministic seeded analysis", () => {
    expect(
      buildAnalysisRequirements({
        description:
          "Compare AI coding tools with a repeatable trust repair demo. [demo:repair_lift]",
        competitors: [{ id: "competitor_cursor", name: "Cursor" }],
        analysisDimensions: [{ key: "pricing", required: true }]
      })
    ).toEqual({
      competitors: [{ id: "competitor_cursor", name: "Cursor" }],
      requiredDimensions: ["pricing"],
      demoScenario: "repair_lift"
    });
  });

  it("builds the eval-guided repair DAG after critique", () => {
    expect(buildMvpWorkflowNodes(["artifact_sources"]).map((node) => ({
      id: node.id,
      agentName: node.agentName,
      dependsOn: node.dependsOn
    }))).toEqual([
      {
        id: "research_plan",
        agentName: "research_plan",
        dependsOn: []
      },
      {
        id: "extract",
        agentName: "extract",
        dependsOn: ["research_plan"]
      },
      {
        id: "analyze",
        agentName: "analyze",
        dependsOn: ["extract"]
      },
      {
        id: "research_branches",
        agentName: "research_branches",
        dependsOn: ["analyze"]
      },
      {
        id: "research_synthesis",
        agentName: "research_synthesis",
        dependsOn: ["research_branches"]
      },
      {
        id: "write",
        agentName: "write",
        dependsOn: ["research_synthesis"]
      },
      {
        id: "critique",
        agentName: "critique",
        dependsOn: ["write"]
      },
      {
        id: "judge_compare",
        agentName: "judge_compare",
        dependsOn: ["critique"]
      },
      {
        id: "repair",
        agentName: "repair",
        dependsOn: ["critique", "judge_compare"]
      },
      {
        id: "apply_repair",
        agentName: "apply_repair",
        dependsOn: ["repair"]
      },
      {
        id: "final_eval",
        agentName: "final_eval",
        dependsOn: ["apply_repair"]
      },
      {
        id: "trust_snapshot",
        agentName: "trust_snapshot",
        dependsOn: ["final_eval"]
      }
    ]);
  });
});
