import { describe, expect, it } from "vitest";
import { evaluateClaimTrust } from "./claim-trust";

const sources = [
  {
    id: "source_1",
    projectId: "project_1",
    kind: "url" as const,
    title: "Cursor pricing",
    uri: "https://cursor.com/pricing",
    collectedAt: "2026-05-13T00:00:00.000Z"
  },
  {
    id: "source_2",
    projectId: "project_1",
    kind: "url" as const,
    title: "Cursor docs",
    uri: "https://cursor.com/docs",
    collectedAt: "2026-05-13T00:00:00.000Z"
  }
];

const chunks = [
  {
    id: "chunk_1",
    sourceId: "source_1",
    ordinal: 0,
    text: "Cursor offers paid plans.",
    tokenCount: 5
  },
  {
    id: "chunk_2",
    sourceId: "source_2",
    ordinal: 0,
    text: "Cursor supports agentic coding workflows.",
    tokenCount: 6
  }
];

const facts = [
  {
    id: "fact_1",
    projectId: "project_1",
    competitorId: "competitor_cursor",
    dimension: "pricing",
    statement: "Cursor offers paid plans.",
    sourceChunkIds: ["chunk_1"],
    confidence: 0.92
  },
  {
    id: "fact_2",
    projectId: "project_1",
    competitorId: "competitor_cursor",
    dimension: "product_capabilities",
    statement: "Cursor supports agentic coding workflows.",
    sourceChunkIds: ["chunk_2"],
    confidence: 0.88
  }
];

describe("evaluateClaimTrust", () => {
  it("scores a well-supported multi-source claim as low risk", () => {
    const result = evaluateClaimTrust({
      claim: {
        id: "claim_1",
        projectId: "project_1",
        dimension: "product_capabilities",
        statement: "Cursor combines paid plans with agentic coding workflows.",
        factIds: ["fact_1", "fact_2"],
        confidence: 0.86,
        kind: "single_competitor"
      },
      facts,
      chunks,
      sources
    });

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.riskLevel).toBe("low");
    expect(result.metrics).toMatchObject({
      citedFactCount: 2,
      validFactCount: 2,
      sourceChunkCount: 2,
      sourceCount: 2,
      sourceDiversity: 1
    });
    expect(result.penalties).toEqual([]);
  });

  it("scores unsupported and unknown references as high risk", () => {
    const result = evaluateClaimTrust({
      claim: {
        id: "claim_2",
        projectId: "project_1",
        dimension: "pricing",
        statement: "Cursor has the cheapest enterprise plan.",
        factIds: ["fact_missing"],
        confidence: 0.9,
        kind: "comparative"
      },
      facts,
      chunks,
      sources
    });

    expect(result.score).toBeLessThan(65);
    expect(result.riskLevel).toBe("high");
    expect(result.penalties).toContainEqual({
      code: "unknown_fact",
      points: 30,
      message: "Claim claim_2 cites unknown fact fact_missing."
    });
  });

  it("does not let duplicate facts or chunks inflate trust", () => {
    const result = evaluateClaimTrust({
      claim: {
        id: "claim_3",
        projectId: "project_1",
        dimension: "pricing",
        statement: "Cursor offers paid plans.",
        factIds: ["fact_1", "fact_1"],
        confidence: 0.84,
        kind: "single_competitor"
      },
      facts: [
        {
          ...facts[0]!,
          sourceChunkIds: ["chunk_1", "chunk_1"]
        }
      ],
      chunks,
      sources
    });

    expect(result.metrics).toMatchObject({
      citedFactCount: 1,
      validFactCount: 1,
      sourceChunkCount: 1,
      sourceCount: 1
    });
    expect(result.penalties).toContainEqual({
      code: "single_source",
      points: 8,
      message: "Claim claim_3 is supported by only one unique source."
    });
  });

  it("applies targeted high-severity critic penalties to the matching claim", () => {
    const clean = evaluateClaimTrust({
      claim: {
        id: "claim_1",
        projectId: "project_1",
        dimension: "product_capabilities",
        statement: "Cursor combines paid plans with agentic coding workflows.",
        factIds: ["fact_1", "fact_2"],
        confidence: 0.86,
        kind: "single_competitor"
      },
      facts,
      chunks,
      sources
    });
    const penalized = evaluateClaimTrust({
      claim: {
        id: "claim_1",
        projectId: "project_1",
        dimension: "product_capabilities",
        statement: "Cursor combines paid plans with agentic coding workflows.",
        factIds: ["fact_1", "fact_2"],
        confidence: 0.86,
        kind: "single_competitor"
      },
      facts,
      chunks,
      sources,
      criticFindings: [
        {
          severity: "high",
          targetType: "claim",
          targetId: "claim_1",
          message: "Quality Agent flagged this claim."
        }
      ]
    });

    expect(penalized.score).toBe(clean.score - 15);
    expect(penalized.penalties).toContainEqual({
      code: "high_severity_critic_finding",
      points: 15,
      message: "Quality Agent flagged this claim."
    });
  });

  it("penalizes structurally cited claims when cited evidence does not semantically support the claim", () => {
    const result = evaluateClaimTrust({
      claim: {
        id: "claim_semantic_gap",
        projectId: "project_1",
        dimension: "pricing",
        statement:
          "Cursor guarantees the cheapest enterprise contract for every buyer.",
        factIds: ["fact_1"],
        confidence: 0.9,
        kind: "comparative"
      },
      facts,
      chunks,
      sources
    });

    expect(result.riskLevel).toBe("high");
    expect(result.metrics.semanticSupport).toBeLessThan(0.4);
    expect(result.penalties).toContainEqual({
      code: "insufficient_semantic_support",
      points: 25,
      message:
        "Claim claim_semantic_gap has weak lexical support from cited evidence."
    });
    expect(result.reasons).toContain("Entailment label is unsupported.");
  });

  it("penalizes claims supported only by low-authority sources", () => {
    const result = evaluateClaimTrust({
      claim: {
        id: "claim_low_authority",
        projectId: "project_1",
        dimension: "pricing",
        statement: "Cursor offers paid plans.",
        factIds: ["fact_1"],
        confidence: 0.86,
        kind: "single_competitor"
      },
      facts: [facts[0]!],
      chunks: [chunks[0]!],
      sources: [
        {
          id: "source_1",
          projectId: "project_1",
          kind: "text",
          title: "Unattributed notes",
          uri: "manual://notes",
          collectedAt: "2026-05-13T00:00:00.000Z"
        }
      ]
    });

    expect(result.metrics.sourceAuthority).toBeLessThan(0.6);
    expect(result.penalties).toContainEqual({
      code: "low_source_authority",
      points: 10,
      message: "Claim claim_low_authority relies on low-authority sources."
    });
  });

  it("keeps official source claims high trust when semantic support is adequate", () => {
    const result = evaluateClaimTrust({
      claim: {
        id: "claim_official",
        projectId: "project_1",
        dimension: "pricing",
        statement: "Cursor offers paid plans.",
        factIds: ["fact_1"],
        confidence: 0.86,
        kind: "single_competitor"
      },
      facts: [facts[0]!],
      chunks: [chunks[0]!],
      sources: [sources[0]!]
    });

    expect(result.metrics.semanticSupport).toBe(1);
    expect(result.metrics.sourceAuthority).toBeGreaterThanOrEqual(0.8);
    expect(result.penalties.map((penalty) => penalty.code)).not.toContain(
      "insufficient_semantic_support"
    );
    expect(result.penalties.map((penalty) => penalty.code)).not.toContain(
      "low_source_authority"
    );
  });
});
