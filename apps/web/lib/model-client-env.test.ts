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
  });
});
