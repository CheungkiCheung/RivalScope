import type { z } from "zod";
import {
  getModelTraceInput,
  getModelTraceOutput,
  type ModelCallRecord,
  type ModelCallRecordInput,
  type ModelClient,
  type ModelGenerateInput,
  type ModelGenerateOutput
} from "./model-client";

export type AgentRunStatus = "running" | "succeeded" | "failed";
export type ToolCallStatus = "succeeded" | "failed";

export interface AgentRunRecord {
  id: string;
  agentName: string;
  status: AgentRunStatus;
  input: unknown;
  output?: unknown;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  status: ToolCallStatus;
  input: unknown;
  output?: unknown;
  errorMessage?: string;
  startedAt: string;
  finishedAt: string;
}

export interface Tool<I, O> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<I>;
  outputSchema: z.ZodSchema<O>;
  execute(input: I, context: ToolContext): Promise<O>;
}

export interface ToolContext {
  now(): string;
}

export interface AgentContext extends ToolContext {
  callTool<I, O>(tool: Tool<I, O>, input: I): Promise<O>;
  callModel(
    model: ModelClient,
    input: ModelGenerateInput
  ): Promise<ModelGenerateOutput>;
  getToolCalls(): ToolCallRecord[];
  getModelCalls(): ModelCallRecord[];
  recordModelCall(input: ModelCallRecordInput): void;
}

export interface Agent<I, O> {
  name: string;
  role: string;
  inputSchema: z.ZodSchema<I>;
  outputSchema: z.ZodSchema<O>;
  run(input: I, context: AgentContext): Promise<O>;
}

export interface AgentExecutionResult<O> {
  run: AgentRunRecord;
  output: O;
  toolCalls: ToolCallRecord[];
  modelCalls: ModelCallRecord[];
}

export interface RunAgentOptions {
  runId?: string;
}

export interface CreateToolInput<I, O> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<I>;
  outputSchema: z.ZodSchema<O>;
  execute(input: I, context: ToolContext): Promise<O>;
}

export function createTool<I, O>(input: CreateToolInput<I, O>): Tool<I, O> {
  return {
    name: input.name,
    description: input.description,
    inputSchema: input.inputSchema,
    outputSchema: input.outputSchema,
    execute: input.execute
  };
}

export function createAgentRunContext(): AgentContext {
  const toolCalls: ToolCallRecord[] = [];
  const modelCalls: ModelCallRecord[] = [];

  const context: AgentContext = {
    now: () => new Date().toISOString(),
    getToolCalls: () => toolCalls.map((call) => ({ ...call })),
    getModelCalls: () => modelCalls.map((call) => ({ ...call })),
    recordModelCall: (input: ModelCallRecordInput): void => {
      modelCalls.push({
        id: createId("model_call"),
        ...input
      });
    },
    callModel: async (
      model: ModelClient,
      input: ModelGenerateInput
    ): Promise<ModelGenerateOutput> => {
      const startedAt = context.now();

      try {
        const output = await model.generate(input);
        context.recordModelCall({
          provider: model.name,
          ...(model.model ? { model: model.model } : {}),
          task: input.task,
          status: "succeeded",
          ...(input.responseFormat ? { responseFormat: input.responseFormat } : {}),
          input: getModelTraceInput(input),
          output: getModelTraceOutput(output),
          ...(output.usage ? { usage: output.usage } : {}),
          startedAt,
          finishedAt: context.now()
        });

        return output;
      } catch (error) {
        context.recordModelCall({
          provider: model.name,
          ...(model.model ? { model: model.model } : {}),
          task: input.task,
          status: "failed",
          ...(input.responseFormat ? { responseFormat: input.responseFormat } : {}),
          input: getModelTraceInput(input),
          errorMessage: getErrorMessage(error),
          startedAt,
          finishedAt: context.now()
        });

        throw error;
      }
    },
    callTool: async <I, O>(tool: Tool<I, O>, input: I): Promise<O> => {
      const parsedInput = tool.inputSchema.parse(input);
      const startedAt = context.now();

      try {
        const rawOutput = await tool.execute(parsedInput, context);
        const output = tool.outputSchema.parse(rawOutput);
        toolCalls.push({
          id: createId("tool_call"),
          toolName: tool.name,
          status: "succeeded",
          input: parsedInput,
          output,
          startedAt,
          finishedAt: context.now()
        });

        return output;
      } catch (error) {
        toolCalls.push({
          id: createId("tool_call"),
          toolName: tool.name,
          status: "failed",
          input: parsedInput,
          errorMessage: getErrorMessage(error),
          startedAt,
          finishedAt: context.now()
        });

        throw error;
      }
    }
  };

  return context;
}

export async function runAgent<I, O>(
  agent: Agent<I, O>,
  input: I,
  context = createAgentRunContext(),
  options: RunAgentOptions = {}
): Promise<AgentExecutionResult<O>> {
  const parsedInput = agent.inputSchema.parse(input);
  const run: AgentRunRecord = {
    id: options.runId ?? createId("agent_run"),
    agentName: agent.name,
    status: "running",
    input: parsedInput,
    startedAt: context.now()
  };

  try {
    const rawOutput = await agent.run(parsedInput, context);
    const output = agent.outputSchema.parse(rawOutput);
    const finishedRun: AgentRunRecord = {
      ...run,
      status: "succeeded",
      output,
      finishedAt: context.now()
    };

    return {
      run: finishedRun,
      output,
      toolCalls: context.getToolCalls(),
      modelCalls: context.getModelCalls()
    };
  } catch (error) {
    const failedRun: AgentRunRecord = {
      ...run,
      status: "failed",
      errorMessage: getErrorMessage(error),
      finishedAt: context.now()
    };

    throw Object.assign(new Error(failedRun.errorMessage), {
      run: failedRun,
      toolCalls: context.getToolCalls(),
      modelCalls: context.getModelCalls()
    });
  }
}

function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
