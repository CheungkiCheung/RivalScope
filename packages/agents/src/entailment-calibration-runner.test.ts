import { describe, expect, it } from "vitest";
import { goldenEntailmentCases } from "@rivalscope/evals";
import { MockModelClient } from "./model-client";
import { createDeterministicEntailmentJudge } from "./entailment-judge";
import {
  createEntailmentCalibrationCliPayload,
  createRecordedModelEntailmentJudge,
  runEntailmentJudgeCalibrationSuite
} from "./entailment-calibration-runner";

function mockResponse(label: string) {
  return {
    content: JSON.stringify({
      label,
      supportScore: label === "entailed" ? 0.94 : 0.2,
      matchedTokens: label === "entailed" ? ["supported"] : [],
      missingTokens: label === "entailed" ? [] : ["missing"],
      contradictions: label === "contradicted" ? ["conflict"] : [],
      reasons: [`Mock judge returned ${label}.`]
    }),
    usage: {
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120
    }
  };
}

describe("runEntailmentJudgeCalibrationSuite", () => {
  it("summarizes deterministic and model judge calibration with usage, latency, failed cases, and disagreements", async () => {
    let tick = 0;
    const model = new MockModelClient([
      ...goldenEntailmentCases.map((goldenCase) =>
        mockResponse(
          goldenCase.id === goldenEntailmentCases[0]?.id
            ? "unsupported"
            : goldenCase.expectedLabel
        )
      )
    ]);

    const report = await runEntailmentJudgeCalibrationSuite({
      cases: goldenEntailmentCases,
      judges: [
        createDeterministicEntailmentJudge(),
        createRecordedModelEntailmentJudge({ model })
      ],
      now: () => {
        tick += 50;
        return tick;
      }
    });

    expect(report).toMatchObject({
      totalCases: goldenEntailmentCases.length,
      modelJudgeEnabled: true,
      judges: [
        {
          name: "deterministic",
          passedCases: goldenEntailmentCases.length,
          failedCases: 0,
          accuracy: 1,
          latencyMs: expect.any(Number),
          modelCalls: 0,
          usage: {
            totalTokens: 0
          },
          failedCaseDetails: []
        },
        {
          name: "model",
          passedCases: goldenEntailmentCases.length - 1,
          failedCases: 1,
          modelCalls: goldenEntailmentCases.length,
          usage: {
            inputTokens: goldenEntailmentCases.length * 100,
            outputTokens: goldenEntailmentCases.length * 20,
            totalTokens: goldenEntailmentCases.length * 120
          }
        }
      ]
    });
    expect(report.judges[1]?.failedCaseDetails).toEqual([
      {
        caseId: goldenEntailmentCases[0]?.id,
        expectedLabel: goldenEntailmentCases[0]?.expectedLabel,
        actualLabel: "unsupported",
        dimension: goldenEntailmentCases[0]?.dimension,
        riskType: goldenEntailmentCases[0]?.riskType
      }
    ]);
    expect(report.disagreements).toContainEqual({
      caseId: goldenEntailmentCases[0]?.id,
      expectedLabel: goldenEntailmentCases[0]?.expectedLabel,
      labels: {
        deterministic: goldenEntailmentCases[0]?.expectedLabel,
        model: "unsupported"
      }
    });
  });

  it("creates a CLI payload that can skip model judge calibration without external credentials", async () => {
    const payload = await createEntailmentCalibrationCliPayload({
      env: {},
      now: () => 1
    });

    expect(payload.modelJudgeEnabled).toBe(false);
    expect(payload.judges.map((judge) => judge.name)).toEqual(["deterministic"]);
    expect(payload.exitCode).toBe(0);
  });

  it("does not double count model records when a recorded judge is reused", async () => {
    const model = new MockModelClient([
      mockResponse("entailed"),
      mockResponse("entailed")
    ]);
    const judge = createRecordedModelEntailmentJudge({ model });
    const oneCase = goldenEntailmentCases.filter(
      (goldenCase) => goldenCase.expectedLabel === "entailed"
    ).slice(0, 1);

    const firstReport = await runEntailmentJudgeCalibrationSuite({
      cases: oneCase,
      judges: [judge]
    });
    const secondReport = await runEntailmentJudgeCalibrationSuite({
      cases: oneCase,
      judges: [judge]
    });

    expect(firstReport.judges[0]?.modelCalls).toBe(1);
    expect(secondReport.judges[0]?.modelCalls).toBe(1);
    expect(secondReport.judges[0]?.usage.totalTokens).toBe(120);
  });
});
