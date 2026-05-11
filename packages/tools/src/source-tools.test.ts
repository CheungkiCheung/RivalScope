import { describe, expect, test } from "vitest";
import {
  chunkText,
  createFixtureSearchTool,
  fetchUrl,
  htmlToText,
  normalizeSourceTitle
} from "./source-tools";

describe("source tools", () => {
  test("fixture search returns deterministic competitor-specific results", async () => {
    const search = createFixtureSearchTool({
      Cursor: [
        {
          title: "Cursor pricing",
          url: "https://cursor.example/pricing",
          snippet: "Cursor offers Pro and Team plans."
        }
      ]
    });

    const result = await search({
      competitor: "Cursor",
      dimensions: ["pricing"],
      limit: 3
    });

    expect(result.results).toEqual([
      {
        title: "Cursor pricing",
        url: "https://cursor.example/pricing",
        snippet: "Cursor offers Pro and Team plans.",
        competitor: "Cursor",
        rank: 1
      }
    ]);
  });

  test("htmlToText removes scripts, styles, tags, and repeated whitespace", () => {
    const text = htmlToText({
      html: `
        <html>
          <head>
            <style>.hidden { color: red; }</style>
            <script>window.secret = "token";</script>
            <title>Ignored</title>
          </head>
          <body>
            <h1>Cursor Pricing</h1>
            <p>Individual Pro plans.</p>
            <p>Team workflows &amp; admin controls.</p>
          </body>
        </html>
      `
    });

    expect(text.text).toBe(
      "Cursor Pricing\nIndividual Pro plans.\nTeam workflows & admin controls."
    );
  });

  test("chunkText creates stable chunks with source-linked ids", () => {
    const result = chunkText({
      sourceId: "source_cursor",
      text: "Cursor has Pro plans. Cursor supports teams.\n\nCodex focuses on agent workflows.",
      maxWords: 5
    });

    expect(result.chunks).toEqual([
      {
        id: "source_cursor_chunk_0001",
        sourceId: "source_cursor",
        ordinal: 0,
        text: "Cursor has Pro plans. Cursor",
        tokenCount: 5
      },
      {
        id: "source_cursor_chunk_0002",
        sourceId: "source_cursor",
        ordinal: 1,
        text: "supports teams. Codex focuses on",
        tokenCount: 5
      },
      {
        id: "source_cursor_chunk_0003",
        sourceId: "source_cursor",
        ordinal: 2,
        text: "agent workflows.",
        tokenCount: 2
      }
    ]);
  });

  test("fetchUrl rejects responses larger than the configured byte limit", async () => {
    await expect(
      fetchUrl(
        {
          url: "https://example.com/large",
          maxBytes: 4
        },
        async () =>
          new Response("too large", {
            status: 200,
            headers: { "content-type": "text/html" }
          })
      )
    ).rejects.toThrow("exceeds maxBytes");
  });

  test("normalizeSourceTitle falls back to hostname when title is empty", () => {
    expect(
      normalizeSourceTitle({
        title: "   ",
        url: "https://docs.cursor.com/pricing"
      })
    ).toBe("docs.cursor.com");
  });
});
