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

  it("adds judge comparison disagreement details from the latest artifact", () => {
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
          id: "artifact_judge_comparison",
          kind: "entailment_judge_comparison",
          createdAt: new Date("2026-05-14T00:01:00.000Z"),
          value: {
            totalCases: 2,
            judges: [
              {
                name: "deterministic",
                passedCases: 2,
                failedCases: 0,
                accuracy: 1,
                labelCounts: {
                  entailed: 1,
                  partial: 0,
                  unsupported: 1,
                  contradicted: 0
                }
              },
              {
                name: "model",
                passedCases: 1,
                failedCases: 1,
                accuracy: 0.5,
                labelCounts: {
                  entailed: 1,
                  partial: 1,
                  unsupported: 0,
                  contradicted: 0
                }
              }
            ],
            disagreements: [
              {
                caseId: "claim_2",
                labels: {
                  deterministic: "unsupported",
                  model: "partial"
                }
              }
            ]
          }
        }
      ]
    });

    expect(summary.judgeComparison).toEqual({
      totalCases: 2,
      disagreementsCount: 1,
      gateStatus: "review",
      highRiskDisagreementsCount: 0,
      highRiskDisagreements: [],
      lowRiskDisagreementsCount: 1,
      judges: [
        {
          name: "deterministic",
          alignedCases: 2,
          disagreedCases: 0,
          baselineAgreement: 1
        },
        {
          name: "model",
          alignedCases: 1,
          disagreedCases: 1,
          baselineAgreement: 0.5
        }
      ],
      disagreements: [
        {
          caseId: "claim_2",
          labels: {
            deterministic: "unsupported",
            model: "partial"
          }
        }
      ]
    });
  });

  it("surfaces calibrated high-risk disagreement gate decisions", () => {
    const summary = buildProjectRepairSummary({
      artifacts: [
        {
          id: "artifact_final_eval",
          kind: "final_eval",
          createdAt: new Date("2026-05-14T00:00:00.000Z"),
          value: {
            status: "unchanged",
            draftQualityScore: 100,
            repairedQualityScore: 100,
            delta: 0,
            actions: [],
            unresolvedGaps: ["claim_review:claim_2"]
          }
        },
        {
          id: "artifact_judge_comparison",
          kind: "entailment_judge_comparison",
          createdAt: new Date("2026-05-14T00:01:00.000Z"),
          value: {
            status: "succeeded",
            totalCases: 1,
            judges: [
              {
                name: "deterministic",
                passedCases: 1,
                failedCases: 0,
                accuracy: 1,
                labelCounts: {
                  entailed: 1,
                  partial: 0,
                  unsupported: 0,
                  contradicted: 0
                }
              },
              {
                name: "model",
                passedCases: 0,
                failedCases: 1,
                accuracy: 0,
                labelCounts: {
                  entailed: 0,
                  partial: 0,
                  unsupported: 1,
                  contradicted: 0
                }
              }
            ],
            cases: [
              {
                caseId: "claim_2",
                claimId: "claim_2",
                statement: "Cursor offers paid plans.",
                dimension: "pricing",
                expectedLabel: "entailed",
                labels: {
                  deterministic: "entailed",
                  model: "unsupported"
                }
              }
            ],
            disagreements: [
              {
                caseId: "claim_2",
                labels: {
                  deterministic: "entailed",
                  model: "unsupported"
                }
              }
            ],
            policyDecisions: [
              {
                caseId: "claim_2",
                claimId: "claim_2",
                gate: "human_review",
                severity: "high",
                reason:
                  "Entailment judges disagree on a severe support label for claim claim_2."
              }
            ]
          }
        }
      ]
    });

    expect(summary.judgeComparison).toMatchObject({
      gateStatus: "review",
      highRiskDisagreementsCount: 1,
      lowRiskDisagreementsCount: 0,
      highRiskDisagreements: [
        {
          caseId: "claim_2",
          claimId: "claim_2",
          statement: "Cursor offers paid plans.",
          dimension: "pricing",
          expectedLabel: "entailed",
          gate: "human_review",
          severity: "high"
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
