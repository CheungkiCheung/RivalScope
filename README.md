# RivalScope

RivalScope is a multi-agent competitive intelligence platform for AI-agent engineering practice. It is designed around DAG orchestration, structured intermediate artifacts, evidence tracing, and automated critique rather than a single report-generation prompt.

## Product Direction

The target user creates a competitive analysis project, adds competitors and public sources, then runs a multi-agent workflow:

1. Research Agent collects and normalizes sources.
2. Extract Agent converts source chunks into structured facts.
3. Analyst Agent turns facts into evidence-backed claims.
4. Writer Agent composes a report from claims.
5. Critic Agent checks unsupported claims, conflicts, missing dimensions, and overconfident conclusions.

The core evidence chain is:

```text
Source -> SourceChunk -> Fact -> Claim -> ReportSection
```

This chain is the main guardrail against hallucinated reports.

## Current Status

The repository currently contains a complete MVP path:

- Immutable workflow DAG model.
- Node dependency scheduling.
- Node running/success/failure transitions.
- Retry exhaustion and descendant blocking.
- Evidence-chain domain model.
- Claim evidence validation.
- Agent and Tool interfaces with schema validation.
- Agent run and tool call records.
- In-memory artifact store.
- Workflow runner that executes ready DAG nodes.
- Mock Extract, Analyst, Writer, and Critic agents.
- Real source-tooling contracts for fixture/Tavily search, URL fetch, HTML-to-text extraction, and stable text chunking.
- Source collection persistence through the same Workflow, AgentRun, and ToolCall observability records used by analysis runs.
- PostgreSQL persistence through Prisma repositories.
- Next.js web UI for project creation, source preview, DAG execution, report review, evidence inspection, workflow status, and tool-call observability.
- End-to-end source chunks -> facts -> claims -> report -> review findings flow.
- Critic checks for unsupported claims, unknown fact references, low-confidence claims, report sections without cited claims, unknown claim references, and missing required analysis dimensions.

## Repository Layout

```text
apps/
  web/
    app/                 # Next.js App Router pages and server actions
    lib/                 # Analysis orchestration and persistence mapping
packages/
  core/
    src/workflow.ts      # DAG workflow domain model and immutable state transitions
    src/evidence.ts      # Source, chunk, fact, claim, and evidence-chain model
  agents/
    src/agent.ts         # Agent and Tool interfaces, execution, and call logging
    src/artifacts.ts     # Artifact types, store contract, and in-memory store
    src/workflow-schemas.ts # Shared workflow agent input/output schemas
    src/analysis-agents.ts # Mock Extract, Analyst, Writer, and Critic agents
    src/workflow-runner.ts # In-memory workflow runner
  db/
    prisma/schema.prisma # PostgreSQL relational model
    src/repositories.ts  # Project, workflow, artifact, and intelligence repositories
  tools/
    src/index.ts         # Placeholder for concrete external tools
```

Planned additions include `packages/evals` for trajectory evaluation and, later, an optional worker process for long-running production workflows.

## Architecture Direction

The next stage keeps the explicit DAG as the control plane. This follows the production pattern used by major agent platforms: start with deterministic workflows, structured tools, traceable runs, and evaluation loops before adding more autonomous planning.

Useful references:

- [OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents) and [agent workflow evals](https://developers.openai.com/api/docs/guides/agent-evals) for tracing, graders, and workflow quality loops.
- [Anthropic Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) and [tool use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use) for workflow-first design and structured tools.
- [Google Agent Development Kit](https://cloud.google.com/vertex-ai/generative-ai/docs/agent-development-kit/overview) for progressive workflow-to-multi-agent architecture.
- [AWS Bedrock multi-agent collaboration](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-multi-agent-collaboration.html) for supervisor/collaborator decomposition.

The implementation should borrow patterns from mature open-source systems without replacing the current control plane:

- [OpenAI Agents Python](https://github.com/openai/openai-agents-python) for handoffs, tracing, and guardrails.
- [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) and [LangGraph](https://github.com/langchain-ai/langgraph) for graph execution, checkpoints, and human-in-the-loop workflows.
- [Open Deep Research](https://github.com/langchain-ai/open_deep_research) and [DeerFlow](https://github.com/bytedance/deer-flow) for research/report generation workflows.
- [Langfuse](https://github.com/langfuse/langfuse) and [Pydantic AI](https://github.com/pydantic/pydantic-ai) for observability, datasets, evals, and type-safe agent outputs.

## Commands

Install dependencies:

```bash
npm install --registry=https://registry.npmjs.org/
```

Run tests:

```bash
npm test
```

Run type checks:

```bash
npm run typecheck
```

Validate the Prisma schema:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" npm run db:validate --workspace @rivalscope/db
```

Start local infrastructure:

```bash
docker compose up -d postgres redis
```

On this machine, Prisma binary download may require a one-off local certificate workaround:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:validate --workspace @rivalscope/db
```

Do not commit or export that TLS setting globally.

Push the schema to a running local database:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" npm run db:push --workspace @rivalscope/db
```

Run the web MVP:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" npm run dev --workspace @rivalscope/web
```

Source collection uses deterministic fixture search by default so local demos and tests do not require network credentials. To use Tavily for URL search, set:

```bash
RIVALSCOPE_SEARCH_PROVIDER="tavily"
TAVILY_API_KEY="..."
```

The MVP flow is:

1. Open `http://localhost:3000`.
2. Create a new analysis project.
3. Open the project detail page.
4. Click `Run Agent DAG`.
5. Review the generated report, workflow node statuses, source chunks, and Critic findings.

## Development Principles

- Use TDD for behavior changes.
- Keep Agent outputs structured and schema-validated.
- Persist every important intermediate artifact once the database package is added.
- Do not let claims enter final reports unless they cite facts.
- Keep workflow state immutable so execution history is easy to reason about.
- Maintain observability as a first-class product feature: AgentRun, ToolCall, Artifact, and ReviewFinding are product surfaces, not internal logs.

## Next Milestones

1. Add real tool adapters for search, URL fetch, HTML parsing, chunking, and source normalization.
2. Add a provider-neutral model gateway so mock agents and real LLM agents share the same workflow contracts.
3. Expand the DAG from the current linear MVP into a routed research workflow with checkpoints, resume behavior, and optional human approval.
4. Add trajectory evaluation: final report quality, evidence coverage, citation validity, tool path correctness, and Critic effectiveness.
5. Upgrade observability UI so AgentRun, ToolCall, Artifact, ReviewFinding, and evaluation results are first-class review surfaces.
