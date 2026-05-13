import { describe, expect, it } from "vitest";
import { buildProjectEvalSummary } from "./project-eval-summary";

describe("buildProjectEvalSummary", () => {
  it("returns not_started when no report has been generated", () => {
    expect(
      buildProjectEvalSummary({
        requiredDimensions: ["pricing"],
        reportSections: []
      })
    ).toEqual({
      status: "not_started",
      score: null,
      metrics: null,
      findings: []
    });
  });

  it("deduplicates report-linked claims and facts before scoring", () => {
    const summary = buildProjectEvalSummary({
      requiredDimensions: ["pricing"],
      reportSections: [
        {
          claims: [
            {
              claim: {
                id: "claim_1",
                projectId: "project_1",
                dimension: "pricing",
                statement: "Cursor monetizes through paid plans.",
                confidence: 0.84,
                kind: "SINGLE_COMPETITOR",
                facts: [
                  {
                    fact: {
                      id: "fact_1",
                      projectId: "project_1",
                      competitorId: "competitor_cursor",
                      dimension: "pricing",
                      statement: "Cursor has paid plans.",
                      confidence: 0.9,
                      chunks: [{ chunkId: "chunk_1" }]
                    }
                  }
                ]
              }
            }
          ]
        },
        {
          claims: [
            {
              claim: {
                id: "claim_1",
                projectId: "project_1",
                dimension: "pricing",
                statement: "Cursor monetizes through paid plans.",
                confidence: 0.84,
                kind: "SINGLE_COMPETITOR",
                facts: [
                  {
                    fact: {
                      id: "fact_1",
                      projectId: "project_1",
                      competitorId: "competitor_cursor",
                      dimension: "pricing",
                      statement: "Cursor has paid plans.",
                      confidence: 0.9,
                      chunks: [{ chunkId: "chunk_1" }]
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    });

    expect(summary).toMatchObject({
      status: "ready",
      score: 100,
      metrics: {
        claimCount: 1,
        factCount: 1,
        evidenceCoverage: 1,
        citationValidity: 1,
        requiredDimensionCoverage: 1
      },
      findings: []
    });
  });

  it("surfaces missing required dimensions from the report trajectory", () => {
    const summary = buildProjectEvalSummary({
      requiredDimensions: ["pricing", "developer_experience"],
      reportSections: [
        {
          claims: [
            {
              claim: {
                id: "claim_1",
                projectId: "project_1",
                dimension: "pricing",
                statement: "Unsupported pricing summary.",
                confidence: 0.6,
                kind: "COMPARATIVE",
                facts: []
              }
            }
          ]
        }
      ]
    });

    expect(summary.status).toBe("ready");
    expect(summary.score).toBe(0);
    expect(summary.findings).toEqual([
      {
        severity: "high",
        category: "unsupported_claim",
        message: "Claim claim_1 has no cited facts."
      },
      {
        severity: "medium",
        category: "missing_dimension",
        message: "Missing required dimension developer_experience."
      },
      {
        severity: "medium",
        category: "missing_dimension",
        message: "Missing required dimension pricing."
      }
    ]);
  });
});
