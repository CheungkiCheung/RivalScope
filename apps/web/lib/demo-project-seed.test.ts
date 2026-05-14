import { describe, expect, it } from "vitest";
import { buildSeedDemoProjectInput } from "./demo-project-seed";

describe("buildSeedDemoProjectInput", () => {
  it("builds a deterministic offline top-3 demo project contract", async () => {
    const result = await buildSeedDemoProjectInput();

    expect(result.project).toMatchObject({
      owner: {
        email: "demo@rivalscope.local",
        name: "RivalScope Demo"
      },
      name: "RivalScope Top-3 Demo"
    });
    expect(result.project.description).toContain("[demo:repair_lift]");
    expect(result.project.competitors).toEqual([
      {
        name: "Cursor",
        website: "https://cursor.com",
        isPrimary: true
      },
      {
        name: "Codex",
        website: "https://openai.com/codex",
        isPrimary: false
      },
      {
        name: "Trae",
        website: "https://trae.ai",
        isPrimary: false
      }
    ]);
    expect(result.project.dimensions).toEqual([
      {
        key: "pricing",
        label: "Pricing",
        description: "Pricing, packaging, and commercial plan signals.",
        required: true
      },
      {
        key: "positioning",
        label: "Positioning",
        description: "Market narrative, target buyer, and differentiated promise.",
        required: true
      },
      {
        key: "developer_experience",
        label: "Developer Experience",
        description: "Workflow ergonomics, collaboration, review, and delivery experience.",
        required: true
      }
    ]);
    expect(result.sources).toHaveLength(3);
    expect(result.sources.map((source) => source.uri)).toEqual([
      "https://demo.rivalscope.local/cursor/pricing",
      "https://demo.rivalscope.local/codex/workflow",
      "https://demo.rivalscope.local/trae/developer-experience"
    ]);
    expect(result.sources.every((source) => source.kind === "URL")).toBe(true);
    expect(result.sources.every((source) => source.chunks.length > 0)).toBe(true);
    expect(
      result.sources.flatMap((source) => source.chunks).every((chunk) => chunk.text.length > 0)
    ).toBe(true);
    expect(result.toolCalls.length).toBeGreaterThan(0);
  });
});
