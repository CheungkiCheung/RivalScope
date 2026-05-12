import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createAgentRunContext,
  createTool,
  runAgent,
  type Agent
} from "./agent";
import { MockModelClient } from "./model-client";

const inputSchema = z.object({ topic: z.string() });
const outputSchema = z.object({ summary: z.string() });

describe("agent execution", () => {
  it("validates agent input and output schemas", async () => {
    const agent: Agent<
      z.infer<typeof inputSchema>,
      z.infer<typeof outputSchema>
    > = {
      name: "writer",
      role: "Writes a concise summary.",
      inputSchema,
      outputSchema,
      run: async (input) => ({ summary: `Report about ${input.topic}` })
    };

    const result = await runAgent(agent, { topic: "AI coding tools" });

    expect(result.output.summary).toBe("Report about AI coding tools");
    expect(result.run.agentName).toBe("writer");
    expect(result.run.status).toBe("succeeded");
  });

  it("records tool calls through the agent context", async () => {
    const uppercaseTool = createTool({
      name: "uppercase",
      description: "Uppercase a string.",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async (input) => ({ value: input.value.toUpperCase() })
    });

    const agent: Agent<
      z.infer<typeof inputSchema>,
      z.infer<typeof outputSchema>
    > = {
      name: "tool-user",
      role: "Uses a tool.",
      inputSchema,
      outputSchema,
      run: async (input, context) => {
        const output = await context.callTool(uppercaseTool, {
          value: input.topic
        });
        return { summary: output.value };
      }
    };

    const context = createAgentRunContext();
    const result = await runAgent(agent, { topic: "cursor" }, context);

    expect(result.output.summary).toBe("CURSOR");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.toolName).toBe("uppercase");
    expect(result.toolCalls[0]?.status).toBe("succeeded");
  });

  it("records model calls through the agent context", async () => {
    const model = new MockModelClient([
      {
        content: "model summary",
        usage: {
          inputTokens: 4,
          outputTokens: 2,
          totalTokens: 6
        }
      }
    ]);
    const agent: Agent<
      z.infer<typeof inputSchema>,
      z.infer<typeof outputSchema>
    > = {
      name: "model-user",
      role: "Uses a model.",
      inputSchema,
      outputSchema,
      run: async (input, context) => {
        const output = await context.callModel(model, {
          task: "summarize_topic",
          system: "Summarize the topic.",
          messages: [{ role: "user", content: input.topic }],
          responseFormat: "text"
        });

        return { summary: output.content };
      }
    };

    const result = await runAgent(agent, { topic: "Cursor" });

    expect(result.output.summary).toBe("model summary");
    expect(result.modelCalls).toHaveLength(1);
    expect(result.modelCalls[0]).toMatchObject({
      provider: "mock",
      task: "summarize_topic",
      status: "succeeded",
      responseFormat: "text",
      input: {
        system: "Summarize the topic.",
        messages: [{ role: "user", content: "Cursor" }]
      },
      output: {
        content: "model summary"
      },
      usage: {
        inputTokens: 4,
        outputTokens: 2,
        totalTokens: 6
      }
    });
  });

  it("preserves failed model calls when the agent fails", async () => {
    const model = {
      name: "broken-provider",
      generate: async () => {
        throw new Error("provider unavailable");
      }
    };
    const agent: Agent<
      z.infer<typeof inputSchema>,
      z.infer<typeof outputSchema>
    > = {
      name: "model-user",
      role: "Uses a model.",
      inputSchema,
      outputSchema,
      run: async (input, context) => {
        await context.callModel(model, {
          task: "summarize_topic",
          system: "Summarize the topic.",
          messages: [{ role: "user", content: input.topic }],
          responseFormat: "text"
        });

        return { summary: "unreachable" };
      }
    };

    await expect(runAgent(agent, { topic: "Cursor" })).rejects.toMatchObject({
      modelCalls: [
        expect.objectContaining({
          provider: "broken-provider",
          task: "summarize_topic",
          status: "failed",
          errorMessage: "provider unavailable"
        })
      ]
    });
  });

  it("fails when an agent returns output that does not match its schema", async () => {
    const agent: Agent<
      z.infer<typeof inputSchema>,
      z.infer<typeof outputSchema>
    > = {
      name: "bad-agent",
      role: "Returns invalid data.",
      inputSchema,
      outputSchema,
      run: async () => ({ nope: true } as never)
    };

    await expect(runAgent(agent, { topic: "x" })).rejects.toThrow();
  });
});
