import { describe, expect, it } from "vitest";
import {
  evaluateClaimEntailment,
  goldenEntailmentCases,
  runEntailmentCalibration,
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

  it("does not mark unrelated negative capability claims as contradictions", () => {
    const result = evaluateClaimEntailment({
      claim: {
        id: "claim_deployment",
        projectId: "project_1",
        dimension: "product_capabilities",
        statement: "Trae does not support automated deployment.",
        factIds: ["fact_capability"],
        confidence: 0.84,
        kind: "single_competitor"
      },
      facts: [
        {
          id: "fact_capability",
          projectId: "project_1",
          competitorId: "competitor_trae",
          dimension: "product_capabilities",
          statement:
            "Trae supports AI-assisted development workflows for product engineering teams.",
          sourceChunkIds: ["chunk_capability"],
          confidence: 0.88
        }
      ],
      chunks: [
        {
          id: "chunk_capability",
          sourceId: "source_trae",
          ordinal: 0,
          text:
            "Trae supports AI-assisted development workflows for product engineering teams.",
          tokenCount: 9
        }
      ]
    });

    expect(result.label).not.toBe("contradicted");
    expect(result.contradictions).toEqual([]);
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

describe("golden entailment calibration suite", () => {
  it("covers all labels, core dimensions, and risk types", () => {
    expect(goldenEntailmentCases.length).toBeGreaterThanOrEqual(8);
    expect(new Set(goldenEntailmentCases.map((goldenCase) => goldenCase.expectedLabel))).toEqual(
      new Set(["entailed", "partial", "unsupported", "contradicted"])
    );
    expect(goldenEntailmentCases.map((goldenCase) => goldenCase.dimension)).toEqual(
      expect.arrayContaining([
        "pricing",
        "positioning",
        "product_capabilities",
        "policy"
      ])
    );
    expect(goldenEntailmentCases.map((goldenCase) => goldenCase.riskType)).toEqual(
      expect.arrayContaining([
        "direct_support",
        "partial_support",
        "overstrong_claim",
        "contradiction"
      ])
    );
  });

  it("summarizes deterministic calibration by label, dimension, and risk type", () => {
    const summary = runEntailmentCalibration(goldenEntailmentCases);

    expect(summary).toMatchObject({
      totalCases: goldenEntailmentCases.length,
      passedCases: goldenEntailmentCases.length,
      failedCases: 0,
      accuracy: 1
    });
    expect(summary.byLabel.entailed).toMatchObject({
      totalCases: 2,
      accuracy: 1
    });
    expect(summary.byLabel.partial).toMatchObject({
      totalCases: 2,
      accuracy: 1
    });
    expect(summary.byLabel.unsupported).toMatchObject({
      totalCases: 2,
      accuracy: 1
    });
    expect(summary.byLabel.contradicted).toMatchObject({
      totalCases: 2,
      accuracy: 1
    });
    expect(summary.byRiskType.overstrong_claim).toMatchObject({
      totalCases: 2,
      accuracy: 1
    });
    expect(summary.results[0]).toMatchObject({
      id: expect.any(String),
      expectedLabel: expect.any(String),
      actualLabel: expect.any(String),
      dimension: expect.any(String),
      riskType: expect.any(String),
      passed: true
    });
  });

  it("reports empty calibration buckets as unmeasured instead of perfect", () => {
    const summary = runEntailmentCalibration([
      goldenEntailmentCases.find(
        (goldenCase) => goldenCase.expectedLabel === "entailed"
      ) ?? goldenEntailmentCases[0]!
    ]);

    expect(summary.byLabel.contradicted).toEqual({
      totalCases: 0,
      passedCases: 0,
      failedCases: 0,
      accuracy: null
    });
  });
});
