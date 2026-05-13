# Claim Trust Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first judge-visible trust surface: deterministic claim trust scoring, project-page Claim Trust Graph, and a thin Agent Collaboration Trace connected to the current workflow records.

**Architecture:** Add claim-level scoring in `@rivalscope/evals`, then build a web summary layer that maps Prisma report data into claim trust nodes. Render the result on the project page without changing database schema. Use the existing workflow node and agent run records for the first thin collaboration trace.

**Tech Stack:** TypeScript, Vitest, Next.js server components, Prisma read models, existing `@rivalscope/core` evidence types, existing `@rivalscope/evals` package.

---

## Files

- Create: `packages/evals/src/claim-trust.ts`
- Create: `packages/evals/src/claim-trust.test.ts`
- Modify: `packages/evals/src/index.ts`
- Create: `apps/web/lib/project-claim-trust.ts`
- Create: `apps/web/lib/project-claim-trust.test.ts`
- Modify: `apps/web/app/projects/[projectId]/page.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `docs/top3-execution-harness.md`
- Modify: `docs/next-stage-plan.md`

No database migration is needed in Phase 1. Persisted trust snapshots can come later after the scoring model stabilizes.

## Scoring Formula

Use this deterministic v1 formula:

```text
ClaimTrust =
  30% Citation Validity
+ 25% Evidence Strength
+ 20% Source Traceability
+ 15% Fact Confidence
+ 10% Source Diversity
- Penalties
```

Risk levels:

```text
score >= 85 -> low
score >= 65 -> medium
otherwise -> high
```

Penalty rules:

- `no_cited_facts`: -35
- `unknown_fact`: -30
- `fact_without_source_chunks`: -25
- `unknown_source_chunk`: -20
- `chunk_without_source`: -20
- `low_fact_confidence`: -10 when average fact confidence is below `0.7`
- `single_source`: -8 when a claim has evidence but all evidence traces to one source

Clamp final score to `[0, 100]`.

Deduplication rule:

- Unique fact ids, chunk ids, and source ids count once.
- Repeated links must not increase evidence strength or diversity.

## Task 1: Add Claim Trust Evaluator

**Files:**
- Create: `packages/evals/src/claim-trust.ts`
- Create: `packages/evals/src/claim-trust.test.ts`
- Modify: `packages/evals/src/index.ts`

- [ ] **Step 1: Write failing tests for high-trust, low-trust, and dedupe behavior**

Add `packages/evals/src/claim-trust.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateClaimTrust } from "./claim-trust";

const sources = [
  {
    id: "source_1",
    projectId: "project_1",
    kind: "url" as const,
    title: "Cursor pricing",
    uri: "https://cursor.com/pricing",
    collectedAt: "2026-05-13T00:00:00.000Z"
  },
  {
    id: "source_2",
    projectId: "project_1",
    kind: "url" as const,
    title: "Cursor docs",
    uri: "https://cursor.com/docs",
    collectedAt: "2026-05-13T00:00:00.000Z"
  }
];

const chunks = [
  {
    id: "chunk_1",
    sourceId: "source_1",
    ordinal: 0,
    text: "Cursor offers paid plans.",
    tokenCount: 5
  },
  {
    id: "chunk_2",
    sourceId: "source_2",
    ordinal: 0,
    text: "Cursor supports agentic coding workflows.",
    tokenCount: 6
  }
];

const facts = [
  {
    id: "fact_1",
    projectId: "project_1",
    competitorId: "competitor_cursor",
    dimension: "pricing",
    statement: "Cursor offers paid plans.",
    sourceChunkIds: ["chunk_1"],
    confidence: 0.92
  },
  {
    id: "fact_2",
    projectId: "project_1",
    competitorId: "competitor_cursor",
    dimension: "product_capabilities",
    statement: "Cursor supports agentic coding workflows.",
    sourceChunkIds: ["chunk_2"],
    confidence: 0.88
  }
];

describe("evaluateClaimTrust", () => {
  it("scores a well-supported multi-source claim as low risk", () => {
    const result = evaluateClaimTrust({
      claim: {
        id: "claim_1",
        projectId: "project_1",
        dimension: "product_capabilities",
        statement: "Cursor combines paid plans with agentic coding workflows.",
        factIds: ["fact_1", "fact_2"],
        confidence: 0.86,
        kind: "single_competitor"
      },
      facts,
      chunks,
      sources
    });

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.riskLevel).toBe("low");
    expect(result.metrics).toMatchObject({
      citedFactCount: 2,
      validFactCount: 2,
      sourceChunkCount: 2,
      sourceCount: 2,
      sourceDiversity: 1
    });
    expect(result.penalties).toEqual([]);
  });

  it("scores unsupported and unknown references as high risk", () => {
    const result = evaluateClaimTrust({
      claim: {
        id: "claim_2",
        projectId: "project_1",
        dimension: "pricing",
        statement: "Cursor has the cheapest enterprise plan.",
        factIds: ["fact_missing"],
        confidence: 0.9,
        kind: "comparative"
      },
      facts,
      chunks,
      sources
    });

    expect(result.score).toBeLessThan(65);
    expect(result.riskLevel).toBe("high");
    expect(result.penalties).toContainEqual({
      code: "unknown_fact",
      points: 30,
      message: "Claim claim_2 cites unknown fact fact_missing."
    });
  });

  it("does not let duplicate facts or chunks inflate trust", () => {
    const result = evaluateClaimTrust({
      claim: {
        id: "claim_3",
        projectId: "project_1",
        dimension: "pricing",
        statement: "Cursor offers paid plans.",
        factIds: ["fact_1", "fact_1"],
        confidence: 0.84,
        kind: "single_competitor"
      },
      facts: [
        {
          ...facts[0]!,
          sourceChunkIds: ["chunk_1", "chunk_1"]
        }
      ],
      chunks,
      sources
    });

    expect(result.metrics).toMatchObject({
      citedFactCount: 1,
      validFactCount: 1,
      sourceChunkCount: 1,
      sourceCount: 1
    });
    expect(result.penalties).toContainEqual({
      code: "single_source",
      points: 8,
      message: "Claim claim_3 is supported by only one unique source."
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- packages/evals/src/claim-trust.test.ts
```

Expected: fail because `./claim-trust` does not exist.

- [ ] **Step 3: Implement the evaluator**

Add `packages/evals/src/claim-trust.ts`:

```ts
import type { Claim, Fact, Source, SourceChunk } from "@rivalscope/core";

export type ClaimTrustRiskLevel = "low" | "medium" | "high";

export type ClaimTrustPenaltyCode =
  | "no_cited_facts"
  | "unknown_fact"
  | "fact_without_source_chunks"
  | "unknown_source_chunk"
  | "chunk_without_source"
  | "low_fact_confidence"
  | "single_source";

export interface ClaimTrustPenalty {
  code: ClaimTrustPenaltyCode;
  points: number;
  message: string;
}

export interface ClaimTrustMetrics {
  citationValidity: number;
  evidenceStrength: number;
  sourceTraceability: number;
  factConfidence: number;
  sourceDiversity: number;
  citedFactCount: number;
  validFactCount: number;
  sourceChunkCount: number;
  sourceCount: number;
}

export interface ClaimTrustResult {
  claimId: string;
  dimension: string;
  score: number;
  riskLevel: ClaimTrustRiskLevel;
  metrics: ClaimTrustMetrics;
  penalties: ClaimTrustPenalty[];
  reasons: string[];
  factIds: string[];
  sourceChunkIds: string[];
  sourceIds: string[];
}

export interface EvaluateClaimTrustInput {
  claim: Claim;
  facts: Fact[];
  chunks: SourceChunk[];
  sources: Source[];
}

export function evaluateClaimTrust(input: EvaluateClaimTrustInput): ClaimTrustResult {
  const factById = new Map(input.facts.map((fact) => [fact.id, fact]));
  const chunkById = new Map(input.chunks.map((chunk) => [chunk.id, chunk]));
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const citedFactIds = unique(input.claim.factIds);
  const validFacts = citedFactIds
    .map((factId) => factById.get(factId))
    .filter((fact): fact is Fact => fact !== undefined);
  const validFactIds = validFacts.map((fact) => fact.id);
  const sourceChunkIds = unique(validFacts.flatMap((fact) => fact.sourceChunkIds));
  const validChunks = sourceChunkIds
    .map((chunkId) => chunkById.get(chunkId))
    .filter((chunk): chunk is SourceChunk => chunk !== undefined);
  const sourceIds = unique(validChunks.map((chunk) => chunk.sourceId));
  const validSources = sourceIds
    .map((sourceId) => sourceById.get(sourceId))
    .filter((source): source is Source => source !== undefined);
  const penalties = buildPenalties({
    claim: input.claim,
    citedFactIds,
    validFacts,
    sourceChunkIds,
    validChunks,
    sourceIds,
    validSources,
    factById,
    chunkById,
    sourceById
  });
  const metrics: ClaimTrustMetrics = {
    citationValidity: ratio(validFactIds.length, citedFactIds.length),
    evidenceStrength: Math.min(1, validFactIds.length / 2),
    sourceTraceability: ratio(validSources.length, sourceIds.length),
    factConfidence:
      validFacts.length === 0
        ? 0
        : average(validFacts.map((fact) => clamp01(fact.confidence))),
    sourceDiversity: Math.min(1, validSources.length / 2),
    citedFactCount: citedFactIds.length,
    validFactCount: validFactIds.length,
    sourceChunkCount: validChunks.length,
    sourceCount: validSources.length
  };
  const weightedScore =
    metrics.citationValidity * 30 +
    metrics.evidenceStrength * 25 +
    metrics.sourceTraceability * 20 +
    metrics.factConfidence * 15 +
    metrics.sourceDiversity * 10;
  const penaltyPoints = penalties.reduce((total, penalty) => total + penalty.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(weightedScore - penaltyPoints)));

  return {
    claimId: input.claim.id,
    dimension: input.claim.dimension,
    score,
    riskLevel: toRiskLevel(score),
    metrics,
    penalties,
    reasons: buildReasons(metrics, penalties),
    factIds: validFactIds,
    sourceChunkIds: validChunks.map((chunk) => chunk.id),
    sourceIds: validSources.map((source) => source.id)
  };
}

function buildPenalties(input: {
  claim: Claim;
  citedFactIds: string[];
  validFacts: Fact[];
  sourceChunkIds: string[];
  validChunks: SourceChunk[];
  sourceIds: string[];
  validSources: Source[];
  factById: Map<string, Fact>;
  chunkById: Map<string, SourceChunk>;
  sourceById: Map<string, Source>;
}): ClaimTrustPenalty[] {
  const penalties: ClaimTrustPenalty[] = [];

  if (input.citedFactIds.length === 0) {
    penalties.push({
      code: "no_cited_facts",
      points: 35,
      message: `Claim ${input.claim.id} has no cited facts.`
    });
  }

  for (const factId of input.citedFactIds) {
    if (!input.factById.has(factId)) {
      penalties.push({
        code: "unknown_fact",
        points: 30,
        message: `Claim ${input.claim.id} cites unknown fact ${factId}.`
      });
    }
  }

  for (const fact of input.validFacts) {
    if (fact.sourceChunkIds.length === 0) {
      penalties.push({
        code: "fact_without_source_chunks",
        points: 25,
        message: `Fact ${fact.id} has no source chunks.`
      });
    }

    for (const chunkId of unique(fact.sourceChunkIds)) {
      if (!input.chunkById.has(chunkId)) {
        penalties.push({
          code: "unknown_source_chunk",
          points: 20,
          message: `Fact ${fact.id} cites unknown source chunk ${chunkId}.`
        });
      }
    }
  }

  for (const chunk of input.validChunks) {
    if (!input.sourceById.has(chunk.sourceId)) {
      penalties.push({
        code: "chunk_without_source",
        points: 20,
        message: `Chunk ${chunk.id} cites unknown source ${chunk.sourceId}.`
      });
    }
  }

  const averageConfidence =
    input.validFacts.length === 0
      ? 0
      : average(input.validFacts.map((fact) => clamp01(fact.confidence)));

  if (input.validFacts.length > 0 && averageConfidence < 0.7) {
    penalties.push({
      code: "low_fact_confidence",
      points: 10,
      message: `Claim ${input.claim.id} has average fact confidence below 70%.`
    });
  }

  if (input.validFacts.length > 0 && input.validSources.length === 1) {
    penalties.push({
      code: "single_source",
      points: 8,
      message: `Claim ${input.claim.id} is supported by only one unique source.`
    });
  }

  return penalties;
}

function buildReasons(
  metrics: ClaimTrustMetrics,
  penalties: ClaimTrustPenalty[]
): string[] {
  const reasons = [
    `${metrics.validFactCount}/${metrics.citedFactCount} cited facts are valid.`,
    `${metrics.sourceChunkCount} source chunks trace to ${metrics.sourceCount} sources.`,
    `Average fact confidence is ${Math.round(metrics.factConfidence * 100)}%.`
  ];

  if (penalties.length === 0) {
    return [...reasons, "No trust penalties were applied."];
  }

  return [...reasons, ...penalties.map((penalty) => penalty.message)];
}

function toRiskLevel(score: number): ClaimTrustRiskLevel {
  if (score >= 85) {
    return "low";
  }

  if (score >= 65) {
    return "medium";
  }

  return "high";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
```

Update `packages/evals/src/index.ts`:

```ts
export * from "./trajectory-eval";
export * from "./golden-runner";
export * from "./golden-fixture";
export * from "./claim-trust";
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- packages/evals/src/claim-trust.test.ts
```

Expected: pass.

## Task 2: Add Project Claim Trust Summary

**Files:**
- Create: `apps/web/lib/project-claim-trust.ts`
- Create: `apps/web/lib/project-claim-trust.test.ts`

- [ ] **Step 1: Write failing web summary tests**

Add `apps/web/lib/project-claim-trust.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- apps/web/lib/project-claim-trust.test.ts
```

Expected: fail because `project-claim-trust.ts` does not exist.

- [ ] **Step 3: Implement the summary builder**

Add `apps/web/lib/project-claim-trust.ts`:

```ts
import type { ClaimKind, SourceKind } from "@prisma/client";
import type {
  Claim,
  ClaimKind as CoreClaimKind,
  Fact,
  Source,
  SourceChunk
} from "@rivalscope/core";
import {
  evaluateClaimTrust,
  type ClaimTrustResult,
  type ClaimTrustRiskLevel
} from "@rivalscope/evals";

export interface ProjectClaimTrustSource {
  id: string;
  projectId: string;
  kind: SourceKind;
  title: string;
  uri: string;
  collectedAt: Date;
  chunks: ProjectClaimTrustSourceChunk[];
}

export interface ProjectClaimTrustSourceChunk {
  id: string;
  sourceId: string;
  ordinal: number;
  text: string;
  tokenCount: number;
}

export interface ProjectClaimTrustReportSection {
  id: string;
  title: string;
  claims: Array<{
    claim: ProjectClaimTrustClaim;
  }>;
}

export interface ProjectClaimTrustClaim {
  id: string;
  projectId: string;
  dimension: string;
  statement: string;
  confidence: number;
  kind: ClaimKind;
  facts: Array<{
    fact: ProjectClaimTrustFact;
  }>;
}

export interface ProjectClaimTrustFact {
  id: string;
  projectId: string;
  competitorId: string;
  dimension: string;
  statement: string;
  confidence: number;
  competitor: {
    name: string;
  };
  chunks: Array<{ chunkId: string }>;
}

export interface ProjectClaimTrustNode {
  claimId: string;
  statement: string;
  dimension: string;
  sectionId: string;
  sectionTitle: string;
  score: number;
  riskLevel: ClaimTrustRiskLevel;
  metrics: ClaimTrustResult["metrics"];
  penalties: ClaimTrustResult["penalties"];
  reasons: string[];
  facts: Array<{
    id: string;
    statement: string;
    dimension: string;
    confidence: number;
    competitorName: string;
  }>;
  chunks: Array<{
    id: string;
    text: string;
    sourceId: string;
  }>;
  sources: Array<{
    id: string;
    title: string;
    uri: string;
  }>;
}

export interface ProjectClaimTrustSummary {
  status: "not_started" | "ready";
  averageScore: number | null;
  nodes: ProjectClaimTrustNode[];
}

export interface BuildProjectClaimTrustSummaryInput {
  sources: ProjectClaimTrustSource[];
  reportSections: ProjectClaimTrustReportSection[];
}

export function buildProjectClaimTrustSummary(
  input: BuildProjectClaimTrustSummaryInput
): ProjectClaimTrustSummary {
  if (input.reportSections.length === 0) {
    return {
      status: "not_started",
      averageScore: null,
      nodes: []
    };
  }

  const sources = input.sources.map(toCoreSource);
  const chunks = input.sources.flatMap((source) => source.chunks.map(toCoreChunk));
  const nodes = input.reportSections.flatMap((section) =>
    section.claims.map((link) =>
      buildNode({
        section,
        claim: link.claim,
        sources,
        chunks
      })
    )
  );

  return {
    status: "ready",
    averageScore:
      nodes.length === 0
        ? null
        : Math.round(
            nodes.reduce((total, node) => total + node.score, 0) / nodes.length
          ),
    nodes
  };
}

function buildNode(input: {
  section: ProjectClaimTrustReportSection;
  claim: ProjectClaimTrustClaim;
  sources: Source[];
  chunks: SourceChunk[];
}): ProjectClaimTrustNode {
  const claim = toCoreClaim(input.claim);
  const facts = uniqueById(input.claim.facts.map((link) => toCoreFact(link.fact)));
  const trust = evaluateClaimTrust({
    claim,
    facts,
    chunks: input.chunks,
    sources: input.sources
  });
  const chunkById = new Map(input.chunks.map((chunk) => [chunk.id, chunk]));
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const trustedChunks = trust.sourceChunkIds
    .map((chunkId) => chunkById.get(chunkId))
    .filter((chunk): chunk is SourceChunk => chunk !== undefined);
  const trustedSources = trust.sourceIds
    .map((sourceId) => sourceById.get(sourceId))
    .filter((source): source is Source => source !== undefined);

  return {
    claimId: input.claim.id,
    statement: input.claim.statement,
    dimension: input.claim.dimension,
    sectionId: input.section.id,
    sectionTitle: input.section.title,
    score: trust.score,
    riskLevel: trust.riskLevel,
    metrics: trust.metrics,
    penalties: trust.penalties,
    reasons: trust.reasons,
    facts: uniqueById(input.claim.facts.map((link) => link.fact)).map((fact) => ({
      id: fact.id,
      statement: fact.statement,
      dimension: fact.dimension,
      confidence: fact.confidence,
      competitorName: fact.competitor.name
    })),
    chunks: trustedChunks.map((chunk) => ({
      id: chunk.id,
      text: chunk.text,
      sourceId: chunk.sourceId
    })),
    sources: trustedSources.map((source) => ({
      id: source.id,
      title: source.title,
      uri: source.uri
    }))
  };
}

function toCoreSource(source: ProjectClaimTrustSource): Source {
  return {
    id: source.id,
    projectId: source.projectId,
    kind: source.kind.toLowerCase() as Source["kind"],
    title: source.title,
    uri: source.uri,
    collectedAt: source.collectedAt.toISOString()
  };
}

function toCoreChunk(chunk: ProjectClaimTrustSourceChunk): SourceChunk {
  return {
    id: chunk.id,
    sourceId: chunk.sourceId,
    ordinal: chunk.ordinal,
    text: chunk.text,
    tokenCount: chunk.tokenCount
  };
}

function toCoreClaim(claim: ProjectClaimTrustClaim): Claim {
  return {
    id: claim.id,
    projectId: claim.projectId,
    dimension: claim.dimension,
    statement: claim.statement,
    factIds: claim.facts.map((link) => link.fact.id),
    confidence: claim.confidence,
    kind: toCoreClaimKind(claim.kind)
  };
}

function toCoreFact(fact: ProjectClaimTrustFact): Fact {
  return {
    id: fact.id,
    projectId: fact.projectId,
    competitorId: fact.competitorId,
    dimension: fact.dimension,
    statement: fact.statement,
    sourceChunkIds: fact.chunks.map((chunkLink) => chunkLink.chunkId),
    confidence: fact.confidence
  };
}

function toCoreClaimKind(kind: ClaimKind): CoreClaimKind {
  switch (kind) {
    case "COMPARATIVE":
      return "comparative";
    case "RECOMMENDATION":
      return "recommendation";
    case "SINGLE_COMPETITOR":
      return "single_competitor";
    default:
      return assertNever(kind);
  }
}

function uniqueById<T extends { id: string }>(values: T[]): T[] {
  const seen = new Set<string>();
  const uniqueValues: T[] = [];

  for (const value of values) {
    if (seen.has(value.id)) {
      continue;
    }

    seen.add(value.id);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported claim kind: ${String(value)}`);
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- apps/web/lib/project-claim-trust.test.ts
```

Expected: pass.

## Task 3: Render Claim Trust Graph And Thin Agent Trace

**Files:**
- Modify: `apps/web/app/projects/[projectId]/page.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Import and build trust summary**

In `apps/web/app/projects/[projectId]/page.tsx`, add:

```ts
import { buildProjectClaimTrustSummary } from "../../../lib/project-claim-trust";
```

After `evalSummary`, add:

```ts
  const claimTrustSummary = buildProjectClaimTrustSummary({
    sources: project.sources,
    reportSections
  });
```

- [ ] **Step 2: Add summary metric**

In the metrics section, add:

```tsx
        <div className="metric">
          <span className="metric-label">Claim Trust</span>
          <strong>{claimTrustSummary.averageScore ?? "—"}</strong>
        </div>
```

- [ ] **Step 3: Add Claim Trust Graph panel**

Add this card inside the right-side `<aside className="grid">`, preferably directly after `Trajectory Eval`:

```tsx
          <section className="card">
            <h3>Claim Trust Graph</h3>
            {claimTrustSummary.status === "not_started" ? (
              <p className="muted">No claims to score yet.</p>
            ) : (
              <div className="list">
                {claimTrustSummary.nodes.map((node) => (
                  <div className="item trust-node" key={node.claimId}>
                    <div className="item-head">
                      <strong>{node.dimension}</strong>
                      <span className={`status ${riskClass(node.riskLevel)}`}>
                        {node.score} · {node.riskLevel}
                      </span>
                    </div>
                    <p>{node.statement}</p>
                    <span className="muted">{node.sectionTitle}</span>
                    <div className="trust-chain">
                      <span>{node.facts.length} facts</span>
                      <span>{node.chunks.length} chunks</span>
                      <span>{node.sources.length} sources</span>
                    </div>
                    <div className="evidence-facts">
                      {node.facts.map((fact) => (
                        <div className="evidence-fact" key={fact.id}>
                          <span className="pill">{fact.dimension}</span>
                          <p>{fact.statement}</p>
                          <span className="muted">
                            {fact.competitorName} · confidence{" "}
                            {Math.round(fact.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pill-row">
                      {node.sources.map((source) => (
                        <span className="pill" key={source.id}>
                          {source.title}
                        </span>
                      ))}
                    </div>
                    {node.penalties.length > 0 ? (
                      <div className="list compact-list">
                        {node.penalties.map((penalty) => (
                          <div className="item compact-item" key={penalty.message}>
                            <strong>{penalty.code}</strong>
                            <p className="muted">
                              -{penalty.points}: {penalty.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
```

- [ ] **Step 4: Rename workflow card into Agent Collaboration Trace**

Change the existing `Workflow run` card title to:

```tsx
            <h3>Agent Collaboration Trace</h3>
```

Inside each node item, add this small quality gate line after tool/model call counts:

```tsx
                          <span className="muted">
                            handoff {node.inputArtifactIds.length} in /{" "}
                            {node.outputArtifactIds.length} out
                          </span>
```

- [ ] **Step 5: Add risk class helper**

Near `statusClass`, add:

```ts
function riskClass(riskLevel: string) {
  if (riskLevel === "low") {
    return "ok";
  }

  if (riskLevel === "medium") {
    return "warn";
  }

  return "bad";
}
```

- [ ] **Step 6: Add CSS**

In `apps/web/app/globals.css`, add:

```css
.trust-node {
  gap: 12px;
}

.trust-chain {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.trust-chain span {
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted);
  font-size: 12px;
  padding: 8px;
  text-align: center;
}

.compact-list {
  gap: 8px;
}
```

- [ ] **Step 7: Run typecheck and focused UI-adjacent tests**

Run:

```bash
npm run typecheck
npm test -- apps/web/lib/project-claim-trust.test.ts apps/web/lib/project-eval-summary.test.ts
```

Expected: pass.

## Task 4: Document Phase 1 Completion

**Files:**
- Modify: `docs/top3-execution-harness.md`
- Modify: `docs/next-stage-plan.md`

- [ ] **Step 1: Update status after implementation**

Only after Tasks 1-3 pass, update Phase 1/Updated Stage 1 status to say:

```text
Status: implemented for deterministic scoring and first web surface.
```

Add a short limitation note:

```text
Current limitation: Claim Trust v1 is deterministic and structural. Semantic support checking and critic-impact penalties arrive in later phases.
```

- [ ] **Step 2: Run doc diff check**

Run:

```bash
git diff -- docs/top3-execution-harness.md docs/next-stage-plan.md
```

Expected: docs mention implemented status only if code/tests are done.

## Task 5: Full Verification Gate

**Files:**
- No new edits unless verification exposes a real issue.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run typecheck
npm test
npm run eval:golden
DATABASE_URL="postgresql://postgres:postgres@localhost:15432/rivalscope?schema=public" npm run db:validate --workspace @rivalscope/db
npm run build --workspace @rivalscope/web
git diff --check
npm audit --audit-level=high
```

Expected:

- Typecheck passes.
- Tests pass.
- Golden eval passes.
- Prisma validation passes.
- Web build passes.
- Diff check passes.
- Audit exits 0. It may still report the known moderate Next/PostCSS advisory; do not run `npm audit fix --force`.

- [ ] **Step 2: Optional local page verification**

If a local database and demo project exist, run:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:15432/rivalscope?schema=public" npm run dev --workspace @rivalscope/web -- --port 3100
```

Then fetch a known project page:

```bash
curl -sS -o /tmp/rivalscope_project.html -w "%{http_code}\n" http://localhost:3100/projects/<projectId>
rg "Claim Trust Graph|Agent Collaboration Trace|Claim Trust" /tmp/rivalscope_project.html
```

Expected: HTTP `200` and all new labels are present.

## Self-Review Checklist

- [ ] The evaluator is deterministic and offline.
- [ ] Claim trust scores do not require a real LLM or search provider.
- [ ] Duplicate fact/chunk/source links do not inflate trust.
- [ ] Unknown references create penalties instead of silent acceptance.
- [ ] UI exposes claim score, risk level, facts, chunks, and sources.
- [ ] Thin Agent Collaboration Trace is visible before full routed DAG work.
- [ ] No database migration was added for Phase 1.
- [ ] Docs do not claim semantic grounding or repair-loop completion before those phases ship.
