import { describe, expect, it } from "vitest";
import { buildAnalysisRequirements } from "./run-analysis";

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
});
