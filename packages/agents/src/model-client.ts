import type { z } from "zod";

export type ModelMessageRole = "user" | "assistant";
export type ModelResponseFormat = "text" | "json_object";

export interface ModelMessage {
  role: ModelMessageRole;
  content: string;
}

export interface ModelGenerateInput {
  task: string;
  system: string;
  messages: ModelMessage[];
  responseFormat?: ModelResponseFormat;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ModelGenerateOutput {
  content: string;
  usage?: ModelUsage;
  raw?: unknown;
}

export interface ModelClient {
  name: string;
  generate(input: ModelGenerateInput): Promise<ModelGenerateOutput>;
}

export interface MockModelResponse {
  content: string;
  usage?: ModelUsage;
  raw?: unknown;
}

export class MockModelClient implements ModelClient {
  readonly name = "mock";
  readonly calls: ModelGenerateInput[] = [];
  private responseIndex = 0;

  constructor(private readonly responses: MockModelResponse[] = []) {}

  async generate(input: ModelGenerateInput): Promise<ModelGenerateOutput> {
    this.calls.push({
      ...input,
      messages: input.messages.map((message) => ({ ...message }))
    });

    const response = this.responses[this.responseIndex] ?? {
      content: "{}"
    };
    this.responseIndex += 1;

    return { ...response };
  }
}

export interface GenerateStructuredObjectInput<T> extends ModelGenerateInput {
  model: ModelClient;
  schema: z.ZodType<T>;
}

export async function generateStructuredObject<T>(
  input: GenerateStructuredObjectInput<T>
): Promise<T> {
  const output = await input.model.generate({
    task: input.task,
    system: input.system,
    messages: input.messages,
    responseFormat: "json_object"
  });
  let parsed: unknown;

  try {
    parsed = JSON.parse(output.content);
  } catch {
    throw new Error(`Model output for ${input.task} was not valid JSON`);
  }

  return input.schema.parse(parsed);
}

export interface OpenAICompatibleModelClientOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
}

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export function createOpenAICompatibleModelClient(
  options: OpenAICompatibleModelClientOptions
): ModelClient {
  const baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;

  return {
    name: "openai-compatible",
    generate: async (input) => {
      const response = await fetchWithTimeout({
        url: `${baseUrl}/chat/completions`,
        timeoutMs,
        fetchImplementation,
        init: {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model: options.model,
            messages: [
              {
                role: "system",
                content: input.system
              },
              ...input.messages
            ],
            ...(input.responseFormat === "json_object"
              ? {
                  response_format: {
                    type: "json_object"
                  }
                }
              : {})
          })
        }
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          `OpenAI-compatible model request failed with status ${response.status}: ${message}`
        );
      }

      const payload = (await response.json()) as OpenAICompatibleResponse;
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("OpenAI-compatible model response did not include content");
      }

      const usage = payload.usage
        ? {
            ...(payload.usage.prompt_tokens !== undefined
              ? { inputTokens: payload.usage.prompt_tokens }
              : {}),
            ...(payload.usage.completion_tokens !== undefined
              ? { outputTokens: payload.usage.completion_tokens }
              : {}),
            ...(payload.usage.total_tokens !== undefined
              ? { totalTokens: payload.usage.total_tokens }
              : {})
          }
        : undefined;

      return {
        content,
        ...(usage ? { usage } : {}),
        raw: payload
      };
    }
  };
}

async function fetchWithTimeout(input: {
  url: string;
  timeoutMs: number;
  fetchImplementation: typeof fetch;
  init: RequestInit;
}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, input.timeoutMs);

  try {
    return await input.fetchImplementation(input.url, {
      ...input.init,
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`OpenAI-compatible model request timed out after ${input.timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export interface ModelProviderEnv {
  RIVALSCOPE_MODEL_PROVIDER?: string;
  OPENAI_COMPATIBLE_API_KEY?: string;
  OPENAI_COMPATIBLE_MODEL?: string;
  OPENAI_COMPATIBLE_BASE_URL?: string;
}

export function createModelClientFromEnv(
  env: ModelProviderEnv,
  fetchImplementation?: typeof fetch
): ModelClient {
  const provider = env.RIVALSCOPE_MODEL_PROVIDER?.trim().toLowerCase() || "mock";

  if (provider === "mock") {
    return new MockModelClient();
  }

  if (provider === "openai-compatible") {
    const apiKey = env.OPENAI_COMPATIBLE_API_KEY?.trim();

    if (!apiKey) {
      throw new Error(
        "OPENAI_COMPATIBLE_API_KEY is required when using openai-compatible models"
      );
    }

    return createOpenAICompatibleModelClient({
      apiKey,
      model: env.OPENAI_COMPATIBLE_MODEL?.trim() || "gpt-4o-mini",
      ...(env.OPENAI_COMPATIBLE_BASE_URL
        ? { baseUrl: env.OPENAI_COMPATIBLE_BASE_URL }
        : {}),
      ...(fetchImplementation ? { fetchImplementation } : {})
    });
  }

  throw new Error(`Unsupported model provider ${provider}`);
}
