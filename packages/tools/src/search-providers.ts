import {
  createFixtureSearchTool,
  searchInputSchema,
  type FixtureSearchIndex,
  type SearchInput,
  type SearchOutput
} from "./source-tools";

export interface SearchProvider {
  name: string;
  search(input: SearchInput): Promise<SearchOutput>;
}

export interface SearchProviderEnv {
  RIVALSCOPE_SEARCH_PROVIDER?: string;
  TAVILY_API_KEY?: string;
}

export interface TavilySearchOptions {
  apiKey: string;
  endpoint?: string;
  fetchImplementation?: typeof fetch;
}

interface TavilySearchResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    snippet?: string;
  }>;
}

export function createTavilySearchTool(options: TavilySearchOptions) {
  const endpoint = options.endpoint ?? "https://api.tavily.com/search";
  const fetchImplementation = options.fetchImplementation ?? fetch;

  return async (input: SearchInput): Promise<SearchOutput> => {
    const parsed = searchInputSchema.parse(input);
    const response = await fetchImplementation(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        query: buildCompetitiveSearchQuery(parsed.competitor, parsed.dimensions),
        max_results: parsed.limit,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `Tavily search failed with status ${response.status}: ${message}`
      );
    }

    const payload = (await response.json()) as TavilySearchResponse;

    return {
      results: (payload.results ?? [])
        .filter((result) => result.title && result.url)
        .slice(0, parsed.limit)
        .map((result, index) => ({
          title: result.title ?? result.url ?? "Untitled result",
          url: result.url ?? "",
          snippet: result.content ?? result.snippet ?? "",
          competitor: parsed.competitor,
          rank: index + 1
        }))
    };
  };
}

export function createSearchProviderFromEnv(
  env: SearchProviderEnv,
  fixtureIndex: FixtureSearchIndex,
  fetchImplementation?: typeof fetch
): SearchProvider {
  const provider = env.RIVALSCOPE_SEARCH_PROVIDER?.trim().toLowerCase() || "fixture";

  if (provider === "fixture") {
    return {
      name: "fixture",
      search: createFixtureSearchTool(fixtureIndex)
    };
  }

  if (provider === "tavily") {
    const apiKey = env.TAVILY_API_KEY?.trim();

    if (!apiKey) {
      throw new Error("TAVILY_API_KEY is required when using Tavily search");
    }

    return {
      name: "tavily",
      search: createTavilySearchTool({
        apiKey,
        ...(fetchImplementation ? { fetchImplementation } : {})
      })
    };
  }

  throw new Error(`Unsupported search provider ${provider}`);
}

function buildCompetitiveSearchQuery(
  competitor: string,
  dimensions: string[]
): string {
  return [competitor, ...dimensions, "competitive intelligence"].join(" ");
}
