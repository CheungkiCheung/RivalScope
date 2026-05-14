import { describe, expect, test } from "vitest";
import {
  createAnalysisAgentOptionsFromEnv,
  createConfiguredModelClient
} from "./model-client-env";

describe("model client env", () => {
  test("keeps mock as the default model provider", () => {
    expect(createConfiguredModelClient({}).name).toBe("mock");
  });

  test("rejects explicit real model provider without credentials before running workflows", () => {
    expect(() =>
      createConfiguredModelClient({
        RIVALSCOPE_MODEL_PROVIDER: "openai-compatible"
      })
    ).toThrow("OPENAI_COMPATIBLE_API_KEY is required");
  });

  test("does not enable model-backed agents unless the analysis mode is explicit", () => {
    expect(
      createAnalysisAgentOptionsFromEnv({
        RIVALSCOPE_MODEL_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_API_KEY: "test-key"
      })
    ).toEqual({});
  });

  test("enables model-backed agents when analysis mode is model", () => {
    const options = createAnalysisAgentOptionsFromEnv({
      RIVALSCOPE_ANALYSIS_AGENT_MODE: "model",
      RIVALSCOPE_MODEL_PROVIDER: "openai-compatible",
      OPENAI_COMPATIBLE_API_KEY: "test-key"
    });

    expect(options.model?.name).toBe("openai-compatible");
    expect(options.enableModelEntailmentJudge).toBe(false);
  });

  test("requires a separate opt-in for model-backed entailment judging", () => {
    const options = createAnalysisAgentOptionsFromEnv({
      RIVALSCOPE_ANALYSIS_AGENT_MODE: "model",
      RIVALSCOPE_MODEL_PROVIDER: "mimo",
      MIMO_API_KEY: "test-key",
      RIVALSCOPE_ENABLE_MODEL_ENTAILMENT_JUDGE: "true"
    });

    expect(options.model?.name).toBe("mimo");
    expect(options.enableModelEntailmentJudge).toBe(true);
  });

  test("enables Mimo as an OpenAI-compatible model provider", () => {
    const options = createAnalysisAgentOptionsFromEnv({
      RIVALSCOPE_ANALYSIS_AGENT_MODE: "model",
      RIVALSCOPE_MODEL_PROVIDER: "mimo",
      MIMO_API_KEY: "test-key"
    });

    expect(options.model).toMatchObject({
      name: "mimo",
      model: "mimo-v2-pro"
    });
  });

  test("rejects unknown analysis modes instead of silently changing execution mode", () => {
    expect(() =>
      createAnalysisAgentOptionsFromEnv({
        RIVALSCOPE_ANALYSIS_AGENT_MODE: "modle"
      })
    ).toThrow("Unsupported analysis agent mode modle");
  });

  test("requires an explicit real model provider when model-backed analysis is enabled", () => {
    expect(() =>
      createAnalysisAgentOptionsFromEnv({
        RIVALSCOPE_ANALYSIS_AGENT_MODE: "model"
      })
    ).toThrow("RIVALSCOPE_MODEL_PROVIDER must be openai-compatible or mimo");
  });
});
