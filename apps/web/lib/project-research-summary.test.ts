import { describe, expect, it } from "vitest";
import { buildProjectResearchSummary } from "./project-research-summary";

describe("buildProjectResearchSummary", () => {
  it("returns not_started when no research synthesis artifact exists", () => {
    expect(buildProjectResearchSummary({ artifacts: [] })).toEqual({
      status: "not_started",
      totalBranches: 0,
      succeededBranches: 0,
      partialBranches: 0,
      failedBranches: 0,
      evidenceGaps: [],
      branchResults: [],
      includedClaimIds: [],
      excludedClaimIds: []
    });
  });

  it("uses the latest research synthesis artifact for branch coverage", () => {
    expect(
      buildProjectResearchSummary({
        artifacts: [
          {
            id: "artifact_old",
            kind: "research_synthesis",
            createdAt: new Date("2026-05-11T00:00:00.000Z"),
            value: {
              totalBranches: 1,
              succeededBranches: 1,
              partialBranches: 0,
              failedBranches: 0,
              evidenceGaps: [],
              branchResults: [],
              includedClaimIds: [],
              excludedClaimIds: []
            }
          },
          {
            id: "artifact_new",
            kind: "research_synthesis",
            createdAt: new Date("2026-05-11T00:00:10.000Z"),
            value: {
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
                  reason:
                    "No extracted facts matched this competitor and dimension."
                }
              ],
              branchResults: [
                {
                  branchId: "branch_cursor_pricing",
                  competitorId: "Cursor",
                  competitorName: "Cursor",
                  dimension: "pricing",
                  status: "succeeded",
                  factIds: ["fact_1"],
                  claimIds: ["claim_1"],
                  evidenceGapIds: []
                },
                {
                  branchId: "branch_codex_pricing",
                  competitorId: "Codex",
                  competitorName: "Codex",
                  dimension: "pricing",
                  status: "failed",
                  factIds: [],
                  claimIds: [],
                  evidenceGapIds: ["gap_codex_pricing_no_facts"]
                }
              ],
              includedClaimIds: ["claim_1"],
              excludedClaimIds: []
            }
          }
        ]
      })
    ).toEqual({
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
      branchResults: [
        {
          branchId: "branch_cursor_pricing",
          competitorId: "Cursor",
          competitorName: "Cursor",
          dimension: "pricing",
          status: "succeeded",
          factCount: 1,
          claimCount: 1,
          evidenceGapIds: []
        },
        {
          branchId: "branch_codex_pricing",
          competitorId: "Codex",
          competitorName: "Codex",
          dimension: "pricing",
          status: "failed",
          factCount: 0,
          claimCount: 0,
          evidenceGapIds: ["gap_codex_pricing_no_facts"]
        }
      ],
      includedClaimIds: ["claim_1"],
      excludedClaimIds: []
    });
  });

  it("ignores malformed research synthesis artifacts instead of crashing", () => {
    expect(
      buildProjectResearchSummary({
        artifacts: [
          {
            id: "artifact_bad",
            kind: "research_synthesis",
            createdAt: new Date("2026-05-11T00:00:00.000Z"),
            value: { totalBranches: "two" }
          }
        ]
      })
    ).toMatchObject({
      status: "not_started",
      totalBranches: 0,
      evidenceGaps: []
    });
  });
});
