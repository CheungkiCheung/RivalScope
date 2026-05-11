import { createTool, type Tool } from "@rivalscope/agents";
import {
  chunkText,
  chunkTextInputSchema,
  chunkTextOutputSchema,
  createFixtureSearchTool,
  fetchUrl,
  fetchUrlInputSchema,
  fetchUrlOutputSchema,
  htmlToText,
  htmlToTextInputSchema,
  htmlToTextOutputSchema,
  searchInputSchema,
  searchOutputSchema,
  type ChunkTextInput,
  type ChunkTextOutput,
  type FetchImplementation,
  type FetchUrlInput,
  type FetchUrlOutput,
  type FixtureSearchIndex,
  type HtmlToTextInput,
  type HtmlToTextOutput,
  type SearchInput,
  type SearchOutput
} from "./source-tools";

export function createFixtureSearchAgentTool(
  index: FixtureSearchIndex
): Tool<SearchInput, SearchOutput> {
  const execute = createFixtureSearchTool(index);

  return createTool({
    name: "fixture_search",
    description: "Searches deterministic fixture sources for a competitor.",
    inputSchema: searchInputSchema,
    outputSchema: searchOutputSchema,
    execute: async (input) => execute(input)
  });
}

export function createFetchUrlTool(
  fetchImplementation?: FetchImplementation
): Tool<FetchUrlInput, FetchUrlOutput> {
  return createTool({
    name: "fetch_url",
    description: "Fetches URL content with status, content type, and size limits.",
    inputSchema: fetchUrlInputSchema,
    outputSchema: fetchUrlOutputSchema,
    execute: async (input) => fetchUrl(input, fetchImplementation)
  });
}

export function createHtmlToTextTool(): Tool<HtmlToTextInput, HtmlToTextOutput> {
  return createTool({
    name: "html_to_text",
    description: "Converts HTML content into normalized readable text.",
    inputSchema: htmlToTextInputSchema,
    outputSchema: htmlToTextOutputSchema,
    execute: async (input) => htmlToText(input)
  });
}

export function createChunkTextTool(): Tool<ChunkTextInput, ChunkTextOutput> {
  return createTool({
    name: "chunk_text",
    description: "Splits normalized source text into stable source-linked chunks.",
    inputSchema: chunkTextInputSchema,
    outputSchema: chunkTextOutputSchema,
    execute: async (input) => chunkText(input)
  });
}
