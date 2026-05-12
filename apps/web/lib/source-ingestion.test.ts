import { describe, expect, test } from "vitest";
import { collectFixtureSources, collectSources } from "./source-ingestion";

describe("source ingestion", () => {
  test("collectSources uses the provided search provider", async () => {
    const calls: unknown[] = [];
    const result = await collectSources({
      competitors: ["Cursor"],
      dimensions: ["pricing"],
      searchProvider: {
        name: "test",
        search: async (input) => {
          calls.push(input);

          return {
            results: [
              {
                title: "Cursor real result",
                url: "https://real.example/cursor",
                snippet: "real search",
                competitor: "Cursor",
                rank: 1
              }
            ]
          };
        }
      },
      documentsByUrl: {
        "https://real.example/cursor":
          "<main><h1>Cursor real result</h1><p>Provider-backed source.</p></main>"
      },
      maxWordsPerChunk: 8
    });

    expect(calls).toEqual([
      {
        competitor: "Cursor",
        dimensions: ["pricing"],
        limit: 1
      }
    ]);
    expect(result.sources[0]).toMatchObject({
      kind: "URL",
      title: "Cursor real result",
      uri: "https://real.example/cursor"
    });
  });

  test("collectSources skips failed fetches and keeps successful source collection running", async () => {
    const result = await collectSources({
      competitors: ["Cursor", "Codex"],
      dimensions: ["pricing"],
      searchProvider: {
        name: "test",
        search: async (input) => ({
          results: [
            {
              title: `${input.competitor} result`,
              url:
                input.competitor === "Cursor"
                  ? "http://127.0.0.1:3000/internal"
                  : "https://real.example/codex",
              snippet: "provider search",
              competitor: input.competitor,
              rank: 1
            }
          ]
        })
      },
      documentsByUrl: {
        "https://real.example/codex":
          "<main><h1>Codex public result</h1><p>Provider-backed source.</p></main>"
      },
      maxWordsPerChunk: 8
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      title: "Codex result",
      uri: "https://real.example/codex"
    });
    expect(result.toolCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "test_search",
          status: "succeeded"
        }),
        expect.objectContaining({
          toolName: "fetch_url",
          status: "failed",
          errorMessage: expect.stringContaining("Unsafe fetch URL")
        })
      ])
    );
  });

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
