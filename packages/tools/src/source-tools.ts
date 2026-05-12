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
  maxBytes: z.number().int().positive().default(500_000),
  maxRedirects: z.number().int().nonnegative().max(5).default(2),
  timeoutMs: z.number().int().positive().max(30_000).default(10_000)
});

export const fetchUrlOutputSchema = z.object({
  url: z.string().url(),
  status: z.number().int(),
  contentType: z.string(),
  body: z.string()
});

export type FetchUrlInput = z.input<typeof fetchUrlInputSchema>;
export type FetchUrlOutput = z.infer<typeof fetchUrlOutputSchema>;
export type FetchImplementation = (
  url: string,
  init?: RequestInit
) => Promise<Response>;

export async function fetchUrl(
  input: FetchUrlInput,
  fetchImplementation: FetchImplementation = fetch
): Promise<FetchUrlOutput> {
  const parsed = fetchUrlInputSchema.parse(input);
  const { response, url } = await fetchWithSafeRedirects({
    url: parsed.url,
    maxRedirects: parsed.maxRedirects,
    timeoutMs: parsed.timeoutMs,
    fetchImplementation
  });
  const body = await response.text();
  const bytes = new TextEncoder().encode(body).byteLength;

  if (bytes > parsed.maxBytes) {
    throw new Error(
      `Fetched body for ${parsed.url} exceeds maxBytes ${parsed.maxBytes}`
    );
  }

  return {
    url,
    status: response.status,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    body
  };
}

async function fetchWithSafeRedirects(input: {
  url: string;
  maxRedirects: number;
  timeoutMs: number;
  fetchImplementation: FetchImplementation;
}): Promise<{ response: Response; url: string }> {
  let currentUrl = input.url;

  for (let redirectCount = 0; redirectCount <= input.maxRedirects; redirectCount += 1) {
    assertSafeFetchUrl(currentUrl);

    const response = await fetchWithTimeout({
      url: currentUrl,
      timeoutMs: input.timeoutMs,
      fetchImplementation: input.fetchImplementation
    });

    if (!isRedirectStatus(response.status)) {
      return {
        response,
        url: currentUrl
      };
    }

    const location = response.headers.get("location");

    if (!location) {
      return {
        response,
        url: currentUrl
      };
    }

    if (redirectCount === input.maxRedirects) {
      throw new Error(`Fetch URL ${input.url} exceeded maxRedirects ${input.maxRedirects}`);
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error(`Fetch URL ${input.url} exceeded maxRedirects ${input.maxRedirects}`);
}

async function fetchWithTimeout(input: {
  url: string;
  timeoutMs: number;
  fetchImplementation: FetchImplementation;
}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, input.timeoutMs);

  try {
    return await input.fetchImplementation(input.url, {
      redirect: "manual",
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Fetch URL ${input.url} timed out after ${input.timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function assertSafeFetchUrl(url: string): void {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsafe fetch URL ${url}: only HTTP(S) URLs are allowed`);
  }

  if (isLocalHostname(hostname) || isPrivateIpAddress(hostname)) {
    throw new Error(`Unsafe fetch URL ${url}: local and private network targets are blocked`);
  }
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

function isPrivateIpAddress(hostname: string): boolean {
  if (hostname === "::1" || hostname === "0:0:0:0:0:0:0:1") {
    return true;
  }

  const ipv4Parts = hostname.split(".");

  if (ipv4Parts.length !== 4) {
    return false;
  }

  const octets = ipv4Parts.map((part) => Number(part));

  if (
    octets.some(
      (octet, index) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255 ||
        String(octet) !== ipv4Parts[index]
    )
  ) {
    return false;
  }

  const [first = 0, second = 0] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
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
