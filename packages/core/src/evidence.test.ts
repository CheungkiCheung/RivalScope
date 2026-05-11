import { describe, expect, it } from "vitest";
import {
  assertClaimEvidence,
  buildEvidenceChain,
  type Claim,
  type Fact,
  type Source,
  type SourceChunk
} from "./evidence";

const source: Source = {
  id: "src_1",
  projectId: "project_1",
  kind: "url",
  title: "Cursor pricing",
  uri: "https://cursor.com/pricing",
  collectedAt: "2026-05-11T00:00:00.000Z"
};

const chunk: SourceChunk = {
  id: "chunk_1",
  sourceId: "src_1",
  ordinal: 0,
  text: "Cursor offers individual and team plans.",
  tokenCount: 8
};

const fact: Fact = {
  id: "fact_1",
  projectId: "project_1",
  competitorId: "cursor",
  dimension: "pricing",
  statement: "Cursor offers individual and team plans.",
  sourceChunkIds: ["chunk_1"],
  confidence: 0.9
};

describe("evidence tracing", () => {
  it("rejects claims that do not cite any facts", () => {
    const claim: Claim = {
      id: "claim_1",
      projectId: "project_1",
      dimension: "pricing",
      statement: "Cursor has multiple plan types.",
      factIds: [],
      confidence: 0.8,
      kind: "single_competitor"
    };

    expect(() => assertClaimEvidence(claim, [fact])).toThrow(
      "Claim claim_1 must cite at least one fact"
    );
  });

  it("rejects claims that cite unknown facts", () => {
    const claim: Claim = {
      id: "claim_1",
      projectId: "project_1",
      dimension: "pricing",
      statement: "Cursor has multiple plan types.",
      factIds: ["fact_missing"],
      confidence: 0.8,
      kind: "single_competitor"
    };

    expect(() => assertClaimEvidence(claim, [fact])).toThrow(
      "Claim claim_1 cites unknown fact fact_missing"
    );
  });

  it("builds a source-to-claim evidence chain", () => {
    const claim: Claim = {
      id: "claim_1",
      projectId: "project_1",
      dimension: "pricing",
      statement: "Cursor has multiple plan types.",
      factIds: ["fact_1"],
      confidence: 0.8,
      kind: "single_competitor"
    };

    const chain = buildEvidenceChain({
      claim,
      facts: [fact],
      chunks: [chunk],
      sources: [source]
    });

    expect(chain.claim.id).toBe("claim_1");
    expect(chain.facts).toHaveLength(1);
    expect(chain.chunks).toHaveLength(1);
    expect(chain.sources).toHaveLength(1);
    expect(chain.sources[0]?.uri).toBe("https://cursor.com/pricing");
  });
});
