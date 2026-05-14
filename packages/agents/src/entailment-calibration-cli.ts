import type { ModelProviderEnv } from "./model-client";
import { createEntailmentCalibrationCliPayload } from "./entailment-calibration-runner";

async function main(): Promise<void> {
  const payload = await createEntailmentCalibrationCliPayload({
    env: readCalibrationEnv()
  });

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = payload.exitCode;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Failed to run entailment judge calibration: ${message}\n`);
  process.exitCode = 1;
});

function readCalibrationEnv(): ModelProviderEnv & {
  RIVALSCOPE_ENABLE_MODEL_ENTAILMENT_JUDGE?: string;
} {
  return {
    ...(process.env.RIVALSCOPE_MODEL_PROVIDER
      ? { RIVALSCOPE_MODEL_PROVIDER: process.env.RIVALSCOPE_MODEL_PROVIDER }
      : {}),
    ...(process.env.OPENAI_COMPATIBLE_API_KEY
      ? { OPENAI_COMPATIBLE_API_KEY: process.env.OPENAI_COMPATIBLE_API_KEY }
      : {}),
    ...(process.env.OPENAI_COMPATIBLE_MODEL
      ? { OPENAI_COMPATIBLE_MODEL: process.env.OPENAI_COMPATIBLE_MODEL }
      : {}),
    ...(process.env.OPENAI_COMPATIBLE_BASE_URL
      ? { OPENAI_COMPATIBLE_BASE_URL: process.env.OPENAI_COMPATIBLE_BASE_URL }
      : {}),
    ...(process.env.MIMO_API_KEY ? { MIMO_API_KEY: process.env.MIMO_API_KEY } : {}),
    ...(process.env.MIMO_MODEL ? { MIMO_MODEL: process.env.MIMO_MODEL } : {}),
    ...(process.env.MIMO_BASE_URL ? { MIMO_BASE_URL: process.env.MIMO_BASE_URL } : {}),
    ...(process.env.RIVALSCOPE_ENABLE_MODEL_ENTAILMENT_JUDGE
      ? {
          RIVALSCOPE_ENABLE_MODEL_ENTAILMENT_JUDGE:
            process.env.RIVALSCOPE_ENABLE_MODEL_ENTAILMENT_JUDGE
        }
      : {})
  };
}
