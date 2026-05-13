import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runGoldenEvaluations } from "./index";
import { parseGoldenEvaluationCases } from "./golden-fixture";

const DEFAULT_FIXTURE_PATH = new URL(
  "../fixtures/golden-trajectories.json",
  import.meta.url
);

async function main(): Promise<void> {
  const fixturePath = process.argv[2] ?? fileURLToPath(DEFAULT_FIXTURE_PATH);
  const rawFixture = await readFile(fixturePath, "utf8");
  const cases = parseGoldenEvaluationCases(JSON.parse(rawFixture));
  const summary = runGoldenEvaluations(cases);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  if (!summary.passed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Failed to run golden evaluations: ${message}\n`);
  process.exitCode = 1;
});
