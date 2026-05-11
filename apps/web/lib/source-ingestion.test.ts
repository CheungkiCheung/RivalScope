import { describe, expect, test } from "vitest";
import { collectFixtureSources } from "./source-ingestion";

describe("source ingestion", () => {
  test("collects one parsed and chunked source per competitor result", async () => {
    const result = await collectFixtureSources({
      competitors: ["Cursor", "Codex"],
      dimensions: ["pricing", "developer_experience"],
      searchIndex: {
        Cursor: [
          {
            title: "Cursor pricing",
            url: "https://cursor.example/pricing",
            snippet: "Cursor pricing page"
          }
        ],
        Codex: [
          {
            title: "Codex workflows",
            url: "https://codex.example/workflows",
            snippet: "Codex workflow page"
          }
        ]
      },
      documentsByUrl: {
        "https://cursor.example/pricing":
          "<main><h1>Cursor pricing</h1><p>Pro and Team plans.</p></main>",
        "https://codex.example/workflows":
          "<main><h1>Codex workflows</h1><p>Agentic software engineering.</p></main>"
      },
      maxWordsPerChunk: 4
    });

    expect(result.sources).toEqual([
      {
        kind: "URL",
        title: "Cursor pricing",
        uri: "https://cursor.example/pricing",
        chunks: [
          {
            ordinal: 0,
            text: "Cursor pricing Pro and",
            tokenCount: 4
          },
          {
            ordinal: 1,
            text: "Team plans.",
            tokenCount: 2
          }
        ]
      },
      {
        kind: "URL",
        title: "Codex workflows",
        uri: "https://codex.example/workflows",
        chunks: [
          {
            ordinal: 0,
            text: "Codex workflows Agentic software",
            tokenCount: 4
          },
          {
            ordinal: 1,
            text: "engineering.",
            tokenCount: 1
          }
        ]
      }
    ]);
    expect(result.toolCalls.map((toolCall) => toolCall.toolName)).toEqual([
      "fixture_search",
      "fetch_url",
      "html_to_text",
      "chunk_text",
      "fixture_search",
      "fetch_url",
      "html_to_text",
      "chunk_text"
    ]);
  });
});
