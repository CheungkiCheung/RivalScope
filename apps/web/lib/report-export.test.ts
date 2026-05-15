import { describe, expect, it } from "vitest";
import { buildReportExport } from "./report-export";

describe("buildReportExport", () => {
  it("builds JSON and Markdown report exports with an evidence appendix", () => {
    const result = buildReportExport({
      project: {
        id: "project_1",
        name: "AI Coding Tools",
        description: "Compare agentic coding products."
      },
      report: {
        id: "report_1",
        title: "Competitive Intelligence Report",
        status: "FINAL",
        qualityScore: 92,
        sections: [
          {
            id: "section_summary",
            title: "Executive Summary",
            body: "Cursor offers paid plans.",
            claims: [
              {
                claimId: "claim_1",
                claim: {
                  id: "claim_1",
                  statement: "Cursor offers paid plans.",
                  dimension: "pricing",
                  confidence: 0.84,
                  kind: "SINGLE_COMPETITOR",
                  facts: [
                    {
                      factId: "fact_1",
                      fact: {
                        id: "fact_1",
                        statement: "Cursor offers individual Pro and Team plans.",
                        dimension: "pricing",
                        confidence: 0.91,
                        competitor: { name: "Cursor" },
                        chunks: [
                          {
                            chunkId: "chunk_1",
                            chunk: {
                              id: "chunk_1",
                              text: "Cursor offers individual Pro and Team plans.",
                              sourceId: "source_1"
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      },
      claimTrust: {
        status: "ready",
        averageScore: 88,
        nodes: [
          {
            claimId: "claim_1",
            statement: "Cursor offers paid plans.",
            dimension: "pricing",
            sectionId: "section_summary",
            sectionTitle: "Executive Summary",
            score: 88,
            riskLevel: "low",
            metrics: {
              citationValidity: 1,
              evidenceStrength: 0.91,
              sourceTraceability: 1,
              factConfidence: 0.91,
              sourceDiversity: 0.5,
              semanticSupport: 0.9,
              sourceAuthority: 0.8,
              citedFactCount: 1,
              validFactCount: 1,
              sourceChunkCount: 1,
              sourceCount: 1
            },
            penalties: [],
            reasons: ["Evidence is cited and traceable."],
            facts: [
              {
                id: "fact_1",
                statement: "Cursor offers individual Pro and Team plans.",
                dimension: "pricing",
                confidence: 0.91,
                competitorName: "Cursor",
                sourceChunkIds: ["chunk_1"]
              }
            ],
            chunks: [
              {
                id: "chunk_1",
                text: "Cursor offers individual Pro and Team plans.",
                sourceId: "source_1"
              }
            ],
            sources: [
              {
                id: "source_1",
                title: "Cursor pricing",
                uri: "https://cursor.com/pricing"
              }
            ]
          }
        ]
      },
      research: {
        status: "partial",
        totalBranches: 2,
        succeededBranches: 1,
        partialBranches: 0,
        failedBranches: 1,
        evidenceGaps: [
          {
            id: "gap_codex_pricing_no_facts",
            branchId: "branch_codex_pricing",
            competitorId: "Codex",
            competitorName: "Codex",
            dimension: "pricing",
            reason: "No extracted facts matched this competitor and dimension."
          }
        ],
        branchResults: [],
        includedClaimIds: ["claim_1"],
        excludedClaimIds: ["claim_2"]
      }
    });

    expect(result.json).toMatchObject({
      project: {
        id: "project_1",
        name: "AI Coding Tools"
      },
      report: {
        id: "report_1",
        title: "Competitive Intelligence Report",
        status: "FINAL",
        qualityScore: 92,
        sections: [
          {
            id: "section_summary",
            claimIds: ["claim_1"]
          }
        ]
      },
      synthesis: {
        includedClaimIds: ["claim_1"],
        excludedClaimIds: ["claim_2"],
        evidenceGapIds: ["gap_codex_pricing_no_facts"]
      },
      evidenceAppendix: [
        {
          claimId: "claim_1",
          trustScore: 88,
          facts: [
            {
              id: "fact_1",
              sourceChunks: [
                {
                  id: "chunk_1",
                  source: {
                    id: "source_1",
                    title: "Cursor pricing",
                    uri: "https://cursor.com/pricing"
                  }
                }
              ]
            }
          ]
        }
      ]
    });
    expect(result.markdown).toContain("# Competitive Intelligence Report");
    expect(result.markdown).toContain("## Evidence Appendix");
    expect(result.markdown).toContain("Claim `claim_1`: Cursor offers paid plans.");
    expect(result.markdown).toContain("Source: Cursor pricing - https://cursor.com/pricing");
    expect(result.markdown).toContain("## Evidence Gaps");
    expect(result.markdown).toContain("Codex / pricing: No extracted facts matched this competitor and dimension.");
  });

  it("exports fact-level warnings when cited facts do not trace to source chunks", () => {
    const result = buildReportExport({
      project: {
        id: "project_1",
        name: "AI Coding Tools",
        description: null
      },
      report: {
        id: "report_1",
        title: "Competitive Intelligence Report",
        status: "DRAFT",
        qualityScore: 80,
        sections: [
          {
            id: "section_summary",
            title: "Executive Summary",
            body: "Cursor offers paid plans and has undocumented benchmark claims.",
            claims: [
              {
                claimId: "claim_1",
                claim: {
                  id: "claim_1",
                  statement:
                    "Cursor offers paid plans and has undocumented benchmark claims.",
                  dimension: "pricing",
                  confidence: 0.72,
                  kind: "SINGLE_COMPETITOR",
                  facts: []
                }
              }
            ]
          }
        ]
      },
      claimTrust: {
        status: "ready",
        averageScore: 68,
        nodes: [
          {
            claimId: "claim_1",
            statement:
              "Cursor offers paid plans and has undocumented benchmark claims.",
            dimension: "pricing",
            sectionId: "section_summary",
            sectionTitle: "Executive Summary",
            score: 68,
            riskLevel: "medium",
            metrics: {
              citationValidity: 1,
              evidenceStrength: 0.82,
              sourceTraceability: 0.5,
              factConfidence: 0.82,
              sourceDiversity: 0.5,
              semanticSupport: 0.7,
              sourceAuthority: 0.8,
              citedFactCount: 2,
              validFactCount: 2,
              sourceChunkCount: 1,
              sourceCount: 1
            },
            penalties: [],
            reasons: ["One cited fact is missing source chunks."],
            facts: [
              {
                id: "fact_traced",
                statement: "Cursor offers paid plans.",
                dimension: "pricing",
                confidence: 0.91,
                competitorName: "Cursor",
                sourceChunkIds: ["chunk_1"]
              },
              {
                id: "fact_untraced",
                statement: "Cursor has benchmark-leading pricing.",
                dimension: "pricing",
                confidence: 0.73,
                competitorName: "Cursor",
                sourceChunkIds: []
              }
            ],
            chunks: [
              {
                id: "chunk_1",
                text: "Cursor offers paid plans.",
                sourceId: "source_1"
              }
            ],
            sources: [
              {
                id: "source_1",
                title: "Cursor pricing",
                uri: "https://cursor.com/pricing"
              }
            ]
          }
        ]
      },
      research: {
        status: "complete",
        totalBranches: 1,
        succeededBranches: 1,
        partialBranches: 0,
        failedBranches: 0,
        evidenceGaps: [],
        branchResults: [],
        includedClaimIds: ["claim_1"],
        excludedClaimIds: []
      }
    });

    expect(result.json.evidenceAppendix).toMatchObject([
      {
        claimId: "claim_1",
        warnings: [
          {
            code: "missing_source_chunk",
            factId: "fact_untraced",
            message: "Fact fact_untraced has no source chunks."
          }
        ],
        facts: [
          {
            id: "fact_traced",
            sourceChunks: [
              {
                id: "chunk_1"
              }
            ]
          },
          {
            id: "fact_untraced",
            sourceChunks: [],
            traceability: "missing_source_chunk"
          }
        ]
      }
    ]);
    expect(result.markdown).toContain("## Evidence Warnings");
    expect(result.markdown).toContain(
      "- Claim `claim_1`, Fact `fact_untraced`: Fact fact_untraced has no source chunks."
    );
    expect(result.markdown).not.toContain("Fact `fact_untraced`: Cursor has benchmark-leading pricing.\n  - Chunk `chunk_1`");
  });

  it("returns empty export placeholders when no report exists", () => {
    const result = buildReportExport({
      project: {
        id: "project_1",
        name: "AI Coding Tools",
        description: null
      },
      report: null,
      claimTrust: {
        status: "not_started",
        averageScore: null,
        nodes: []
      },
      research: {
        status: "not_started",
        totalBranches: 0,
        succeededBranches: 0,
        partialBranches: 0,
        failedBranches: 0,
        evidenceGaps: [],
        branchResults: [],
        includedClaimIds: [],
        excludedClaimIds: []
      }
    });

    expect(result.json.report).toBeNull();
    expect(result.json.evidenceAppendix).toEqual([]);
    expect(result.markdown).toContain("# AI Coding Tools");
    expect(result.markdown).toContain("No report has been generated yet.");
  });
});
