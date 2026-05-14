import type { Claim, Fact, SourceChunk } from "@rivalscope/core";
import type {
  ClaimEntailmentResult,
  EntailmentBenchmarkCase,
  EntailmentLabel,
  EvaluateClaimEntailmentInput
} from "@rivalscope/evals";
import { evaluateClaimEntailment } from "@rivalscope/evals";
import { z } from "zod";
import {
  generateStructuredObject,
  type ModelCallRecorder,
  type ModelClient
} from "./model-client";

export interface EntailmentJudge {
  name: string;
  evaluate(input: EvaluateClaimEntailmentInput): Promise<ClaimEntailmentResult>;
}

export interface EntailmentJudgeComparisonInput {
  cases: EntailmentBenchmarkCase[];
  judges: EntailmentJudge[];
}

export interface EntailmentJudgeComparisonSummary {
  totalCases: number;
  judges: Array<{
    name: string;
    passedCases: number;
    failedCases: number;
    accuracy: number;
    labelCounts: Record<EntailmentLabel, number>;
  }>;
  disagreements: Array<{
    caseId: string;
    labels: Record<string, EntailmentLabel>;
  }>;
  caseLabels: Array<{
    caseId: string;
    labels: Record<string, EntailmentLabel>;
  }>;
}

export interface ModelEntailmentJudgeOptions {
  model: ModelClient;
  recorder?: ModelCallRecorder;
}

const modelEntailmentSchema = z.object({
  label: z.enum(["entailed", "partial", "unsupported", "contradicted"]),
  supportScore: z.number().min(0).max(1),
  matchedTokens: z.array(z.string()),
  missingTokens: z.array(z.string()),
  contradictions: z.array(z.string()),
  reasons: z.array(z.string().min(1)).min(1)
});

export function createModelEntailmentJudge(
  options: ModelEntailmentJudgeOptions
): EntailmentJudge {
  return {
    name: "model",
    evaluate: async (input) =>
      generateStructuredObject({
        model: options.model,
        ...(options.recorder ? { recorder: options.recorder } : {}),
        task: "entailment_judge",
        system: [
          "You are an evidence entailment judge for competitive intelligence.",
          "Return JSON only.",
          "Classify whether the cited evidence entails the claim.",
          "Use labels exactly: entailed, partial, unsupported, contradicted.",
          "Do not reward over-strong claims unless evidence explicitly supports every important qualifier."
        ].join(" "),
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              claim: toTraceClaim(input.claim),
              facts: input.facts.map(toTraceFact),
              chunks: input.chunks.map(toTraceChunk)
            })
          }
        ],
        schema: modelEntailmentSchema,
        transform: (output) => ({
          claimId: input.claim.id,
          label: output.label,
          supportScore: output.supportScore,
          matchedTokens: output.matchedTokens,
          missingTokens: output.missingTokens,
          contradictions: output.contradictions,
          reasons: output.reasons
        })
      })
  };
}

export function createDeterministicEntailmentJudge(): EntailmentJudge {
  return {
    name: "deterministic",
    evaluate: async (input) => evaluateClaimEntailment(input)
  };
}

export async function compareEntailmentJudges(
  input: EntailmentJudgeComparisonInput
): Promise<EntailmentJudgeComparisonSummary> {
  const resultsByJudge = await Promise.all(
    input.judges.map(async (judge) => {
      const results = await Promise.all(
        input.cases.map(async (benchmarkCase) => ({
          caseId: benchmarkCase.id,
          expectedLabel: benchmarkCase.expectedLabel,
          result: await judge.evaluate(benchmarkCase)
        }))
      );
      const passedCases = results.filter(
        (result) => result.result.label === result.expectedLabel
      ).length;

      return {
        judge,
        results,
        summary: {
          name: judge.name,
          passedCases,
          failedCases: results.length - passedCases,
          accuracy: results.length === 0 ? 1 : passedCases / results.length,
          labelCounts: countLabels(results.map((result) => result.result.label))
        }
      };
    })
  );

  return {
    totalCases: input.cases.length,
    judges: resultsByJudge.map((entry) => entry.summary),
    caseLabels: input.cases.map((benchmarkCase) => ({
      caseId: benchmarkCase.id,
      labels: buildLabelsForCase({
        caseId: benchmarkCase.id,
        resultsByJudge
      })
    })),
    disagreements: input.cases.flatMap((benchmarkCase) => {
      const labels = Object.fromEntries(
        resultsByJudge.map((entry) => [
          entry.judge.name,
          entry.results.find((result) => result.caseId === benchmarkCase.id)?.result
            .label
        ])
      ) as Record<string, EntailmentLabel>;
      const uniqueLabels = new Set(Object.values(labels));

      if (uniqueLabels.size <= 1) {
        return [];
      }

      return [
        {
          caseId: benchmarkCase.id,
          labels
        }
      ];
    })
  };
}

function buildLabelsForCase(input: {
  caseId: string;
  resultsByJudge: Array<{
    judge: EntailmentJudge;
    results: Array<{
      caseId: string;
      expectedLabel: EntailmentLabel;
      result: ClaimEntailmentResult;
    }>;
  }>;
}): Record<string, EntailmentLabel> {
  return Object.fromEntries(
    input.resultsByJudge.map((entry) => [
      entry.judge.name,
      entry.results.find((result) => result.caseId === input.caseId)?.result.label
    ])
  ) as Record<string, EntailmentLabel>;
}

function countLabels(labels: EntailmentLabel[]): Record<EntailmentLabel, number> {
  return {
    entailed: labels.filter((label) => label === "entailed").length,
    partial: labels.filter((label) => label === "partial").length,
    unsupported: labels.filter((label) => label === "unsupported").length,
    contradicted: labels.filter((label) => label === "contradicted").length
  };
}

function toTraceClaim(claim: Claim) {
  return {
    id: claim.id,
    dimension: claim.dimension,
    statement: claim.statement,
    factIds: claim.factIds,
    confidence: claim.confidence,
    kind: claim.kind
  };
}

function toTraceFact(fact: Fact) {
  return {
    id: fact.id,
    dimension: fact.dimension,
    statement: fact.statement,
    sourceChunkIds: fact.sourceChunkIds,
    confidence: fact.confidence
  };
}

function toTraceChunk(chunk: SourceChunk) {
  return {
    id: chunk.id,
    sourceId: chunk.sourceId,
    ordinal: chunk.ordinal,
    text: chunk.text
  };
}
