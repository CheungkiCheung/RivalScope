import { goldenEntailmentCases } from "@rivalscope/evals";
import type {
  EntailmentCalibrationBucketSummary,
  EntailmentLabel,
  EntailmentRiskType,
  GoldenEntailmentCase
} from "@rivalscope/evals";
import {
  createDeterministicEntailmentJudge,
  createModelEntailmentJudge,
  type EntailmentJudge
} from "./entailment-judge";
import {
  createModelClientFromEnv,
  type ModelCallRecordInput,
  type ModelClient,
  type ModelProviderEnv,
  type ModelUsage
} from "./model-client";

export interface EntailmentJudgeCalibrationRunnerInput {
  cases: GoldenEntailmentCase[];
  judges: CalibrationEntailmentJudge[];
  now?: () => number;
}

export interface CalibrationEntailmentJudge extends EntailmentJudge {
  getModelRecords?: () => ModelCallRecordInput[];
  clearModelRecords?: () => void;
}

export interface EntailmentJudgeFailedCaseDetail {
  caseId: string;
  expectedLabel: EntailmentLabel;
  actualLabel: EntailmentLabel;
  dimension: string;
  riskType: EntailmentRiskType;
}

export interface EntailmentJudgeCalibrationRunnerReport {
  generatedAt: string;
  totalCases: number;
  modelJudgeEnabled: boolean;
  judges: Array<{
    name: string;
    passedCases: number;
    failedCases: number;
    accuracy: number | null;
    labelCounts: Record<EntailmentLabel, number>;
    byLabel: Record<EntailmentLabel, EntailmentCalibrationBucketSummary>;
    byDimension: Record<string, EntailmentCalibrationBucketSummary>;
    byRiskType: Record<EntailmentRiskType, EntailmentCalibrationBucketSummary>;
    latencyMs: number;
    modelCalls: number;
    usage: Required<ModelUsage>;
    failedCaseDetails: EntailmentJudgeFailedCaseDetail[];
  }>;
  disagreements: Array<{
    caseId: string;
    expectedLabel: EntailmentLabel;
    labels: Record<string, EntailmentLabel>;
  }>;
}

export interface EntailmentCalibrationCliInput {
  env: ModelProviderEnv & {
    RIVALSCOPE_ENABLE_MODEL_ENTAILMENT_JUDGE?: string;
  };
  now?: () => number;
  model?: ModelClient;
}

export interface EntailmentCalibrationCliPayload
  extends EntailmentJudgeCalibrationRunnerReport {
  exitCode: number;
}

export interface RecordedModelEntailmentJudgeInput {
  model: ModelClient;
}

interface TimedJudgeResult {
  name: string;
  caseResults: Array<{
    caseId: string;
    expectedLabel: EntailmentLabel;
    actualLabel: EntailmentLabel;
    dimension: string;
    riskType: EntailmentRiskType;
  }>;
  latencyMs: number;
  modelCalls: number;
  usage: Required<ModelUsage>;
}

export async function runEntailmentJudgeCalibrationSuite(
  input: EntailmentJudgeCalibrationRunnerInput
): Promise<EntailmentJudgeCalibrationRunnerReport> {
  const now = input.now ?? (() => Date.now());
  const timedResults = await Promise.all(
    input.judges.map(async (judge) => {
      judge.clearModelRecords?.();
      const startedAt = now();
      const caseResults = await Promise.all(
        input.cases.map(async (goldenCase) => {
          const result = await judge.evaluate(goldenCase);

          return {
            caseId: goldenCase.id,
            expectedLabel: goldenCase.expectedLabel,
            actualLabel: result.label,
            dimension: goldenCase.dimension,
            riskType: goldenCase.riskType
          };
        })
      );
      const finishedAt = now();

      return {
        name: judge.name,
        caseResults,
        latencyMs: Math.max(0, finishedAt - startedAt),
        modelCalls: judge.getModelRecords?.().length ?? 0,
        usage: sumUsage(judge.getModelRecords?.().map((record) => record.usage) ?? [])
      } satisfies TimedJudgeResult;
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    totalCases: input.cases.length,
    modelJudgeEnabled: input.judges.some((judge) => judge.name !== "deterministic"),
    judges: timedResults.map(summarizeTimedJudgeResult),
    disagreements: buildDisagreements({
      cases: input.cases,
      timedResults
    })
  };
}

export async function createEntailmentCalibrationCliPayload(
  input: EntailmentCalibrationCliInput
): Promise<EntailmentCalibrationCliPayload> {
  const judges: CalibrationEntailmentJudge[] = [createDeterministicEntailmentJudge()];
  const modelJudgeEnabled =
    input.env.RIVALSCOPE_ENABLE_MODEL_ENTAILMENT_JUDGE === "true";

  if (modelJudgeEnabled) {
    const model = input.model ?? createModelClientFromEnv(input.env);
    judges.push(createRecordedModelEntailmentJudge({ model }));
  }

  const report = await runEntailmentJudgeCalibrationSuite({
    cases: goldenEntailmentCases,
    judges,
    ...(input.now ? { now: input.now } : {})
  });

  return {
    ...report,
    modelJudgeEnabled,
    exitCode: report.judges.some((judge) => judge.failedCases > 0) ? 1 : 0
  };
}

export function createRecordedModelEntailmentJudge(
  input: RecordedModelEntailmentJudgeInput
): CalibrationEntailmentJudge {
  const recorder = new CalibrationModelCallRecorder();
  const judge = createModelEntailmentJudge({
    model: input.model,
    recorder
  });

  return {
    ...judge,
    getModelRecords: () => recorder.records,
    clearModelRecords: () => recorder.clear()
  };
}

class CalibrationModelCallRecorder {
  private recordList: ModelCallRecordInput[] = [];

  get records(): ModelCallRecordInput[] {
    return this.recordList.map((record) => ({ ...record }));
  }

  now(): string {
    return new Date().toISOString();
  }

  recordModelCall(input: ModelCallRecordInput): void {
    this.recordList = [...this.recordList, { ...input }];
  }

  clear(): void {
    this.recordList = [];
  }
}

function summarizeTimedJudgeResult(result: TimedJudgeResult) {
  const passedCases = result.caseResults.filter(
    (caseResult) => caseResult.actualLabel === caseResult.expectedLabel
  ).length;

  return {
    name: result.name,
    passedCases,
    failedCases: result.caseResults.length - passedCases,
    accuracy:
      result.caseResults.length === 0 ? null : passedCases / result.caseResults.length,
    labelCounts: countLabels(result.caseResults.map((caseResult) => caseResult.actualLabel)),
    byLabel: {
      entailed: summarizeBucket(
        result.caseResults.filter(
          (caseResult) => caseResult.expectedLabel === "entailed"
        )
      ),
      partial: summarizeBucket(
        result.caseResults.filter((caseResult) => caseResult.expectedLabel === "partial")
      ),
      unsupported: summarizeBucket(
        result.caseResults.filter(
          (caseResult) => caseResult.expectedLabel === "unsupported"
        )
      ),
      contradicted: summarizeBucket(
        result.caseResults.filter(
          (caseResult) => caseResult.expectedLabel === "contradicted"
        )
      )
    },
    byDimension: summarizeByKey(result.caseResults, (caseResult) => caseResult.dimension),
    byRiskType: {
      direct_support: summarizeBucket(
        result.caseResults.filter(
          (caseResult) => caseResult.riskType === "direct_support"
        )
      ),
      partial_support: summarizeBucket(
        result.caseResults.filter(
          (caseResult) => caseResult.riskType === "partial_support"
        )
      ),
      overstrong_claim: summarizeBucket(
        result.caseResults.filter(
          (caseResult) => caseResult.riskType === "overstrong_claim"
        )
      ),
      contradiction: summarizeBucket(
        result.caseResults.filter(
          (caseResult) => caseResult.riskType === "contradiction"
        )
      )
    },
    latencyMs: result.latencyMs,
    modelCalls: result.modelCalls,
    usage: result.usage,
    failedCaseDetails: result.caseResults
      .filter((caseResult) => caseResult.actualLabel !== caseResult.expectedLabel)
      .map((caseResult) => ({
        caseId: caseResult.caseId,
        expectedLabel: caseResult.expectedLabel,
        actualLabel: caseResult.actualLabel,
        dimension: caseResult.dimension,
        riskType: caseResult.riskType
      }))
  };
}

function buildDisagreements(input: {
  cases: GoldenEntailmentCase[];
  timedResults: TimedJudgeResult[];
}): EntailmentJudgeCalibrationRunnerReport["disagreements"] {
  return input.cases.flatMap((goldenCase) => {
    const labels = Object.fromEntries(
      input.timedResults.map((result) => [
        result.name,
        result.caseResults.find((caseResult) => caseResult.caseId === goldenCase.id)
          ?.actualLabel
      ])
    ) as Record<string, EntailmentLabel>;

    if (new Set(Object.values(labels)).size <= 1) {
      return [];
    }

    return [
      {
        caseId: goldenCase.id,
        expectedLabel: goldenCase.expectedLabel,
        labels
      }
    ];
  });
}

function summarizeByKey<T extends { actualLabel: EntailmentLabel; expectedLabel: EntailmentLabel }>(
  results: T[],
  getKey: (result: T) => string
): Record<string, EntailmentCalibrationBucketSummary> {
  const keys = [...new Set(results.map(getKey))];

  return Object.fromEntries(
    keys.map((key) => [
      key,
      summarizeBucket(results.filter((result) => getKey(result) === key))
    ])
  );
}

function summarizeBucket<T extends { actualLabel: EntailmentLabel; expectedLabel: EntailmentLabel }>(
  results: T[]
): EntailmentCalibrationBucketSummary {
  const passedCases = results.filter(
    (result) => result.actualLabel === result.expectedLabel
  ).length;

  return {
    totalCases: results.length,
    passedCases,
    failedCases: results.length - passedCases,
    accuracy: results.length === 0 ? null : passedCases / results.length
  };
}

function countLabels(labels: EntailmentLabel[]): Record<EntailmentLabel, number> {
  return {
    entailed: labels.filter((label) => label === "entailed").length,
    partial: labels.filter((label) => label === "partial").length,
    unsupported: labels.filter((label) => label === "unsupported").length,
    contradicted: labels.filter((label) => label === "contradicted").length
  };
}

function sumUsage(usages: Array<ModelUsage | undefined>): Required<ModelUsage> {
  const zeroUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  } satisfies Required<ModelUsage>;

  return usages.reduce<Required<ModelUsage>>(
    (acc, usage) => ({
      inputTokens: acc.inputTokens + (usage?.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (usage?.outputTokens ?? 0),
      totalTokens: acc.totalTokens + (usage?.totalTokens ?? 0)
    }),
    zeroUsage
  );
}
