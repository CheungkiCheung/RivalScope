import { describe, expect, test } from "vitest";
import { createConfiguredSearchProvider } from "./search-provider-env";

describe("search provider env", () => {
  test("uses fixture search when only an API key is present", async () => {
    const provider = createConfiguredSearchProvider({
      env: {
        TAVILY_API_KEY: "present-but-not-selected"
      },
      fixtureIndex: {
        Cursor: [
          {
            title: "Fixture Cursor",
            url: "https://fixture.example/cursor",
            snippet: "Fixture result."
          }
        ]
      }
    });

    const result = await provider.search({
      competitor: "Cursor",
      dimensions: ["pricing"],
      limit: 1
    });

    expect(provider.name).toBe("fixture");
    expect(result.results[0]?.title).toBe("Fixture Cursor");
  });

  test("rejects an explicit unsupported provider before callers write project data", () => {
    expect(() =>
      createConfiguredSearchProvider({
        env: {
          RIVALSCOPE_SEARCH_PROVIDER: "unknown"
        },
        fixtureIndex: {}
      })
    ).toThrow("Unsupported search provider unknown");
  });
});
