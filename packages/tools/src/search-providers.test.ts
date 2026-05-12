import { describe, expect, test } from "vitest";
import {
  createSearchProviderFromEnv,
  createTavilySearchTool
} from "./search-providers";

describe("search providers", () => {
  test("Tavily search maps provider results into the RivalScope search schema", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const search = createTavilySearchTool({
      apiKey: "test-key",
      fetchImplementation: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });

        return new Response(
          JSON.stringify({
            results: [
              {
                title: "Cursor pricing",
                url: "https://cursor.com/pricing",
                content: "Cursor offers Pro and Team plans."
              },
              {
                title: "Cursor docs",
                url: "https://docs.cursor.com",
                content: "Cursor documents developer workflows."
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
    });

    const result = await search({
      competitor: "Cursor",
      dimensions: ["pricing", "developer_experience"],
      limit: 2
    });

    expect(result).toEqual({
      results: [
        {
          title: "Cursor pricing",
          url: "https://cursor.com/pricing",
          snippet: "Cursor offers Pro and Team plans.",
          competitor: "Cursor",
          rank: 1
        },
        {
          title: "Cursor docs",
          url: "https://docs.cursor.com",
          snippet: "Cursor documents developer workflows.",
          competitor: "Cursor",
          rank: 2
        }
      ]
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.tavily.com/search");
    expect(requests[0]?.init.method).toBe("POST");
    expect(requests[0]?.init.headers).toEqual({
      authorization: "Bearer test-key",
      "content-type": "application/json"
    });
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      query: "Cursor pricing developer_experience competitive intelligence",
      max_results: 2,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false
    });
  });

  test("Tavily search throws a useful error on provider failure", async () => {
    const search = createTavilySearchTool({
      apiKey: "test-key",
      fetchImplementation: async () =>
        new Response(JSON.stringify({ error: "quota exceeded" }), {
          status: 429,
          headers: { "content-type": "application/json" }
        })
    });

    await expect(
      search({
        competitor: "Cursor",
        dimensions: ["pricing"],
        limit: 1
      })
    ).rejects.toThrow("Tavily search failed with status 429");
  });

  test("provider factory falls back to fixture search when no real provider is configured", async () => {
    const provider = createSearchProviderFromEnv(
      {},
      {
        Cursor: [
          {
            title: "Fixture Cursor",
            url: "https://fixture.example/cursor",
            snippet: "Fixture result."
          }
        ]
      }
    );

    const result = await provider.search({
      competitor: "Cursor",
      dimensions: ["pricing"],
      limit: 1
    });

    expect(provider.name).toBe("fixture");
    expect(result.results[0]?.title).toBe("Fixture Cursor");
  });

  test("provider factory requires an API key when Tavily is explicitly selected", () => {
    expect(() =>
      createSearchProviderFromEnv(
        {
          RIVALSCOPE_SEARCH_PROVIDER: "tavily"
        },
        {}
      )
    ).toThrow("TAVILY_API_KEY is required");
  });
});
