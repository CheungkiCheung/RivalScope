import { describe, expect, it } from "vitest";
import { buildProjectRepairSummary } from "./project-repair-summary";

describe("buildProjectRepairSummary", () => {
  it("returns not_started when no final evaluation artifact exists", () => {
    expect(buildProjectRepairSummary({ artifacts: [] })).toEqual({
      status: "not_started",
      draftQualityScore: null,
      repairedQualityScore: null,
      delta: null,
      actions: [],
      unresolvedGaps: []
    });
  });

  it("uses the latest final_eval artifact for repair delta and actions", () => {
    const summary = buildProjectRepairSummary({
      artifacts: [
        {
          id: "artifact_old",
          kind: "final_eval",
          createdAt: new Date("2026-05-14T00:00:00.000Z"),
          value: {
            status: "unchanged",
            draftQualityScore: 80,
            repairedQualityScore: 80,
            delta: 0,
            actions: [],
            unresolvedGaps: []
          }
        },
        {
          id: "artifact_new",
          kind: "final_eval",
          createdAt: new Date("2026-05-14T00:01:00.000Z"),
          value: {
            status: "improved",
            draftQualityScore: 70,
            repairedQualityScore: 90,
            delta: 20,
            actions: [
              {
                id: "repair_remove_claim_1",
                type: "remove_claim_from_report",
                targetType: "claim",
                targetId: "claim_1",
                severity: "high",
                status: "applied",
                reason: "Claim claim_1 has no cited facts.",
                repairSuggestion: "Remove the claim."
              }
            ],
            unresolvedGaps: ["developer_experience"]
          }
        }
      ]
    });

    expect(summary).toEqual({
      status: "improved",
      draftQualityScore: 70,
      repairedQualityScore: 90,
      delta: 20,
      actions: [
        {
          id: "repair_remove_claim_1",
          type: "remove_claim_from_report",
          targetType: "claim",
          targetId: "claim_1",
          severity: "high",
          status: "applied",
          reason: "Claim claim_1 has no cited facts.",
          repairSuggestion: "Remove the claim."
        }
      ],
      unresolvedGaps: ["developer_experience"]
    });
  });

  it("adds claim trust delta from the latest claim_trust_snapshot artifact", () => {
    const summary = buildProjectRepairSummary({
      artifacts: [
        {
          id: "artifact_final_eval",
          kind: "final_eval",
          createdAt: new Date("2026-05-14T00:00:00.000Z"),
          value: {
            status: "improved",
            draftQualityScore: 70,
            repairedQualityScore: 90,
            delta: 20,
            actions: [],
            unresolvedGaps: []
          }
        },
        {
          id: "artifact_trust_snapshot",
          kind: "claim_trust_snapshot",
          createdAt: new Date("2026-05-14T00:01:00.000Z"),
          value: {
            draftAverageTrust: 62,
            finalAverageTrust: 91,
            trustDelta: 29,
            claims: [
              {
                claimId: "claim_1",
                dimension: "pricing",
                statement: "Cursor offers paid plans.",
                draftScore: 91,
                finalScore: 91,
                delta: 0,
                status: "kept",
                draftRiskLevel: "low",
                finalRiskLevel: "low",
                penalties: []
              },
              {
                claimId: "claim_2",
                dimension: "pricing",
                statement: "Cursor guarantees the cheapest contract.",
                draftScore: 33,
                finalScore: null,
                delta: null,
                status: "removed",
                draftRiskLevel: "high",
                finalRiskLevel: null,
                penalties: ["insufficient_semantic_support"]
              }
            ]
          }
        }
      ]
    });

    expect(summary.claimTrust).toEqual({
      draftAverageTrust: 62,
      finalAverageTrust: 91,
      delta: 29,
      claims: [
        {
          claimId: "claim_1",
          dimension: "pricing",
          statement: "Cursor offers paid plans.",
          draftScore: 91,
          finalScore: 91,
          delta: 0,
          status: "kept",
          draftRiskLevel: "low",
          finalRiskLevel: "low",
          penalties: []
        },
        {
          claimId: "claim_2",
          dimension: "pricing",
          statement: "Cursor guarantees the cheapest contract.",
          draftScore: 33,
          finalScore: null,
          delta: null,
          status: "removed",
          draftRiskLevel: "high",
          finalRiskLevel: null,
          penalties: ["insufficient_semantic_support"]
        }
      ]
    });
  });

  it("ignores malformed final_eval artifacts instead of crashing the page", () => {
    expect(
      buildProjectRepairSummary({
        artifacts: [
          {
            id: "artifact_bad",
            kind: "final_eval",
            createdAt: new Date("2026-05-14T00:00:00.000Z"),
            value: {
              status: "improved",
              draftQualityScore: "70",
              repairedQualityScore: 90,
              delta: 20,
              actions: [],
              unresolvedGaps: []
            }
          }
        ]
      })
    ).toEqual({
      status: "not_started",
      draftQualityScore: null,
      repairedQualityScore: null,
      delta: null,
      actions: [],
      unresolvedGaps: []
    });
  });
});
