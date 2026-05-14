import type { Claim, Fact, SourceChunk } from "@rivalscope/core";

export type EntailmentLabel =
  | "entailed"
  | "partial"
  | "unsupported"
  | "contradicted";

export interface ClaimEntailmentResult {
  claimId: string;
  label: EntailmentLabel;
  supportScore: number;
  matchedTokens: string[];
  missingTokens: string[];
  contradictions: string[];
  reasons: string[];
}

export interface EvaluateClaimEntailmentInput {
  claim: Claim;
  facts: Fact[];
  chunks: SourceChunk[];
}

export interface EntailmentBenchmarkCase
  extends EvaluateClaimEntailmentInput {
  id: string;
  expectedLabel: EntailmentLabel;
}

export interface EntailmentBenchmarkCaseResult {
  id: string;
  expectedLabel: EntailmentLabel;
  actualLabel: EntailmentLabel;
  passed: boolean;
  result: ClaimEntailmentResult;
}

export interface EntailmentBenchmarkSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  accuracy: number;
  labelCounts: Record<EntailmentLabel, number>;
  results: EntailmentBenchmarkCaseResult[];
}

export function evaluateClaimEntailment(
  input: EvaluateClaimEntailmentInput
): ClaimEntailmentResult {
  const claimTokens = tokenize(input.claim.statement);
  const evidenceText = [
    ...input.facts.map((fact) => fact.statement),
    ...input.chunks.map((chunk) => chunk.text)
  ].join(" ");
  const evidenceTokens = new Set(tokenize(evidenceText));
  const matchedTokens = claimTokens.filter((token) => evidenceTokens.has(token));
  const missingTokens = claimTokens.filter((token) => !evidenceTokens.has(token));
  const supportScore =
    claimTokens.length === 0 ? 1 : matchedTokens.length / claimTokens.length;
  const contradictions = findContradictions(input.claim.statement, evidenceText);
  const label =
    contradictions.length > 0
      ? "contradicted"
      : supportScore >= 0.75
        ? "entailed"
        : supportScore >= 0.4
          ? "partial"
          : "unsupported";

  return {
    claimId: input.claim.id,
    label,
    supportScore,
    matchedTokens,
    missingTokens,
    contradictions,
    reasons: buildEntailmentReasons({ label, supportScore, contradictions })
  };
}

export function runEntailmentBenchmark(
  cases: EntailmentBenchmarkCase[]
): EntailmentBenchmarkSummary {
  const results = cases.map((benchmarkCase) => {
    const result = evaluateClaimEntailment(benchmarkCase);

    return {
      id: benchmarkCase.id,
      expectedLabel: benchmarkCase.expectedLabel,
      actualLabel: result.label,
      passed: result.label === benchmarkCase.expectedLabel,
      result
    };
  });
  const passedCases = results.filter((result) => result.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    failedCases: results.length - passedCases,
    accuracy: results.length === 0 ? 1 : passedCases / results.length,
    labelCounts: countLabels(results.map((result) => result.actualLabel)),
    results
  };
}

function buildEntailmentReasons(input: {
  label: EntailmentLabel;
  supportScore: number;
  contradictions: string[];
}): string[] {
  const reasons = [
    `Entailment label is ${input.label}.`,
    `Evidence token support is ${Math.round(input.supportScore * 100)}%.`
  ];

  if (input.contradictions.length > 0) {
    return [
      ...reasons,
      ...input.contradictions.map(
        (contradiction) => `Contradiction detected: ${contradiction}.`
      )
    ];
  }

  if (input.label === "entailed") {
    return [...reasons, "Evidence covers most claim tokens."];
  }

  if (input.label === "partial") {
    return [...reasons, "Evidence partially covers the claim."];
  }

  return [...reasons, "Evidence does not cover enough claim tokens."];
}

function findContradictions(claim: string, evidence: string): string[] {
  const normalizedClaim = normalizeText(claim);
  const normalizedEvidence = normalizeText(evidence);
  const contradictions: string[] = [];

  for (const pair of CONTRADICTION_PAIRS) {
    if (
      normalizedClaim.includes(pair.claimPhrase) &&
      normalizedEvidence.includes(pair.evidencePhrase)
    ) {
      contradictions.push(`${pair.claimPhrase} vs ${pair.evidencePhrase}`);
    }
  }

  return contradictions;
}

function countLabels(labels: EntailmentLabel[]): Record<EntailmentLabel, number> {
  return {
    entailed: labels.filter((label) => label === "entailed").length,
    partial: labels.filter((label) => label === "partial").length,
    unsupported: labels.filter((label) => label === "unsupported").length,
    contradicted: labels.filter((label) => label === "contradicted").length
  };
}

function tokenize(value: string): string[] {
  return unique(
    normalizeText(value)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .filter((token) => !STOP_WORDS.has(token))
  );
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

const CONTRADICTION_PAIRS = [
  {
    claimPhrase: "offers refunds",
    evidencePhrase: "does not offer refunds"
  },
  {
    claimPhrase: "free plan",
    evidencePhrase: "paid plan"
  },
  {
    claimPhrase: "supports",
    evidencePhrase: "does not support"
  }
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "its",
  "into",
  "every",
  "buyer",
  "buyers",
  "claim",
  "signal"
]);
