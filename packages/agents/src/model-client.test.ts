import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  MockModelClient,
  createModelClientFromEnv,
  createOpenAICompatibleModelClient,
  generateStructuredObject
} from "./model-client";

describe("model client", () => {
  it("returns queued mock responses and records prompts for deterministic tests", async () => {
    const model = new MockModelClient([
      {
        content: JSON.stringify({
          facts: [
            {
              statement: "Cursor has paid plans.",
              sourceChunkIds: ["chunk_1"]
            }
          ]
        })
      }
    ]);

    const result = await model.generate({
      task: "extract_facts",
      system: "Return JSON.",
      messages: [
        {
          role: "user",
          content: "Cursor pricing page"
        }
      ],
      responseFormat: "json_object"
    });

    expect(JSON.parse(result.content)).toEqual({
      facts: [
        {
          statement: "Cursor has paid plans.",
          sourceChunkIds: ["chunk_1"]
        }
      ]
    });
    expect(model.calls).toMatchObject([
      {
        task: "extract_facts",
        responseFormat: "json_object"
      }
    ]);
  });

  it("validates structured JSON outputs with a Zod schema", async () => {
    const model = new MockModelClient([
      {
        content: JSON.stringify({
          claims: [
            {
              claim: "Cursor has paid plans.",
              confidence: 0.82
            }
          ]
        })
      }
    ]);

    const result = await generateStructuredObject({
      model,
      task: "analyze_claims",
      system: "Return JSON only.",
      messages: [{ role: "user", content: "facts" }],
      schema: z.object({
        claims: z.array(
          z.object({
            claim: z.string(),
            confidence: z.number()
          })
        )
      })
    });

    expect(result.claims[0]?.claim).toBe("Cursor has paid plans.");
  });

  it("times out slow OpenAI-compatible requests", async () => {
    const model = createOpenAICompatibleModelClient({
      apiKey: "test-key",
      model: "test-model",
      timeoutMs: 1,
      fetchImplementation: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        })
    });

    await expect(
      model.generate({
        task: "extract_facts",
        system: "Return JSON only.",
        messages: [{ role: "user", content: "source chunks" }],
        responseFormat: "json_object"
      })
    ).rejects.toThrow("timed out");
  });

  it("rejects invalid JSON model output before it becomes an artifact", async () => {
    const model = new MockModelClient([
      {
        content: "not json"
      }
    ]);

    await expect(
      generateStructuredObject({
        model,
        task: "extract_facts",
        system: "Return JSON only.",
        messages: [{ role: "user", content: "source chunks" }],
        schema: z.object({ facts: z.array(z.unknown()) })
      })
    ).rejects.toThrow("Model output for extract_facts was not valid JSON");
  });

  it("creates an OpenAI-compatible request using JSON mode", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const model = createOpenAICompatibleModelClient({
      apiKey: "test-key",
      model: "test-model",
      baseUrl: "https://llm.example/v1",
      fetchImplementation: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ ok: true })
                }
              }
            ],
            usage: {
              prompt_tokens: 12,
              completion_tokens: 5,
              total_tokens: 17
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
    });

    const result = await model.generate({
      task: "extract_facts",
      system: "You are a JSON-only extractor.",
      messages: [{ role: "user", content: "Cursor source" }],
      responseFormat: "json_object"
    });

    expect(result).toEqual({
      content: JSON.stringify({ ok: true }),
      usage: {
        inputTokens: 12,
        outputTokens: 5,
        totalTokens: 17
      },
      raw: expect.any(Object)
    });
    expect(requests[0]?.url).toBe("https://llm.example/v1/chat/completions");
    expect(requests[0]?.init.method).toBe("POST");
    expect(requests[0]?.init.headers).toEqual({
      authorization: "Bearer test-key",
      "content-type": "application/json"
    });
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      model: "test-model",
      messages: [
        {
          role: "system",
          content: "You are a JSON-only extractor."
        },
        {
          role: "user",
          content: "Cursor source"
        }
      ],
      response_format: {
        type: "json_object"
      }
    });
  });

  it("keeps mock as the default provider and requires a key for real providers", () => {
    expect(createModelClientFromEnv({}).name).toBe("mock");
    expect(() =>
      createModelClientFromEnv({
        RIVALSCOPE_MODEL_PROVIDER: "openai-compatible"
      })
    ).toThrow("OPENAI_COMPATIBLE_API_KEY is required");
  });
});
