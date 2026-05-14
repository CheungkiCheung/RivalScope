import type { CreateProjectInput } from "@rivalscope/db";
import { demoDocumentsByUrl, demoSearchIndex } from "./demo-source-fixtures";
import {
  collectFixtureSources,
  type CollectedSource,
  type CollectFixtureSourcesResult
} from "./source-ingestion";

export const seedDemoOwnerEmail = "demo@rivalscope.local";
export const seedDemoProjectName = "RivalScope Top-3 Demo";
export const seedDemoProjectSlug = "rivalscope-top-3-demo";
export const seedDemoMarker = "[demo:repair_lift]";

export interface SeedDemoProjectInput {
  project: CreateProjectInput;
  sources: CollectedSource[];
  toolCalls: CollectFixtureSourcesResult["toolCalls"];
}

export async function buildSeedDemoProjectInput(): Promise<SeedDemoProjectInput> {
  const project = buildSeedDemoProjectDefinition();
  const competitors = project.competitors.map((competitor) => competitor.name);
  const dimensions = project.dimensions.map((dimension) => dimension.key);
  const collected = await collectFixtureSources({
    competitors,
    dimensions,
    searchIndex: demoSearchIndex,
    documentsByUrl: demoDocumentsByUrl,
    maxWordsPerChunk: 80
  });

  return {
    project,
    sources: collected.sources,
    toolCalls: collected.toolCalls
  };
}

export function buildSeedDemoProjectDefinition(): CreateProjectInput {
  return {
    owner: {
      email: seedDemoOwnerEmail,
      name: "RivalScope Demo"
    },
    name: seedDemoProjectName,
    description:
      "Competition-ready RivalScope demo for observable multi-agent competitor intelligence across AI coding tools. " +
      "The seeded corpus is offline and deterministic so judges can reproduce routed research, synthesis gating, " +
      `repair lift, trust snapshots, and evidence export. ${seedDemoMarker}`,
    competitors: [
      {
        name: "Cursor",
        website: "https://cursor.com",
        isPrimary: true
      },
      {
        name: "Codex",
        website: "https://openai.com/codex",
        isPrimary: false
      },
      {
        name: "Trae",
        website: "https://trae.ai",
        isPrimary: false
      }
    ],
    dimensions: [
      {
        key: "pricing",
        label: "Pricing",
        description: "Pricing, packaging, and commercial plan signals.",
        required: true
      },
      {
        key: "positioning",
        label: "Positioning",
        description: "Market narrative, target buyer, and differentiated promise.",
        required: true
      },
      {
        key: "developer_experience",
        label: "Developer Experience",
        description: "Workflow ergonomics, collaboration, review, and delivery experience.",
        required: true
      }
    ]
  };
}
