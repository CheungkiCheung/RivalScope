export type SourceKind = "url" | "markdown" | "pdf" | "text";

export interface Source {
  id: string;
  projectId: string;
  kind: SourceKind;
  title: string;
  uri: string;
  collectedAt: string;
}

export interface SourceChunk {
  id: string;
  sourceId: string;
  ordinal: number;
  text: string;
  tokenCount: number;
}

export interface Fact {
  id: string;
  projectId: string;
  competitorId: string;
  dimension: string;
  statement: string;
  sourceChunkIds: string[];
  confidence: number;
}

export type ClaimKind =
  | "single_competitor"
  | "comparative"
  | "recommendation";

export interface Claim {
  id: string;
  projectId: string;
  dimension: string;
  statement: string;
  factIds: string[];
  confidence: number;
  kind: ClaimKind;
}

export interface EvidenceChain {
  claim: Claim;
  facts: Fact[];
  chunks: SourceChunk[];
  sources: Source[];
}

export interface BuildEvidenceChainInput {
  claim: Claim;
  facts: Fact[];
  chunks: SourceChunk[];
  sources: Source[];
}

export function assertClaimEvidence(claim: Claim, facts: Fact[]): void {
  if (claim.factIds.length === 0) {
    throw new Error(`Claim ${claim.id} must cite at least one fact`);
  }

  const factIds = new Set(facts.map((fact) => fact.id));

  for (const factId of claim.factIds) {
    if (!factIds.has(factId)) {
      throw new Error(`Claim ${claim.id} cites unknown fact ${factId}`);
    }
  }
}

export function buildEvidenceChain(
  input: BuildEvidenceChainInput
): EvidenceChain {
  assertClaimEvidence(input.claim, input.facts);

  const factIdSet = new Set(input.claim.factIds);
  const facts = input.facts.filter((fact) => factIdSet.has(fact.id));
  const chunkIdSet = new Set(
    facts.flatMap((fact) => fact.sourceChunkIds)
  );
  const chunks = input.chunks.filter((chunk) => chunkIdSet.has(chunk.id));
  const sourceIdSet = new Set(chunks.map((chunk) => chunk.sourceId));
  const sources = input.sources.filter((source) => sourceIdSet.has(source.id));

  assertFactsHaveChunks(facts, input.chunks);
  assertChunksHaveSources(chunks, input.sources);

  return {
    claim: input.claim,
    facts,
    chunks,
    sources
  };
}

function assertFactsHaveChunks(facts: Fact[], chunks: SourceChunk[]): void {
  const chunkIds = new Set(chunks.map((chunk) => chunk.id));

  for (const fact of facts) {
    if (fact.sourceChunkIds.length === 0) {
      throw new Error(`Fact ${fact.id} must cite at least one source chunk`);
    }

    for (const chunkId of fact.sourceChunkIds) {
      if (!chunkIds.has(chunkId)) {
        throw new Error(`Fact ${fact.id} cites unknown chunk ${chunkId}`);
      }
    }
  }
}

function assertChunksHaveSources(chunks: SourceChunk[], sources: Source[]): void {
  const sourceIds = new Set(sources.map((source) => source.id));

  for (const chunk of chunks) {
    if (!sourceIds.has(chunk.sourceId)) {
      throw new Error(`Chunk ${chunk.id} cites unknown source ${chunk.sourceId}`);
    }
  }
}
