import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createAgentRunContext,
  createTool,
  runAgent,
  type Agent
} from "./agent";

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
