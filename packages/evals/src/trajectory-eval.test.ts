import { describe, expect, it } from "vitest";
import { evaluateEvidenceTrajectory } from "./trajectory-eval";

const facts = [
  {
    id: "fact_1",
    projectId: "project_1",
    competitorId: "competitor_cursor",
    dimension: "pricing",
    statement: "Cursor offers paid plans.",
    sourceChunkIds: ["chunk_1"],
    confidence: 0.9
  },
  {
    id: "fact_2",
    projectId: "project_1",
    competitorId: "competitor_codex",
    dimension: "positioning",
    statement: "Codex focuses on agentic implementation.",
    sourceChunkIds: ["chunk_2"],
    confidence: 0.86
  }
];
const cursorFact = facts[0]!;

describe("evaluateEvidenceTrajectory", () => {
  it("scores evidence coverage, citation validity, and required dimension coverage", () => {
    const result = evaluateEvidenceTrajectory({
      requiredDimensions: ["pricing", "positioning", "developer_experience"],
      facts,
      claims: [
        {
          id: "claim_1",
          projectId: "project_1",
          dimension: "pricing",
          statement: "Cursor monetizes through paid plans.",
          factIds: ["fact_1"],
          confidence: 0.82,
          kind: "single_competitor"
        },
        {
          id: "claim_2",
          projectId: "project_1",
          dimension: "positioning",
          statement: "Codex is positioned around agentic implementation.",
          factIds: ["fact_missing"],
          confidence: 0.81,
          kind: "single_competitor"
        },
        {
          id: "claim_3",
          projectId: "project_1",
          dimension: "pricing",
          statement: "Unsupported pricing summary.",
          factIds: [],
          confidence: 0.7,
          kind: "single_competitor"
        }
      ]
    });

    expect(result.metrics).toEqual({
      claimCount: 3,
      factCount: 2,
      evidenceCoverage: 1 / 3,
      citationValidity: 1 / 2,
      requiredDimensionCoverage: 1 / 3,
      sourceTraceability: 1
    });
    expect(result.score).toBe(54);
    expect(result.findings).toEqual([
      {
        severity: "high",
        category: "unsupported_claim",
        message: "Claim claim_3 has no cited facts."
      },
      {
        severity: "high",
        category: "unknown_fact",
        message: "Claim claim_2 cites unknown fact fact_missing."
      },
      {
        severity: "medium",
        category: "missing_dimension",
        message: "Missing required dimension developer_experience."
      },
      {
        severity: "medium",
        category: "missing_dimension",
        message: "Missing required dimension positioning."
      }
    ]);
  });

  it("does not count unsupported or invalid claims toward required dimensions", () => {
    const result = evaluateEvidenceTrajectory({
      requiredDimensions: ["pricing", "positioning"],
      facts: [cursorFact],
      claims: [
        {
          id: "claim_1",
          projectId: "project_1",
          dimension: "pricing",
          statement: "Unsupported pricing summary.",
          factIds: [],
          confidence: 0.7,
          kind: "single_competitor"
        },
        {
          id: "claim_2",
          projectId: "project_1",
          dimension: "positioning",
          statement: "Positioning claim with missing evidence.",
          factIds: ["fact_missing"],
          confidence: 0.7,
          kind: "single_competitor"
        }
      ]
    });

    expect(result.metrics).toMatchObject({
      evidenceCoverage: 0,
      citationValidity: 0,
      requiredDimensionCoverage: 0
    });
    expect(result.score).toBe(0);
    expect(result.findings).toContainEqual({
      severity: "medium",
      category: "missing_dimension",
      message: "Missing required dimension pricing."
    });
    expect(result.findings).toContainEqual({
      severity: "medium",
      category: "missing_dimension",
      message: "Missing required dimension positioning."
    });
  });

  it("scores citation validity as zero when claims contain no citations", () => {
    const result = evaluateEvidenceTrajectory({
      requiredDimensions: [],
      facts: [],
      claims: [
        {
          id: "claim_1",
          projectId: "project_1",
          dimension: "pricing",
          statement: "Unsupported pricing summary.",
          factIds: [],
          confidence: 0.7,
          kind: "single_competitor"
        }
      ]
    });

    expect(result.metrics.citationValidity).toBe(0);
    expect(result.score).toBe(25);
  });

  it("returns perfect trajectory scores for fully cited required dimensions", () => {
    const result = evaluateEvidenceTrajectory({
      requiredDimensions: ["pricing"],
      facts: [cursorFact],
      claims: [
        {
          id: "claim_1",
          projectId: "project_1",
          dimension: "pricing",
          statement: "Cursor monetizes through paid plans.",
          factIds: ["fact_1"],
          confidence: 0.82,
          kind: "single_competitor"
        }
      ]
    });

    expect(result.metrics).toMatchObject({
      evidenceCoverage: 1,
      citationValidity: 1,
      requiredDimensionCoverage: 1,
      sourceTraceability: 1
    });
    expect(result.score).toBe(100);
    expect(result.findings).toEqual([]);
  });

  it("penalizes claims whose facts do not trace to source chunks", () => {
    const result = evaluateEvidenceTrajectory({
      requiredDimensions: ["pricing"],
      facts: [
        {
          ...cursorFact,
          sourceChunkIds: []
        }
      ],
      claims: [
        {
          id: "claim_1",
          projectId: "project_1",
          dimension: "pricing",
          statement: "Cursor monetizes through paid plans.",
          factIds: ["fact_1"],
          confidence: 0.82,
          kind: "single_competitor"
        }
      ]
    });

    expect(result.metrics).toMatchObject({
      evidenceCoverage: 0,
      citationValidity: 1,
      requiredDimensionCoverage: 0,
      sourceTraceability: 0
    });
    expect(result.score).toBe(25);
    expect(result.findings).toContainEqual({
      severity: "high",
      category: "untraced_fact",
      message: "Claim claim_1 cites fact fact_1 without source chunks."
    });
    expect(result.findings).toContainEqual({
      severity: "medium",
      category: "missing_dimension",
      message: "Missing required dimension pricing."
    });
  });
});
