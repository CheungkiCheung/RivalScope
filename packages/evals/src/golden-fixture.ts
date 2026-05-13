import { z } from "zod";
import type { GoldenEvaluationCase } from "./golden-runner";

const claimKindSchema = z.enum([
  "single_competitor",
  "comparative",
  "recommendation"
]);

const findingCategorySchema = z.enum([
  "unsupported_claim",
  "unknown_fact",
  "missing_dimension"
]);

const factSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  competitorId: z.string().min(1),
  dimension: z.string().min(1),
  statement: z.string().min(1),
  sourceChunkIds: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1)
}).strict();

const claimSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  dimension: z.string().min(1),
  statement: z.string().min(1),
  factIds: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  kind: claimKindSchema
}).strict();

const goldenEvaluationCaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  minScore: z.number().int().min(0).max(100),
  expectedScore: z.number().int().min(0).max(100).optional(),
  expectedFindingCategories: z.array(findingCategorySchema).optional(),
  requiredDimensions: z.array(z.string().min(1)),
  facts: z.array(factSchema),
  claims: z.array(claimSchema)
}).strict();

const goldenEvaluationCasesSchema = z.array(goldenEvaluationCaseSchema);

export function parseGoldenEvaluationCases(
  input: unknown
): GoldenEvaluationCase[] {
  return goldenEvaluationCasesSchema.parse(input).map((goldenCase) => {
    const normalizedCase: GoldenEvaluationCase = {
      id: goldenCase.id,
      name: goldenCase.name,
      minScore: goldenCase.minScore,
      requiredDimensions: goldenCase.requiredDimensions,
      facts: goldenCase.facts,
      claims: goldenCase.claims
    };

    if (goldenCase.expectedScore !== undefined) {
      normalizedCase.expectedScore = goldenCase.expectedScore;
    }

    if (goldenCase.expectedFindingCategories !== undefined) {
      normalizedCase.expectedFindingCategories =
        goldenCase.expectedFindingCategories;
    }

    return normalizedCase;
  });
}
