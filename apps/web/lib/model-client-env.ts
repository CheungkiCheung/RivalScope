import {
  createModelClientFromEnv,
  type AnalysisWorkflowAgentOptions,
  type ModelClient
} from "@rivalscope/agents";

export function createAnalysisAgentOptionsFromEnv(
  env: Record<string, string | undefined>
): AnalysisWorkflowAgentOptions {
  const mode = env.RIVALSCOPE_ANALYSIS_AGENT_MODE?.trim().toLowerCase() || "mock";

  if (mode === "mock" || mode === "deterministic" || mode === "offline") {
    return {};
  }

  if (mode !== "model") {
    throw new Error(`Unsupported analysis agent mode ${mode}`);
  }

  if (env.RIVALSCOPE_MODEL_PROVIDER?.trim().toLowerCase() !== "openai-compatible") {
    throw new Error(
      "RIVALSCOPE_MODEL_PROVIDER must be openai-compatible when RIVALSCOPE_ANALYSIS_AGENT_MODE is model"
    );
  }

  return {
    model: createConfiguredModelClient(env)
  };
}

export function createConfiguredModelClient(
  env: Record<string, string | undefined>
): ModelClient {
  return createModelClientFromEnv({
    ...(env.RIVALSCOPE_MODEL_PROVIDER
      ? { RIVALSCOPE_MODEL_PROVIDER: env.RIVALSCOPE_MODEL_PROVIDER }
      : {}),
    ...(env.OPENAI_COMPATIBLE_API_KEY
      ? { OPENAI_COMPATIBLE_API_KEY: env.OPENAI_COMPATIBLE_API_KEY }
      : {}),
    ...(env.OPENAI_COMPATIBLE_MODEL
      ? { OPENAI_COMPATIBLE_MODEL: env.OPENAI_COMPATIBLE_MODEL }
      : {}),
    ...(env.OPENAI_COMPATIBLE_BASE_URL
      ? { OPENAI_COMPATIBLE_BASE_URL: env.OPENAI_COMPATIBLE_BASE_URL }
      : {})
  });
}
