import type { Tool, ToolCallRecord } from "@rivalscope/agents";
import { createAgentRunContext } from "@rivalscope/agents";
import {
  createChunkTextTool,
  createFetchUrlTool,
  createFixtureSearchAgentTool,
  createHtmlToTextTool,
  normalizeSourceTitle,
  searchInputSchema,
  searchOutputSchema,
  type FixtureSearchIndex,
  type SearchProvider
} from "@rivalscope/tools";

export interface CollectFixtureSourcesInput {
  competitors: string[];
  dimensions: string[];
  searchIndex: FixtureSearchIndex;
  documentsByUrl: Record<string, string>;
  maxWordsPerChunk?: number;
}

export interface CollectSourcesInput {
  competitors: string[];
  dimensions: string[];
  searchProvider: SearchProvider;
  documentsByUrl?: Record<string, string>;
  maxWordsPerChunk?: number;
}

export interface CollectedSource {
  kind: "URL";
  title: string;
  uri: string;
  chunks: Array<{
    ordinal: number;
    text: string;
    tokenCount: number;
  }>;
}

export interface CollectFixtureSourcesResult {
  sources: CollectedSource[];
  toolCalls: ToolCallRecord[];
}

export async function collectFixtureSources(
  input: CollectFixtureSourcesInput
): Promise<CollectFixtureSourcesResult> {
  const searchTool = createFixtureSearchAgentTool(input.searchIndex);

  return collectSources({
    competitors: input.competitors,
    dimensions: input.dimensions,
    searchProvider: {
      name: "fixture",
      search: (searchInput) => searchTool.execute(searchInput, {
        now: () => new Date().toISOString()
      })
    },
    documentsByUrl: input.documentsByUrl,
    ...(input.maxWordsPerChunk !== undefined
      ? { maxWordsPerChunk: input.maxWordsPerChunk }
      : {})
  });
}

export async function collectSources(
  input: CollectSourcesInput
): Promise<CollectFixtureSourcesResult> {
  const context = createAgentRunContext();
  const searchTool = createSearchProviderAgentTool(input.searchProvider);
  const fetchTool = createFetchUrlTool(async (url, init) => {
    const html = input.documentsByUrl?.[url];

    if (html === undefined) {
      return fetch(url, init);
    }

    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  });
  const htmlToTextTool = createHtmlToTextTool();
  const chunkTextTool = createChunkTextTool();
  const sources: CollectedSource[] = [];

  for (const competitor of input.competitors) {
    const search = await context.callTool(searchTool, {
      competitor,
      dimensions: input.dimensions,
      limit: 1
    });

    for (const result of search.results) {
      const fetched = await callToolOrSkip(context, fetchTool, {
        url: result.url,
        maxBytes: 500_000
      });

      if (!fetched || fetched.status < 200 || fetched.status >= 300) {
        continue;
      }

      const text = await context.callTool(htmlToTextTool, {
        html: fetched.body
      });
      const sourceId = createStableSourceId(competitor, result.url);
      const chunks = await context.callTool(chunkTextTool, {
        sourceId,
        text: text.text,
        maxWords: input.maxWordsPerChunk ?? 180
      });

      sources.push({
        kind: "URL",
        title: normalizeSourceTitle({
          title: result.title,
          url: result.url
        }),
        uri: result.url,
        chunks: chunks.chunks.map((chunk) => ({
          ordinal: chunk.ordinal,
          text: chunk.text,
          tokenCount: chunk.tokenCount
        }))
      });
    }
  }

  return {
    sources,
    toolCalls: context.getToolCalls()
  };
}

async function callToolOrSkip<I, O>(
  context: ReturnType<typeof createAgentRunContext>,
  tool: Tool<I, O>,
  input: I
): Promise<O | undefined> {
  try {
    return await context.callTool(tool, input);
  } catch {
    return undefined;
  }
}

function createSearchProviderAgentTool(searchProvider: SearchProvider) {
  return {
    name: `${searchProvider.name}_search`,
    description: `Searches public sources with the ${searchProvider.name} provider.`,
    inputSchema: searchInputSchema,
    outputSchema: searchOutputSchema,
    execute: async (input: Parameters<SearchProvider["search"]>[0]) =>
      searchProvider.search(input)
  };
}

function createStableSourceId(competitor: string, url: string): string {
  const normalizedCompetitor = competitor
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const normalizedUrl = url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  return `source_${normalizedCompetitor}_${normalizedUrl}`;
}
