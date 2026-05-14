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

export type EntailmentRiskType =
  | "direct_support"
  | "partial_support"
  | "overstrong_claim"
  | "contradiction";

export interface GoldenEntailmentCase extends EntailmentBenchmarkCase {
  name: string;
  dimension: string;
  riskType: EntailmentRiskType;
}

export interface EntailmentBenchmarkCaseResult {
  id: string;
  expectedLabel: EntailmentLabel;
  actualLabel: EntailmentLabel;
  passed: boolean;
  result: ClaimEntailmentResult;
}

export interface EntailmentCalibrationCaseResult
  extends EntailmentBenchmarkCaseResult {
  dimension: string;
  riskType: EntailmentRiskType;
}

export interface EntailmentBenchmarkSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  accuracy: number;
  labelCounts: Record<EntailmentLabel, number>;
  results: EntailmentBenchmarkCaseResult[];
}

export interface EntailmentCalibrationBucketSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  accuracy: number | null;
}

export interface EntailmentCalibrationSummary
  extends Omit<EntailmentBenchmarkSummary, "results"> {
  byLabel: Record<EntailmentLabel, EntailmentCalibrationBucketSummary>;
  byDimension: Record<string, EntailmentCalibrationBucketSummary>;
  byRiskType: Record<EntailmentRiskType, EntailmentCalibrationBucketSummary>;
  results: EntailmentCalibrationCaseResult[];
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
  const unsupportedOverstrongQualifiers = findUnsupportedOverstrongQualifiers(
    missingTokens
  );
  const label =
    contradictions.length > 0
      ? "contradicted"
      : unsupportedOverstrongQualifiers.length > 0
        ? "unsupported"
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
    reasons: buildEntailmentReasons({
      label,
      supportScore,
      contradictions,
      unsupportedOverstrongQualifiers
    })
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

export function runEntailmentCalibration(
  cases: GoldenEntailmentCase[]
): EntailmentCalibrationSummary {
  const benchmark = runEntailmentBenchmark(cases);
  const resultMetadata = new Map(
    cases.map((goldenCase) => [
      goldenCase.id,
      {
        dimension: goldenCase.dimension,
        riskType: goldenCase.riskType
      }
    ])
  );
  const results = benchmark.results.map((result) => {
    const metadata = resultMetadata.get(result.id);

    if (!metadata) {
      throw new Error(`Missing calibration metadata for ${result.id}`);
    }

    return {
      ...result,
      dimension: metadata.dimension,
      riskType: metadata.riskType
    };
  });

  return {
    totalCases: benchmark.totalCases,
    passedCases: benchmark.passedCases,
    failedCases: benchmark.failedCases,
    accuracy: benchmark.accuracy,
    labelCounts: benchmark.labelCounts,
    byLabel: {
      entailed: summarizeCalibrationBucket(
        results.filter((result) => result.expectedLabel === "entailed")
      ),
      partial: summarizeCalibrationBucket(
        results.filter((result) => result.expectedLabel === "partial")
      ),
      unsupported: summarizeCalibrationBucket(
        results.filter((result) => result.expectedLabel === "unsupported")
      ),
      contradicted: summarizeCalibrationBucket(
        results.filter((result) => result.expectedLabel === "contradicted")
      )
    },
    byDimension: summarizeByKey(results, (result) => result.dimension),
    byRiskType: {
      direct_support: summarizeCalibrationBucket(
        results.filter((result) => result.riskType === "direct_support")
      ),
      partial_support: summarizeCalibrationBucket(
        results.filter((result) => result.riskType === "partial_support")
      ),
      overstrong_claim: summarizeCalibrationBucket(
        results.filter((result) => result.riskType === "overstrong_claim")
      ),
      contradiction: summarizeCalibrationBucket(
        results.filter((result) => result.riskType === "contradiction")
      )
    },
    results
  };
}

function summarizeByKey(
  results: EntailmentCalibrationCaseResult[],
  getKey: (result: EntailmentCalibrationCaseResult) => string
): Record<string, EntailmentCalibrationBucketSummary> {
  const keys = unique(results.map(getKey));

  return Object.fromEntries(
    keys.map((key) => [
      key,
      summarizeCalibrationBucket(
        results.filter((result) => getKey(result) === key)
      )
    ])
  );
}

function summarizeCalibrationBucket(
  results: EntailmentCalibrationCaseResult[]
): EntailmentCalibrationBucketSummary {
  const passedCases = results.filter((result) => result.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    failedCases: results.length - passedCases,
    accuracy: results.length === 0 ? null : passedCases / results.length
  };
}

function buildEntailmentReasons(input: {
  label: EntailmentLabel;
  supportScore: number;
  contradictions: string[];
  unsupportedOverstrongQualifiers: string[];
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

  if (input.unsupportedOverstrongQualifiers.length > 0) {
    return [
      ...reasons,
      `Unsupported over-strong qualifiers: ${input.unsupportedOverstrongQualifiers.join(", ")}.`
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

function findUnsupportedOverstrongQualifiers(missingTokens: string[]): string[] {
  return missingTokens.filter((token) => OVERSTRONG_TOKENS.has(token));
}

function findContradictions(claim: string, evidence: string): string[] {
  const normalizedClaim = normalizeText(claim);
  const normalizedEvidence = normalizeText(evidence);
  const claimTokens = tokenize(claim);
  const evidenceTokens = new Set(tokenize(evidence));
  const contradictions: string[] = [];

  for (const pair of CONTRADICTION_PAIRS) {
    if (
      normalizedClaim.includes(pair.claimPhrase) &&
      normalizedEvidence.includes(pair.evidencePhrase) &&
      hasContradictionSubjectOverlap({
        pair,
        claimTokens,
        evidenceTokens
      })
    ) {
      contradictions.push(`${pair.claimPhrase} vs ${pair.evidencePhrase}`);
    }
  }

  return contradictions;
}

function hasContradictionSubjectOverlap(input: {
  pair: {
    claimPhrase: string;
    evidencePhrase: string;
  };
  claimTokens: string[];
  evidenceTokens: Set<string>;
}): boolean {
  const claimPredicateTokens = new Set(tokenize(input.pair.claimPhrase));
  const evidencePredicateTokens = new Set(tokenize(input.pair.evidencePhrase));
  const subjectTokens = input.claimTokens.filter(
    (token) =>
      !claimPredicateTokens.has(token) &&
      !evidencePredicateTokens.has(token) &&
      !NEGATION_TOKENS.has(token)
  );
  const matchedSubjectTokens = subjectTokens.filter((token) =>
    input.evidenceTokens.has(token)
  );

  return matchedSubjectTokens.length >= Math.min(2, subjectTokens.length);
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
  },
  {
    claimPhrase: "does not support",
    evidencePhrase: "supports"
  }
];

const OVERSTRONG_TOKENS = new Set([
  "dominates",
  "guarantees",
  "cheapest",
  "exclusive",
  "unlimited"
]);

const NEGATION_TOKENS = new Set(["not", "does"]);

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

const calibrationFacts = [
  {
    id: "fact_cursor_pricing",
    projectId: "project_calibration",
    competitorId: "competitor_cursor",
    dimension: "pricing",
    statement: "Cursor offers paid Pro and Team plans.",
    sourceChunkIds: ["chunk_cursor_pricing"],
    confidence: 0.92
  },
  {
    id: "fact_cursor_enterprise",
    projectId: "project_calibration",
    competitorId: "competitor_cursor",
    dimension: "pricing",
    statement: "Cursor provides enterprise plans with custom pricing.",
    sourceChunkIds: ["chunk_cursor_enterprise"],
    confidence: 0.9
  },
  {
    id: "fact_codex_positioning",
    projectId: "project_calibration",
    competitorId: "competitor_codex",
    dimension: "positioning",
    statement:
      "Codex focuses on software engineering tasks through a coding agent workflow.",
    sourceChunkIds: ["chunk_codex_positioning"],
    confidence: 0.9
  },
  {
    id: "fact_trae_capabilities",
    projectId: "project_calibration",
    competitorId: "competitor_trae",
    dimension: "product_capabilities",
    statement:
      "Trae supports AI-assisted development workflows for product engineering teams.",
    sourceChunkIds: ["chunk_trae_capabilities"],
    confidence: 0.87
  },
  {
    id: "fact_refund_policy",
    projectId: "project_calibration",
    competitorId: "competitor_cursor",
    dimension: "policy",
    statement: "Cursor does not offer refunds after subscription renewal.",
    sourceChunkIds: ["chunk_refund_policy"],
    confidence: 0.88
  }
];

const calibrationChunks = [
  {
    id: "chunk_cursor_pricing",
    sourceId: "source_cursor_pricing",
    ordinal: 0,
    text: "Cursor offers paid Pro and Team plans for AI coding.",
    tokenCount: 10
  },
  {
    id: "chunk_cursor_enterprise",
    sourceId: "source_cursor_enterprise",
    ordinal: 0,
    text: "Cursor provides enterprise plans with custom pricing.",
    tokenCount: 7
  },
  {
    id: "chunk_codex_positioning",
    sourceId: "source_codex_docs",
    ordinal: 0,
    text: "Codex focuses on software engineering tasks through a coding agent workflow.",
    tokenCount: 10
  },
  {
    id: "chunk_trae_capabilities",
    sourceId: "source_trae_docs",
    ordinal: 0,
    text:
      "Trae supports AI-assisted development workflows for product engineering teams.",
    tokenCount: 9
  },
  {
    id: "chunk_refund_policy",
    sourceId: "source_cursor_policy",
    ordinal: 0,
    text: "Cursor does not offer refunds after subscription renewal.",
    tokenCount: 8
  }
];

export const goldenEntailmentCases: GoldenEntailmentCase[] = [
  createGoldenEntailmentCase({
    id: "case_pricing_direct_support",
    name: "Pricing claim directly supported",
    expectedLabel: "entailed",
    dimension: "pricing",
    riskType: "direct_support",
    claimId: "claim_pricing_direct_support",
    statement: "Cursor offers paid Pro plans.",
    factIds: ["fact_cursor_pricing"]
  }),
  createGoldenEntailmentCase({
    id: "case_positioning_direct_support",
    name: "Positioning claim directly supported",
    expectedLabel: "entailed",
    dimension: "positioning",
    riskType: "direct_support",
    claimId: "claim_positioning_direct_support",
    statement: "Codex focuses on coding agent workflow tasks.",
    factIds: ["fact_codex_positioning"]
  }),
  createGoldenEntailmentCase({
    id: "case_capability_partial_support",
    name: "Capability claim has partial support",
    expectedLabel: "partial",
    dimension: "product_capabilities",
    riskType: "partial_support",
    claimId: "claim_capability_partial_support",
    statement: "Trae supports development workflows and automated deployment.",
    factIds: ["fact_trae_capabilities"]
  }),
  createGoldenEntailmentCase({
    id: "case_enterprise_partial_support",
    name: "Enterprise pricing claim has partial support",
    expectedLabel: "partial",
    dimension: "pricing",
    riskType: "partial_support",
    claimId: "claim_enterprise_partial_support",
    statement: "Cursor provides enterprise plans with priority support.",
    factIds: ["fact_cursor_enterprise"]
  }),
  createGoldenEntailmentCase({
    id: "case_pricing_overstrong",
    name: "Pricing claim overstates cheapest guarantee",
    expectedLabel: "unsupported",
    dimension: "pricing",
    riskType: "overstrong_claim",
    claimId: "claim_pricing_overstrong",
    statement:
      "Cursor guarantees the cheapest enterprise contract for every buyer.",
    factIds: ["fact_cursor_pricing"]
  }),
  createGoldenEntailmentCase({
    id: "case_positioning_overstrong",
    name: "Positioning claim invents market leadership",
    expectedLabel: "unsupported",
    dimension: "positioning",
    riskType: "overstrong_claim",
    claimId: "claim_positioning_overstrong",
    statement: "Codex dominates every software engineering market segment.",
    factIds: ["fact_codex_positioning"]
  }),
  createGoldenEntailmentCase({
    id: "case_refund_contradiction",
    name: "Refund claim contradicts policy evidence",
    expectedLabel: "contradicted",
    dimension: "policy",
    riskType: "contradiction",
    claimId: "claim_refund_contradiction",
    statement: "Cursor offers refunds after subscription renewal.",
    factIds: ["fact_refund_policy"]
  }),
  createGoldenEntailmentCase({
    id: "case_capability_contradiction",
    name: "Capability claim contradicts support evidence",
    expectedLabel: "contradicted",
    dimension: "product_capabilities",
    riskType: "contradiction",
    claimId: "claim_capability_contradiction",
    statement: "Trae does not support AI-assisted development workflows.",
    factIds: ["fact_trae_capabilities"]
  })
];

function createGoldenEntailmentCase(input: {
  id: string;
  name: string;
  expectedLabel: EntailmentLabel;
  dimension: string;
  riskType: EntailmentRiskType;
  claimId: string;
  statement: string;
  factIds: string[];
}): GoldenEntailmentCase {
  const citedFactIds = new Set(input.factIds);
  const facts = calibrationFacts.filter((fact) => citedFactIds.has(fact.id));
  const citedChunkIds = new Set(facts.flatMap((fact) => fact.sourceChunkIds));
  const chunks = calibrationChunks.filter((chunk) => citedChunkIds.has(chunk.id));

  return {
    id: input.id,
    name: input.name,
    expectedLabel: input.expectedLabel,
    dimension: input.dimension,
    riskType: input.riskType,
    claim: {
      id: input.claimId,
      projectId: "project_calibration",
      dimension: input.dimension,
      statement: input.statement,
      factIds: input.factIds,
      confidence: 0.86,
      kind: input.riskType === "overstrong_claim" ? "comparative" : "single_competitor"
    },
    facts,
    chunks
  };
}
