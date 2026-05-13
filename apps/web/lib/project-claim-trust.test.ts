import { describe, expect, it } from "vitest";
import { buildProjectClaimTrustSummary } from "./project-claim-trust";

describe("buildProjectClaimTrustSummary", () => {
  it("returns not_started when no report sections exist", () => {
    expect(
      buildProjectClaimTrustSummary({
        sources: [],
        reportSections: []
      })
    ).toEqual({
      status: "not_started",
      averageScore: null,
      nodes: []
    });
  });

  it("builds trust nodes from report-linked claims, facts, chunks, and sources", () => {
    const summary = buildProjectClaimTrustSummary({
      sources: [
        {
          id: "source_1",
          projectId: "project_1",
          kind: "URL",
          title: "Cursor pricing",
          uri: "https://cursor.com/pricing",
          collectedAt: new Date("2026-05-13T00:00:00.000Z"),
          chunks: [
            {
              id: "chunk_1",
              sourceId: "source_1",
              ordinal: 0,
              text: "Cursor offers paid plans.",
              tokenCount: 5
            }
          ]
        },
        {
          id: "source_2",
          projectId: "project_1",
          kind: "URL",
          title: "Cursor docs",
          uri: "https://cursor.com/docs",
          collectedAt: new Date("2026-05-13T00:00:00.000Z"),
          chunks: [
            {
              id: "chunk_2",
              sourceId: "source_2",
              ordinal: 0,
              text: "Cursor supports agentic workflows.",
              tokenCount: 5
            }
          ]
        }
      ],
      reportSections: [
        {
          id: "section_1",
          title: "Product and pricing",
          claims: [
            {
              claim: {
                id: "claim_1",
                projectId: "project_1",
                dimension: "product_capabilities",
                statement: "Cursor combines paid plans with agentic workflows.",
                confidence: 0.88,
                kind: "SINGLE_COMPETITOR",
                facts: [
                  {
                    fact: {
                      id: "fact_1",
                      projectId: "project_1",
                      competitorId: "competitor_cursor",
                      dimension: "pricing",
                      statement: "Cursor offers paid plans.",
                      confidence: 0.9,
                      competitor: { name: "Cursor" },
                      chunks: [{ chunkId: "chunk_1" }]
                    }
                  },
                  {
                    fact: {
                      id: "fact_2",
                      projectId: "project_1",
                      competitorId: "competitor_cursor",
                      dimension: "product_capabilities",
                      statement: "Cursor supports agentic workflows.",
                      confidence: 0.86,
                      competitor: { name: "Cursor" },
                      chunks: [{ chunkId: "chunk_2" }]
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    });

    expect(summary.status).toBe("ready");
    expect(summary.averageScore).toBeGreaterThanOrEqual(85);
    expect(summary.nodes).toHaveLength(1);
    expect(summary.nodes[0]).toMatchObject({
      claimId: "claim_1",
      sectionTitle: "Product and pricing",
      dimension: "product_capabilities",
      riskLevel: "low",
      facts: [
        {
          id: "fact_1",
          competitorName: "Cursor"
        },
        {
          id: "fact_2",
          competitorName: "Cursor"
        }
      ],
      sources: [
        {
          id: "source_1",
          title: "Cursor pricing"
        },
        {
          id: "source_2",
          title: "Cursor docs"
        }
      ]
    });
  });
});
