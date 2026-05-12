import {
  createModelClientFromEnv,
  type AnalysisWorkflowAgentOptions,
  type ModelClient
} from "@rivalscope/agents";

export function createAnalysisAgentOptionsFromEnv(
  env: Record<string, string | undefined>
): AnalysisWorkflowAgentOptions {
  if (env.RIVALSCOPE_ANALYSIS_AGENT_MODE !== "model") {
    return {};
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
