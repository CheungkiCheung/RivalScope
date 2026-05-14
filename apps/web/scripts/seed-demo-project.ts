import {
  ProjectRepository,
  SourceRepository,
  WorkflowRepository,
  prisma
} from "@rivalscope/db";
import {
  buildSeedDemoProjectInput,
  seedDemoOwnerEmail,
  seedDemoProjectName
} from "../lib/demo-project-seed";
import { persistSourceCollectionRun } from "../lib/source-collection-persistence";

const defaultBaseUrl = "http://localhost:3100";

async function main() {
  assertDatabaseUrl();

  const input = await buildSeedDemoProjectInput();

  await prisma.project.deleteMany({
    where: {
      name: seedDemoProjectName,
      owner: {
        email: seedDemoOwnerEmail
      }
    }
  });

  const project = await new ProjectRepository(prisma).create(input.project);
  const sourceRepository = new SourceRepository(prisma);

  for (const source of input.sources) {
    await sourceRepository.create({
      projectId: project.id,
      kind: source.kind,
      title: source.title,
      uri: source.uri,
      chunks: source.chunks
    });
  }

  await persistSourceCollectionRun({
    projectId: project.id,
    sourceCount: input.sources.length,
    toolCalls: input.toolCalls,
    repositories: {
      workflow: new WorkflowRepository(prisma)
    }
  });

  const baseUrl = normalizeBaseUrl(process.env.RIVALSCOPE_BASE_URL ?? defaultBaseUrl);
  const projectUrl = `${baseUrl}/projects/${project.id}`;

  console.log(`Seeded demo project: ${project.name}`);
  console.log(`Project id: ${project.id}`);
  console.log(`Project URL: ${projectUrl}`);
  console.log(`Run analysis URL: ${projectUrl}`);
  console.log(`Markdown export URL: ${projectUrl}/export?format=markdown`);
  console.log(`JSON export URL: ${projectUrl}/export?format=json`);
}

function assertDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required. Example: DATABASE_URL=\"postgresql://postgres:postgres@localhost:15432/rivalscope?schema=public\" npm run demo:seed"
    );
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
