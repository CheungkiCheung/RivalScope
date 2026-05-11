import { describe, expect, test } from "vitest";
import { createAgentRunContext } from "@rivalscope/agents";
import {
  createChunkTextTool,
  createFixtureSearchAgentTool,
  createHtmlToTextTool
} from "./agent-source-tools";

describe("agent source tools", () => {
  test("search tool records structured output through the agent context", async () => {
    const context = createAgentRunContext();
    const searchTool = createFixtureSearchAgentTool({
      Cursor: [
        {
          title: "Cursor docs",
          url: "https://cursor.example/docs",
          snippet: "Cursor documents AI coding workflows."
        }
      ]
    });

    const output = await context.callTool(searchTool, {
      competitor: "Cursor",
      dimensions: ["developer_experience"],
      limit: 1
    });

    expect(output.results[0]?.title).toBe("Cursor docs");
    expect(context.getToolCalls()).toMatchObject([
      {
        toolName: "fixture_search",
        status: "succeeded",
        input: {
          competitor: "Cursor",
          dimensions: ["developer_experience"],
          limit: 1
        },
        output
      }
    ]);
  });

  test("html and chunk tools expose stable names and schema-validated outputs", async () => {
    const context = createAgentRunContext();
    const html = await context.callTool(createHtmlToTextTool(), {
      html: "<main><h1>Codex</h1><p>Agent workflow.</p></main>"
    });
    const chunks = await context.callTool(createChunkTextTool(), {
      sourceId: "source_codex",
      text: html.text,
      maxWords: 3
    });

    expect(html.text).toBe("Codex\nAgent workflow.");
    expect(chunks.chunks).toEqual([
      {
        id: "source_codex_chunk_0001",
        sourceId: "source_codex",
        ordinal: 0,
        text: "Codex Agent workflow.",
        tokenCount: 3
      }
    ]);
    expect(context.getToolCalls().map((toolCall) => toolCall.toolName)).toEqual([
      "html_to_text",
      "chunk_text"
    ]);
  });
});
