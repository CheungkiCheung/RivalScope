import { describe, expect, it } from "vitest";
import { MockModelClient } from "./model-client";
import {
  compareEntailmentJudges,
  createDeterministicEntailmentJudge,
  createModelEntailmentJudge
} from "./entailment-judge";

const claim = {
  id: "claim_overstrong",
  projectId: "project_1",
  dimension: "pricing",
  statement: "Cursor guarantees the cheapest enterprise contract for every buyer.",
  factIds: ["fact_pricing"],
  confidence: 0.9,
  kind: "comparative" as const
};

const facts = [
  {
    id: "fact_pricing",
    projectId: "project_1",
    competitorId: "competitor_cursor",
    dimension: "pricing",
    statement: "Cursor offers paid Pro and Team plans.",
    sourceChunkIds: ["chunk_pricing"],
    confidence: 0.92
  }
];

const chunks = [
  {
    id: "chunk_pricing",
    sourceId: "source_pricing",
    ordinal: 0,
    text: "Cursor offers paid Pro and Team plans for AI coding.",
    tokenCount: 10
  }
];

describe("createModelEntailmentJudge", () => {
  it("asks a model for JSON-only entailment labels and normalizes the result", async () => {
    const model = new MockModelClient([
      {
        content: JSON.stringify({
          label: "unsupported",
          supportScore: 0.18,
          matchedTokens: ["cursor"],
          missingTokens: ["guarantees", "cheapest"],
          contradictions: [],
          reasons: ["Evidence does not establish cheapest pricing."]
        })
      }
    ]);
    const judge = createModelEntailmentJudge({ model });

    const result = await judge.evaluate({ claim, facts, chunks });

    expect(judge.name).toBe("model");
    expect(model.calls[0]).toMatchObject({
      task: "entailment_judge",
      responseFormat: "json_object"
    });
    expect(JSON.parse(model.calls[0]?.messages[0]?.content ?? "{}")).toMatchObject({
      claim: {
        id: "claim_overstrong"
      },
      facts: [
        {
          id: "fact_pricing"
        }
      ],
      chunks: [
        {
          id: "chunk_pricing"
        }
      ]
    });
    expect(result).toEqual({
      claimId: "claim_overstrong",
      label: "unsupported",
      supportScore: 0.18,
      matchedTokens: ["cursor"],
      missingTokens: ["guarantees", "cheapest"],
      contradictions: [],
      reasons: ["Evidence does not establish cheapest pricing."]
    });
  });
});

describe("compareEntailmentJudges", () => {
  it("compares deterministic and model judges on the same cases", async () => {
    const model = new MockModelClient([
      {
        content: JSON.stringify({
          label: "unsupported",
          supportScore: 0.2,
          matchedTokens: ["cursor"],
          missingTokens: ["guarantees"],
          contradictions: [],
          reasons: ["Model rejects the over-strong qualifier."]
        })
      }
    ]);

    const comparison = await compareEntailmentJudges({
      cases: [
        {
          id: "case_overstrong",
          expectedLabel: "unsupported",
          claim,
          facts,
          chunks
        }
      ],
      judges: [
        createDeterministicEntailmentJudge(),
        createModelEntailmentJudge({ model })
      ]
    });

    expect(comparison).toMatchObject({
      totalCases: 1,
      judges: [
        {
          name: "deterministic",
          passedCases: 1,
          accuracy: 1
        },
        {
          name: "model",
          passedCases: 1,
          accuracy: 1
        }
      ],
      disagreements: []
    });
  });
});
