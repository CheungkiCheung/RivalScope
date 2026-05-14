import { describe, expect, it } from "vitest";
import {
  evaluateClaimEntailment,
  runEntailmentBenchmark
} from "./entailment";

const facts = [
  {
    id: "fact_pricing",
    projectId: "project_1",
    competitorId: "competitor_cursor",
    dimension: "pricing",
    statement: "Cursor offers paid Pro and Team plans.",
    sourceChunkIds: ["chunk_pricing"],
    confidence: 0.92
  },
  {
    id: "fact_refund",
    projectId: "project_1",
    competitorId: "competitor_cursor",
    dimension: "policy",
    statement: "Cursor does not offer refunds after subscription renewal.",
    sourceChunkIds: ["chunk_refund"],
    confidence: 0.88
  }
];

const chunks = [
  {
    id: "chunk_pricing",
    sourceId: "source_pricing",
    ordinal: 0,
    text: "Cursor offers paid Pro and Team plans for AI coding.",
    tokenCount: 10
  },
  {
    id: "chunk_refund",
    sourceId: "source_refund",
    ordinal: 0,
    text: "Cursor does not offer refunds after subscription renewal.",
    tokenCount: 8
  }
];

describe("evaluateClaimEntailment", () => {
  it("labels directly supported claims as entailed", () => {
    const result = evaluateClaimEntailment({
      claim: {
        id: "claim_supported",
        projectId: "project_1",
        dimension: "pricing",
        statement: "Cursor offers paid Pro plans.",
        factIds: ["fact_pricing"],
        confidence: 0.86,
        kind: "single_competitor"
      },
      facts,
      chunks
    });

    expect(result.label).toBe("entailed");
    expect(result.supportScore).toBeGreaterThanOrEqual(0.75);
    expect(result.reasons).toContain("Evidence covers most claim tokens.");
  });

  it("labels over-strong claims as unsupported", () => {
    const result = evaluateClaimEntailment({
      claim: {
        id: "claim_overstrong",
        projectId: "project_1",
        dimension: "pricing",
        statement:
          "Cursor guarantees the cheapest enterprise contract for every buyer.",
        factIds: ["fact_pricing"],
        confidence: 0.9,
        kind: "comparative"
      },
      facts,
      chunks
    });

    expect(result.label).toBe("unsupported");
    expect(result.supportScore).toBeLessThan(0.4);
    expect(result.missingTokens).toEqual(
      expect.arrayContaining(["guarantees", "cheapest", "enterprise", "contract"])
    );
  });

  it("labels explicit lexical contradictions as contradicted", () => {
    const result = evaluateClaimEntailment({
      claim: {
        id: "claim_refund",
        projectId: "project_1",
        dimension: "policy",
        statement: "Cursor offers refunds after subscription renewal.",
        factIds: ["fact_refund"],
        confidence: 0.84,
        kind: "single_competitor"
      },
      facts,
      chunks
    });

    expect(result.label).toBe("contradicted");
    expect(result.contradictions).toContain("offers refunds vs does not offer refunds");
  });
});

describe("runEntailmentBenchmark", () => {
  it("computes label counts and accuracy", () => {
    const summary = runEntailmentBenchmark([
      {
        id: "case_supported",
        expectedLabel: "entailed",
        claim: {
          id: "claim_supported",
          projectId: "project_1",
          dimension: "pricing",
          statement: "Cursor offers paid Pro plans.",
          factIds: ["fact_pricing"],
          confidence: 0.86,
          kind: "single_competitor"
        },
        facts,
        chunks
      },
      {
        id: "case_overstrong",
        expectedLabel: "unsupported",
        claim: {
          id: "claim_overstrong",
          projectId: "project_1",
          dimension: "pricing",
          statement:
            "Cursor guarantees the cheapest enterprise contract for every buyer.",
          factIds: ["fact_pricing"],
          confidence: 0.9,
          kind: "comparative"
        },
        facts,
        chunks
      }
    ]);

    expect(summary).toMatchObject({
      totalCases: 2,
      passedCases: 2,
      failedCases: 0,
      accuracy: 1,
      labelCounts: {
        entailed: 1,
        partial: 0,
        unsupported: 1,
        contradicted: 0
      }
    });
  });

  it("reports failed cases when expected labels disagree with evaluator output", () => {
    const summary = runEntailmentBenchmark([
      {
        id: "case_mislabeled",
        expectedLabel: "entailed",
        claim: {
          id: "claim_overstrong",
          projectId: "project_1",
          dimension: "pricing",
          statement:
            "Cursor guarantees the cheapest enterprise contract for every buyer.",
          factIds: ["fact_pricing"],
          confidence: 0.9,
          kind: "comparative"
        },
        facts,
        chunks
      }
    ]);

    expect(summary).toMatchObject({
      totalCases: 1,
      passedCases: 0,
      failedCases: 1,
      accuracy: 0,
      results: [
        {
          id: "case_mislabeled",
          expectedLabel: "entailed",
          actualLabel: "unsupported",
          passed: false
        }
      ]
    });
  });
});
