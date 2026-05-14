# Model Gateway ADR

## Decision

RivalScope uses a provider-neutral `ModelClient` interface for LLM calls. The default provider is deterministic `mock`; real model usage is opt-in through an OpenAI-compatible HTTP adapter configured by environment variables.

## Rationale

ByteDance's competitor-analysis challenge rewards end-to-end agent engineering, not a one-off prompt wrapper. The model layer therefore has to support:

- Offline tests and demos with no API keys.
- Provider replacement without changing workflow code.
- Structured outputs that are validated before entering the evidence chain.
- Observable failures when a model returns invalid JSON or schema-invalid content.

OpenAI-compatible HTTP is the first real adapter because it is simple, widely supported, and can map to OpenAI or compatible enterprise endpoints through `OPENAI_COMPATIBLE_BASE_URL`. Mimo is supported as a named provider through the same adapter with `api-key` authentication and `MIMO_*` environment variables. The business workflow only sees `ModelClient`, so future adapters can be added without changing Extract, Analyst, entailment judging, or DAG code.

## Current Scope

- `MockModelClient` records calls and returns queued responses for deterministic tests.
- `createOpenAICompatibleModelClient` calls `/chat/completions` with JSON mode when structured output is requested.
- `generateStructuredObject` parses JSON and validates it with Zod.
- Extract and Analyst agents can use a model client, but default to deterministic logic when no real provider is selected.
- Model-backed agents treat model outputs as candidates: RivalScope assigns fact and claim IDs in code, rejects unknown `sourceChunkIds` or `factIds`, and rejects fact competitors outside the project allowlist.
- Model calls are captured as first-class `ModelCall` observability records with provider, model, task, bounded prompt trace input, bounded response content, token usage, status, and error context.
- The web app requires `RIVALSCOPE_ANALYSIS_AGENT_MODE="model"` and `RIVALSCOPE_MODEL_PROVIDER="openai-compatible"` before model-backed analysis agents are enabled, even if provider credentials are present.
- Model-backed entailment judging also requires `RIVALSCOPE_ENABLE_MODEL_ENTAILMENT_JUDGE="true"` because it can add one model call per claim. It is best-effort: provider or validation failure produces a partial `entailment_judge_comparison` artifact instead of blocking the core report workflow.
- `npm run eval:entailment-judges --workspace @rivalscope/agents` runs judge calibration against `goldenEntailmentCases`. It is deterministic-only by default and can add the configured Mimo/OpenAI-compatible judge when `RIVALSCOPE_ENABLE_MODEL_ENTAILMENT_JUDGE="true"`. The JSON output records accuracy, failed cases, disagreements, latency, model call count, and token usage so judge quality can be measured before model disagreement affects repair routing.
- Failed model output validation is persisted as a failed agent run and visible workflow state; persistence no longer requires downstream report artifacts after an upstream model failure.

## Known Gaps

- Structured outputs are schema-validated and reference-validated for Extract and Analyst, but report-section claim validation still happens in the Critic rather than before artifact creation.
- Retry/repair behavior is intentionally deferred until eval baselines exist, so failures remain visible instead of being silently patched.

## Differentiation For The Competition

The product story is not "ask an LLM to write a report." RivalScope exposes the full path from public source collection to facts, claims, report, and Critic findings. The model gateway is one interchangeable execution engine inside a typed, traceable workflow. This makes the system easier to evaluate, debug, and defend in an interview than a black-box report generator.
