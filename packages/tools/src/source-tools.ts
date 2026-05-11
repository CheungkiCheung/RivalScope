import { z } from "zod";

export const searchInputSchema = z.object({
  competitor: z.string().min(1),
  dimensions: z.array(z.string().min(1)).default([]),
  limit: z.number().int().positive().max(10).default(5)
});

export const searchResultSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  snippet: z.string(),
  competitor: z.string().min(1),
  rank: z.number().int().positive()
});

export const searchOutputSchema = z.object({
  results: z.array(searchResultSchema)
});

export type SearchInput = z.input<typeof searchInputSchema>;
export type SearchOutput = z.infer<typeof searchOutputSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;

export interface FixtureSearchDocument {
  title: string;
  url: string;
  snippet: string;
}

export type FixtureSearchIndex = Record<string, FixtureSearchDocument[]>;

export function createFixtureSearchTool(index: FixtureSearchIndex) {
  return async (input: SearchInput): Promise<SearchOutput> => {
    const parsed = searchInputSchema.parse(input);
    const documents = index[parsed.competitor] ?? [];

    return {
      results: documents.slice(0, parsed.limit).map((document, index) => ({
        ...document,
        competitor: parsed.competitor,
        rank: index + 1
      }))
    };
  };
}

export const fetchUrlInputSchema = z.object({
  url: z.string().url(),
  maxBytes: z.number().int().positive().default(500_000)
});

export const fetchUrlOutputSchema = z.object({
  url: z.string().url(),
  status: z.number().int(),
  contentType: z.string(),
  body: z.string()
});

export type FetchUrlInput = z.input<typeof fetchUrlInputSchema>;
export type FetchUrlOutput = z.infer<typeof fetchUrlOutputSchema>;
export type FetchImplementation = (url: string) => Promise<Response>;

export async function fetchUrl(
  input: FetchUrlInput,
  fetchImplementation: FetchImplementation = fetch
): Promise<FetchUrlOutput> {
  const parsed = fetchUrlInputSchema.parse(input);
  const response = await fetchImplementation(parsed.url);
  const body = await response.text();
  const bytes = new TextEncoder().encode(body).byteLength;

  if (bytes > parsed.maxBytes) {
    throw new Error(
      `Fetched body for ${parsed.url} exceeds maxBytes ${parsed.maxBytes}`
    );
  }

  return {
    url: parsed.url,
    status: response.status,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    body
  };
}

export const htmlToTextInputSchema = z.object({
  html: z.string()
});

export const htmlToTextOutputSchema = z.object({
  text: z.string()
});

export type HtmlToTextInput = z.infer<typeof htmlToTextInputSchema>;
export type HtmlToTextOutput = z.infer<typeof htmlToTextOutputSchema>;

export function htmlToText(input: HtmlToTextInput): HtmlToTextOutput {
  const parsed = htmlToTextInputSchema.parse(input);
  const withoutBlockedContent = parsed.html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, " ");
  const withLineBreaks = withoutBlockedContent
    .replace(/<\/(h[1-6]|p|li|div|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(withoutTags);

  return {
    text: decoded
      .split("\n")
      .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
  };
}

export const chunkTextInputSchema = z.object({
  sourceId: z.string().min(1),
  text: z.string(),
  maxWords: z.number().int().positive().default(180)
});

export const chunkTextOutputSchema = z.object({
  chunks: z.array(
    z.object({
      id: z.string().min(1),
      sourceId: z.string().min(1),
      ordinal: z.number().int().nonnegative(),
      text: z.string(),
      tokenCount: z.number().int().nonnegative()
    })
  )
});

export type ChunkTextInput = z.input<typeof chunkTextInputSchema>;
export type ChunkTextOutput = z.infer<typeof chunkTextOutputSchema>;

export function chunkText(input: ChunkTextInput): ChunkTextOutput {
  const parsed = chunkTextInputSchema.parse(input);
  const words = parsed.text.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  const chunks: ChunkTextOutput["chunks"] = [];

  for (let index = 0; index < words.length; index += parsed.maxWords) {
    const chunkWords = words.slice(index, index + parsed.maxWords);
    const ordinal = chunks.length;

    chunks.push({
      id: `${parsed.sourceId}_chunk_${String(ordinal + 1).padStart(4, "0")}`,
      sourceId: parsed.sourceId,
      ordinal,
      text: chunkWords.join(" "),
      tokenCount: chunkWords.length
    });
  }

  return { chunks };
}

export function normalizeSourceTitle(input: {
  title?: string | null;
  url: string;
}): string {
  const title = input.title?.trim();

  if (title) {
    return title;
  }

  return new URL(input.url).hostname;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}
