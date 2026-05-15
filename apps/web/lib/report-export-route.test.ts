import { describe, expect, it } from "vitest";
import { buildReportExportResponse } from "./report-export-route";

describe("buildReportExportResponse", () => {
  const exportResult = {
    json: {
      project: {
        id: "project_1",
        name: "AI Coding Tools",
        description: null
      },
      report: null,
      synthesis: {
        includedClaimIds: [],
        excludedClaimIds: [],
        evidenceGapIds: []
      },
      evidenceAppendix: [],
      warnings: []
    },
    markdown: "# AI Coding Tools\n\nNo report has been generated yet."
  };

  it("returns a markdown attachment response", async () => {
    const response = buildReportExportResponse({
      projectName: "AI Coding Tools",
      format: "markdown",
      exportResult
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("content-disposition")).toContain(
      "rivalscope-ai-coding-tools.md"
    );
    expect(await response.text()).toBe(exportResult.markdown);
  });

  it("returns a JSON attachment response", async () => {
    const response = buildReportExportResponse({
      projectName: "AI Coding Tools",
      format: "json",
      exportResult
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toContain(
      "rivalscope-ai-coding-tools.json"
    );
    expect(await response.json()).toEqual(exportResult.json);
  });
});
