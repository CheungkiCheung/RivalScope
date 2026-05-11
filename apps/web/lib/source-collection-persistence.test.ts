import { describe, expect, test } from "vitest";
import { persistSourceCollectionRun } from "./source-collection-persistence";

describe("source collection persistence", () => {
  test("persists source collection tool calls through workflow observability records", async () => {
    const calls: unknown[] = [];
    const repositories = {
      workflow: {
        create: async (input: unknown) => {
          calls.push(["createWorkflow", input]);
          return {
            id: "workflow_1",
            nodes: [{ id: "node_1", nodeKey: "collect_sources" }]
          };
        },
        createAgentRun: async (input: unknown) => {
          calls.push(["createAgentRun", input]);
          return { id: "agent_run_1" };
        },
        createToolCalls: async (agentRunId: string, toolCalls: unknown[]) => {
          calls.push(["createToolCalls", agentRunId, toolCalls]);
          return { count: toolCalls.length };
        },
        updateNodeStatuses: async (workflowId: string, nodes: unknown[]) => {
          calls.push(["updateNodeStatuses", workflowId, nodes]);
          return { count: nodes.length };
        }
      }
    };

    await persistSourceCollectionRun({
      projectId: "project_1",
      sourceCount: 2,
      toolCalls: [
        {
          id: "tool_1",
          toolName: "fixture_search",
          status: "succeeded",
          input: { competitor: "Cursor" },
          output: { results: [] },
          startedAt: "2026-01-01T00:00:00.000Z",
          finishedAt: "2026-01-01T00:00:01.000Z"
        },
        {
          id: "tool_2",
          toolName: "fetch_url",
          status: "failed",
          input: { url: "https://example.com" },
          errorMessage: "network failed",
          startedAt: "2026-01-01T00:00:02.000Z",
          finishedAt: "2026-01-01T00:00:03.000Z"
        }
      ],
      repositories
    });

    expect(calls).toEqual([
      [
        "createWorkflow",
        {
          projectId: "project_1",
          nodes: [
            {
              nodeKey: "collect_sources",
              type: "TOOL",
              agentName: "source_collector",
              dependsOn: [],
              status: "PENDING",
              inputArtifactIds: [],
              outputArtifactIds: [],
              retryCount: 0,
              maxRetries: 1
            }
          ]
        }
      ],
      [
        "createAgentRun",
        {
          workflowNodeId: "node_1",
          agentName: "source_collector",
          status: "SUCCEEDED",
          input: {
            projectId: "project_1"
          },
          output: {
            sourceCount: 2,
            toolCallCount: 2
          },
          startedAt: new Date("2026-01-01T00:00:00.000Z"),
          finishedAt: new Date("2026-01-01T00:00:03.000Z")
        }
      ],
      [
        "createToolCalls",
        "agent_run_1",
        [
          {
            toolName: "fixture_search",
            status: "SUCCEEDED",
            input: { competitor: "Cursor" },
            output: { results: [] },
            startedAt: new Date("2026-01-01T00:00:00.000Z"),
            finishedAt: new Date("2026-01-01T00:00:01.000Z")
          },
          {
            toolName: "fetch_url",
            status: "FAILED",
            input: { url: "https://example.com" },
            errorMessage: "network failed",
            startedAt: new Date("2026-01-01T00:00:02.000Z"),
            finishedAt: new Date("2026-01-01T00:00:03.000Z")
          }
        ]
      ],
      [
        "updateNodeStatuses",
        "workflow_1",
        [
          {
            nodeKey: "collect_sources",
            status: "SUCCEEDED",
            inputArtifactIds: [],
            outputArtifactIds: [],
            retryCount: 0,
            currentAgentRunId: "agent_run_1",
            startedAt: new Date("2026-01-01T00:00:00.000Z"),
            finishedAt: new Date("2026-01-01T00:00:03.000Z")
          }
        ]
      ]
    ]);
  });
});
