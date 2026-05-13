import { describe, expect, it } from "vitest";
import { runGoldenEvaluations } from "./golden-runner";

describe("runGoldenEvaluations", () => {
  it("summarizes golden trajectory scores and failing cases", () => {
    const summary = runGoldenEvaluations([
      {
        id: "healthy",
        name: "Healthy trajectory",
        minScore: 90,
        expectedScore: 100,
        expectedFindingCategories: [],
        requiredDimensions: ["pricing"],
        facts: [
          {
            id: "fact_1",
            projectId: "project_1",
            competitorId: "competitor_cursor",
            dimension: "pricing",
            statement: "Cursor has paid plans.",
            sourceChunkIds: ["chunk_1"],
            confidence: 0.9
          }
        ],
        claims: [
          {
            id: "claim_1",
            projectId: "project_1",
            dimension: "pricing",
            statement: "Cursor monetizes through paid plans.",
            factIds: ["fact_1"],
            confidence: 0.84,
            kind: "single_competitor"
          }
        ]
      },
      {
        id: "broken",
        name: "Broken trajectory",
        minScore: 80,
        expectedScore: 0,
        expectedFindingCategories: ["missing_dimension", "unsupported_claim"],
        requiredDimensions: ["pricing"],
        facts: [],
        claims: [
          {
            id: "claim_1",
            projectId: "project_1",
            dimension: "pricing",
            statement: "Unsupported pricing claim.",
            factIds: [],
            confidence: 0.6,
            kind: "single_competitor"
          }
        ]
      }
    ]);

    expect(summary).toMatchObject({
      totalCases: 2,
      passedCases: 1,
      failedCases: 1,
      averageScore: 50,
      minScore: 0,
      maxScore: 100,
      passed: false
    });
    expect(summary.results).toEqual([
      expect.objectContaining({
        id: "healthy",
        name: "Healthy trajectory",
        score: 100,
        minScore: 90,
        passed: true,
        findingCount: 0,
        failures: []
      }),
      expect.objectContaining({
        id: "broken",
        name: "Broken trajectory",
        score: 0,
        minScore: 80,
        passed: false,
        findingCount: 2,
        failures: ["score 0 is below threshold 80"]
      })
    ]);
  });

  it("fails cases when expected score or finding categories do not match", () => {
    const summary = runGoldenEvaluations([
      {
        id: "mismatch",
        name: "Mismatched expectations",
        minScore: 0,
        expectedScore: 100,
        expectedFindingCategories: ["unknown_fact"],
        requiredDimensions: [],
        facts: [],
        claims: [
          {
            id: "claim_1",
            projectId: "project_1",
            dimension: "pricing",
            statement: "Unsupported pricing claim.",
            factIds: [],
            confidence: 0.6,
            kind: "single_competitor"
          }
        ]
      }
    ]);

    expect(summary.passed).toBe(false);
    expect(summary.results[0]).toMatchObject({
      passed: false,
      failures: [
        "score 33 did not match expected score 100",
        "finding categories missing [unknown_fact] extra [unsupported_claim]"
      ]
    });
  });

  it("returns a passing empty summary when no cases are provided", () => {
    expect(runGoldenEvaluations([])).toEqual({
      totalCases: 0,
      passedCases: 0,
      failedCases: 0,
      averageScore: 100,
      minScore: 100,
      maxScore: 100,
      passed: true,
      results: []
    });
  });
});
