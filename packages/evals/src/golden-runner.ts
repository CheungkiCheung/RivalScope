import type { Claim, Fact } from "@rivalscope/core";
import {
  evaluateEvidenceTrajectory,
  type EvidenceTrajectoryEvalResult,
  type TrajectoryEvalFinding
} from "./trajectory-eval";

export interface GoldenEvaluationCase {
  id: string;
  name: string;
  minScore: number;
  expectedScore?: number;
  expectedFindingCategories?: TrajectoryEvalFinding["category"][];
  requiredDimensions: string[];
  facts: Fact[];
  claims: Claim[];
}

export interface GoldenEvaluationCaseResult {
  id: string;
  name: string;
  score: number;
  minScore: number;
  passed: boolean;
  findingCount: number;
  failures: string[];
  evaluation: EvidenceTrajectoryEvalResult;
}

export interface GoldenEvaluationSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  passed: boolean;
  results: GoldenEvaluationCaseResult[];
}

export function runGoldenEvaluations(
  cases: GoldenEvaluationCase[]
): GoldenEvaluationSummary {
  if (cases.length === 0) {
    return {
      totalCases: 0,
      passedCases: 0,
      failedCases: 0,
      averageScore: 100,
      minScore: 100,
      maxScore: 100,
      passed: true,
      results: []
    };
  }

  const results = cases.map((goldenCase) => {
    const evaluation = evaluateEvidenceTrajectory({
      requiredDimensions: goldenCase.requiredDimensions,
      facts: goldenCase.facts,
      claims: goldenCase.claims
    });

    const failures = evaluateCaseFailures(goldenCase, evaluation);

    return {
      id: goldenCase.id,
      name: goldenCase.name,
      score: evaluation.score,
      minScore: goldenCase.minScore,
      passed: failures.length === 0,
      findingCount: evaluation.findings.length,
      failures,
      evaluation
    };
  });
  const scores = results.map((result) => result.score);
  const passedCases = results.filter((result) => result.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    failedCases: results.length - passedCases,
    averageScore: Math.round(
      scores.reduce((total, score) => total + score, 0) / scores.length
    ),
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    passed: results.every((result) => result.passed),
    results
  };
}

function evaluateCaseFailures(
  goldenCase: GoldenEvaluationCase,
  evaluation: EvidenceTrajectoryEvalResult
): string[] {
  const failures: string[] = [];

  if (evaluation.score < goldenCase.minScore) {
    failures.push(
      `score ${evaluation.score} is below threshold ${goldenCase.minScore}`
    );
  }

  if (
    goldenCase.expectedScore !== undefined &&
    evaluation.score !== goldenCase.expectedScore
  ) {
    failures.push(
      `score ${evaluation.score} did not match expected score ${goldenCase.expectedScore}`
    );
  }

  if (goldenCase.expectedFindingCategories !== undefined) {
    const actualCategories = uniqueSorted(
      evaluation.findings.map((finding) => finding.category)
    );
    const expectedCategories = uniqueSorted(
      goldenCase.expectedFindingCategories
    );

    if (!arraysEqual(actualCategories, expectedCategories)) {
      failures.push(
        `finding categories missing [${difference(
          expectedCategories,
          actualCategories
        ).join(",")}] extra [${difference(actualCategories, expectedCategories).join(",")}]`
      );
    }
  }

  return failures;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function difference<T extends string>(left: T[], right: T[]): T[] {
  const rightValues = new Set(right);

  return left.filter((value) => !rightValues.has(value));
}

function arraysEqual<T extends string>(left: T[], right: T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
