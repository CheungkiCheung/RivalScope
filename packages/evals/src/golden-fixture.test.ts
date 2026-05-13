import { describe, expect, it } from "vitest";
import { parseGoldenEvaluationCases } from "./golden-fixture";

const validCase = {
  id: "case_1",
  name: "Valid case",
  minScore: 90,
  requiredDimensions: ["pricing"],
  facts: [
    {
      id: "fact_1",
      projectId: "project_1",
      competitorId: "competitor_cursor",
      dimension: "pricing",
      statement: "Cursor has paid plans.",
      sourceChunkIds: ["chunk_1"],
      confidence: 0.9
    }
  ],
  claims: [
    {
      id: "claim_1",
      projectId: "project_1",
      dimension: "pricing",
      statement: "Cursor monetizes through paid plans.",
      factIds: ["fact_1"],
      confidence: 0.84,
      kind: "single_competitor"
    }
  ]
};

describe("parseGoldenEvaluationCases", () => {
  it("rejects unknown fields at fixture boundaries", () => {
    expect(() =>
      parseGoldenEvaluationCases([
        {
          ...validCase,
          unexpectedNetworkModelCall: true
        }
      ])
    ).toThrow(/Unrecognized key/);

    expect(() =>
      parseGoldenEvaluationCases([
        {
          ...validCase,
          facts: [
            {
              ...validCase.facts[0],
              unexpectedSource: "silent drift"
            }
          ]
        }
      ])
    ).toThrow(/Unrecognized key/);

    expect(() =>
      parseGoldenEvaluationCases([
        {
          ...validCase,
          claims: [
            {
              ...validCase.claims[0],
              unexpectedClaimField: "silent drift"
            }
          ]
        }
      ])
    ).toThrow(/Unrecognized key/);
  });
});
