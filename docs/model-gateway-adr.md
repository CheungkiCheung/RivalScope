# Model Gateway ADR

## Decision

RivalScope uses a provider-neutral `ModelClient` interface for LLM calls. The default provider is deterministic `mock`; real model usage is opt-in through an OpenAI-compatible HTTP adapter configured by environment variables.

## Rationale

ByteDance's competitor-analysis challenge rewards end-to-end agent engineering, not a one-off prompt wrapper. The model layer therefore has to support:

- Offline tests and demos with no API keys.
- Provider replacement without changing workflow code.
- Structured outputs that are validated before entering the evidence chain.
- Observable failures when a model returns invalid JSON or schema-invalid content.

OpenAI-compatible HTTP is the first real adapter because it is simple, widely supported, and can map to OpenAI or compatible enterprise endpoints through `OPENAI_COMPATIBLE_BASE_URL`. The business workflow only sees `ModelClient`, so future adapters can be added without changing Extract, Analyst, or DAG code.

## Current Scope

- `MockModelClient` records calls and returns queued responses for deterministic tests.
- `createOpenAICompatibleModelClient` calls `/chat/completions` with JSON mode when structured output is requested.
- `generateStructuredObject` parses JSON and validates it with Zod.
- Extract and Analyst agents can use a model client, but default to deterministic logic when no real provider is selected.
- Model-backed agents treat model outputs as candidates: RivalScope assigns fact and claim IDs in code and rejects unknown `sourceChunkIds` or `factIds`.
- The web app requires `RIVALSCOPE_ANALYSIS_AGENT_MODE="model"` before model-backed analysis agents are enabled, even if provider credentials are present.

## Known Gaps

- Model calls are not yet persisted as first-class observability records.
- Structured outputs are schema-validated and reference-validated for Extract and Analyst, but report-section claim validation still happens in the Critic rather than before artifact creation.
- Retry/repair behavior is intentionally deferred until eval baselines exist, so failures remain visible instead of being silently patched.

## Differentiation For The Competition

The product story is not "ask an LLM to write a report." RivalScope exposes the full path from public source collection to facts, claims, report, and Critic findings. The model gateway is one interchangeable execution engine inside a typed, traceable workflow. This makes the system easier to evaluate, debug, and defend in an interview than a black-box report generator.
