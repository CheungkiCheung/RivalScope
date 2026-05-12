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
  model?: string;
  generate(input: ModelGenerateInput): Promise<ModelGenerateOutput>;
}

export type ModelCallStatus = "succeeded" | "failed";

export interface ModelCallRecord {
  id: string;
  provider: string;
  model?: string;
  task: string;
  status: ModelCallStatus;
  responseFormat?: ModelResponseFormat;
  input: unknown;
  output?: unknown;
  usage?: ModelUsage;
  errorMessage?: string;
  startedAt: string;
  finishedAt: string;
}

export interface ModelCallRecordInput {
  provider: string;
  model?: string;
  task: string;
  status: ModelCallStatus;
  responseFormat?: ModelResponseFormat;
  input: unknown;
  output?: unknown;
  usage?: ModelUsage;
  errorMessage?: string;
  startedAt: string;
  finishedAt: string;
}

export interface ModelCallRecorder {
  now(): string;
  recordModelCall(input: ModelCallRecordInput): void;
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

export interface GenerateStructuredObjectInput<T, R = T> extends ModelGenerateInput {
  model: ModelClient;
  schema: z.ZodType<T>;
  recorder?: ModelCallRecorder;
  transform?: (output: T) => R;
}

export async function generateStructuredObject<T, R = T>(
  input: GenerateStructuredObjectInput<T, R>
): Promise<R> {
  const generateInput = {
    task: input.task,
    system: input.system,
    messages: input.messages,
    responseFormat: "json_object"
  } satisfies ModelGenerateInput;
  const startedAt = input.recorder?.now();
  let output: ModelGenerateOutput | undefined;
  let parsed: unknown;

  try {
    output = await input.model.generate(generateInput);
    parsed = JSON.parse(output.content);
  } catch (error) {
    const normalized =
      error instanceof SyntaxError
        ? new Error(`Model output for ${input.task} was not valid JSON`)
        : error;

    if (input.recorder && startedAt) {
      input.recorder.recordModelCall({
        provider: input.model.name,
        ...(input.model.model ? { model: input.model.model } : {}),
        task: input.task,
        status: "failed",
        responseFormat: "json_object",
        input: getModelTraceInput(generateInput),
        ...(output ? { output: getModelTraceOutput(output) } : {}),
        ...(output?.usage ? { usage: output.usage } : {}),
        errorMessage: getErrorMessage(normalized),
        startedAt,
        finishedAt: input.recorder.now()
      });
    }

    throw normalized;
  }

  try {
    const validated = input.schema.parse(parsed);
    const result = input.transform
      ? input.transform(validated)
      : (validated as unknown as R);

    if (input.recorder && startedAt && output) {
      input.recorder.recordModelCall({
        provider: input.model.name,
        ...(input.model.model ? { model: input.model.model } : {}),
        task: input.task,
        status: "succeeded",
        responseFormat: "json_object",
        input: getModelTraceInput(generateInput),
        output: getModelTraceOutput(output),
        ...(output.usage ? { usage: output.usage } : {}),
        startedAt,
        finishedAt: input.recorder.now()
      });
    }

    return result;
  } catch (error) {
    if (input.recorder && startedAt && output) {
      input.recorder.recordModelCall({
        provider: input.model.name,
        ...(input.model.model ? { model: input.model.model } : {}),
        task: input.task,
        status: "failed",
        responseFormat: "json_object",
        input: getModelTraceInput(generateInput),
        output: getModelTraceOutput(output),
        ...(output.usage ? { usage: output.usage } : {}),
        errorMessage: getErrorMessage(error),
        startedAt,
        finishedAt: input.recorder.now()
      });
    }

    throw error;
  }
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
    model: options.model,
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
        const message = sanitizeProviderErrorBody(await response.text());
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

export function getModelTraceInput(input: ModelGenerateInput) {
  return {
    system: truncateTraceString(input.system),
    messages: input.messages.map((message) => ({
      role: message.role,
      content: truncateTraceString(message.content)
    })),
    ...(input.responseFormat ? { responseFormat: input.responseFormat } : {})
  };
}

export function getModelTraceOutput(output: ModelGenerateOutput) {
  return {
    content: truncateTraceString(output.content)
  };
}

const maxTraceStringLength = 1_000;

function truncateTraceString(value: string): string {
  if (value.length <= maxTraceStringLength) {
    return value;
  }

  return `${value.slice(0, maxTraceStringLength)} [truncated ${
    value.length - maxTraceStringLength
  } chars]`;
}

function sanitizeProviderErrorBody(body: string): string {
  const singleLine = body.replace(/\s+/g, " ").trim();

  if (!singleLine) {
    return "empty response body";
  }

  return singleLine.slice(0, 500);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
