import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectRepository, prisma } from "@rivalscope/db";
import { buildProjectClaimTrustSummary } from "../../../lib/project-claim-trust";
import { buildProjectEvalSummary } from "../../../lib/project-eval-summary";
import { runAnalysis } from "../../../lib/run-analysis";

export const dynamic = "force-dynamic";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const project = await new ProjectRepository(prisma).get(projectId);

  if (!project) {
    return (
      <main className="shell">
        <div className="card">
          <h1>Project not found</h1>
          <Link className="button secondary" href="/">
            Back
          </Link>
        </div>
      </main>
    );
  }

  async function runProject() {
    "use server";
    await runAnalysis(projectId);
    redirect(`/projects/${projectId}`);
  }

  const latestReport = project.reports[0];
  const latestWorkflow = project.workflows[0];
  const workflowNodes = latestWorkflow?.nodes ?? [];
  const agentRuns = workflowNodes.flatMap((node) => node.agentRuns ?? []);
  const workflowToolCalls = agentRuns.flatMap((run) =>
    run.toolCalls.map((toolCall) => ({
      nodeId: run.workflowNodeId,
      agentName: run.agentName,
      ...toolCall
    }))
  );
  const workflowModelCalls = agentRuns.flatMap((run) =>
    run.modelCalls.map((modelCall) => ({
      nodeId: run.workflowNodeId,
      agentName: run.agentName,
      ...modelCall
    }))
  );
  const totalModelTokens = workflowModelCalls.reduce((total, modelCall) => {
    if (
      typeof modelCall.usage === "object" &&
      modelCall.usage !== null &&
      "totalTokens" in modelCall.usage &&
      typeof modelCall.usage.totalTokens === "number"
    ) {
      return total + modelCall.usage.totalTokens;
    }

    return total;
  }, 0);
  const latestFindings = latestReport?.reviewFindings ?? [];
  const reportSections = latestReport?.sections ?? [];
  const allClaims = reportSections.flatMap((section) =>
    section.claims.map((link) => link.claim)
  );
  const allFacts = allClaims.flatMap((claim) => claim.facts.map((link) => link.fact));
  const evalSummary = buildProjectEvalSummary({
    requiredDimensions: project.analysisDimensions
      .filter((dimension) => dimension.required)
      .map((dimension) => dimension.key),
    reportSections
  });
  const claimTrustSummary = buildProjectClaimTrustSummary({
    sources: project.sources,
    reportSections
  });

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">
          <h1>{project.name}</h1>
          <p>{project.description}</p>
        </div>
        <form action={runProject}>
          <button className="button" type="submit">
            Run Agent DAG
          </button>
        </form>
      </div>

      <section className="metrics">
        <div className="metric">
          <span className="metric-label">Competitors</span>
          <strong>{project.competitors.length}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">Dimensions</span>
          <strong>{project.analysisDimensions.length}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">Facts</span>
          <strong>{allFacts.length}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">Claims</span>
          <strong>{allClaims.length}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">Findings</span>
          <strong>{latestFindings.length}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">Eval Score</span>
          <strong>{evalSummary.score ?? "—"}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">Claim Trust</span>
          <strong>{claimTrustSummary.averageScore ?? "—"}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">Model Calls</span>
          <strong>{workflowModelCalls.length}</strong>
        </div>
      </section>

      <div className="grid two">
        <section className="card">
          <h2>Report</h2>
          {!latestReport ? (
            <p className="muted">No report yet. Run the Agent DAG to generate one.</p>
          ) : (
            <article className="report">
              <div className="pill-row">
                <span className={`status ${latestReport.status === "FINAL" ? "ok" : "warn"}`}>
                  {latestReport.status}
                </span>
                {latestReport.qualityScore !== null ? (
                  <span className="pill">Quality {latestReport.qualityScore}</span>
                ) : null}
                <span className="pill">Sections {latestReport.sections.length}</span>
              </div>
              <h2>{latestReport.title}</h2>
              {reportSections.map((section) => (
                <section className="report-section" key={section.id}>
                  <h3>{section.title}</h3>
                  <p>{section.body}</p>
                  <div className="pill-row">
                    {section.claims.map((link) => (
                      <span className="pill" key={link.claimId}>
                        {link.claim.dimension}
                      </span>
                    ))}
                  </div>
                  <div className="evidence-list">
                    {section.claims.map((link) => (
                      <div className="evidence-item" key={link.claimId}>
                        <strong>{link.claim.statement}</strong>
                        <span className="muted">
                          {link.claim.kind} · confidence {Math.round(link.claim.confidence * 100)}%
                        </span>
                        <div className="evidence-facts">
                          {link.claim.facts.map((factLink) => (
                            <div className="evidence-fact" key={factLink.factId}>
                              <span className="pill">{factLink.fact.dimension}</span>
                              <p>{factLink.fact.statement}</p>
                              <span className="muted">
                                {factLink.fact.competitor.name} ·{" "}
                                {factLink.fact.chunks.map((chunkLink) => chunkLink.chunk.text).join(" ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </article>
          )}
        </section>

        <aside className="grid">
          <section className="card">
            <h3>Trajectory Eval</h3>
            {evalSummary.status === "not_started" ? (
              <p className="muted">No report trajectory to evaluate yet.</p>
            ) : (
              <div className="eval-panel">
                <div className="eval-score">
                  <span className="metric-label">Score</span>
                  <strong>{evalSummary.score}</strong>
                </div>
                {evalSummary.metrics ? (
                  <div className="eval-metrics">
                    <MetricRatio
                      label="Evidence"
                      value={evalSummary.metrics.evidenceCoverage}
                    />
                    <MetricRatio
                      label="Citations"
                      value={evalSummary.metrics.citationValidity}
                    />
                    <MetricRatio
                      label="Dimensions"
                      value={evalSummary.metrics.requiredDimensionCoverage}
                    />
                  </div>
                ) : null}
                {evalSummary.findings.length === 0 ? (
                  <p className="muted">No trajectory findings.</p>
                ) : (
                  <div className="list">
                    {evalSummary.findings.map((finding) => (
                      <div
                        className="item compact-item"
                        key={`${finding.category}-${finding.message}`}
                      >
                        <div className="item-head">
                          <strong>{finding.category}</strong>
                          <span
                            className={`status ${
                              finding.severity === "high" ? "bad" : "warn"
                            }`}
                          >
                            {finding.severity}
                          </span>
                        </div>
                        <p className="muted">{finding.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="card">
            <h3>Claim Trust Graph</h3>
            {claimTrustSummary.status === "not_started" ? (
              <p className="muted">No claims to score yet.</p>
            ) : (
              <div className="list">
                {claimTrustSummary.nodes.map((node) => (
                  <div className="item trust-node" key={node.claimId}>
                    <div className="item-head">
                      <strong>{node.dimension}</strong>
                      <span className={`status ${riskClass(node.riskLevel)}`}>
                        {node.score} · {node.riskLevel}
                      </span>
                    </div>
                    <p>{node.statement}</p>
                    <span className="muted">{node.sectionTitle}</span>
                    <div className="trust-chain">
                      <span>{node.facts.length} facts</span>
                      <span>{node.chunks.length} chunks</span>
                      <span>{node.sources.length} sources</span>
                    </div>
                    <div className="evidence-facts">
                      {node.facts.map((fact) => (
                        <div className="evidence-fact" key={fact.id}>
                          <span className="pill">{fact.dimension}</span>
                          <p>{fact.statement}</p>
                          <span className="muted">
                            {fact.competitorName} · confidence{" "}
                            {Math.round(fact.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pill-row">
                      {node.sources.map((source) => (
                        <span className="pill" key={source.id}>
                          {source.title}
                        </span>
                      ))}
                    </div>
                    {node.penalties.length > 0 ? (
                      <div className="list compact-list">
                        {node.penalties.map((penalty) => (
                          <div className="item compact-item" key={penalty.message}>
                            <strong>{penalty.code}</strong>
                            <p className="muted">
                              -{penalty.points}: {penalty.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>Agent Collaboration Trace</h3>
            {!latestWorkflow ? (
              <p className="muted">No workflow run yet.</p>
            ) : (
              <div className="list">
                {workflowNodes.map((node) => {
                  const latestRun = node.agentRuns[0];

                  return (
                    <div className="item" key={node.id}>
                      <div className="item-head">
                        <strong>{node.nodeKey}</strong>
                        <span className={`status ${statusClass(node.status)}`}>{node.status}</span>
                      </div>
                      <span className="muted">{node.agentName}</span>
                      {latestRun ? (
                        <div className="subtle-block">
                          <span className={`status ${statusClass(latestRun.status)}`}>
                            {latestRun.status}
                          </span>
                          <span className="muted">
                            {new Date(latestRun.startedAt).toLocaleTimeString("zh-CN")}
                          </span>
                          <span className="muted">tool calls {latestRun.toolCalls.length}</span>
                          <span className="muted">model calls {latestRun.modelCalls.length}</span>
                          <span className="muted">
                            handoff {node.inputArtifactIds.length} in /{" "}
                            {node.outputArtifactIds.length} out
                          </span>
                        </div>
                      ) : (
                        <span className="muted">No agent run recorded.</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card">
            <h3>Tool calls</h3>
            {workflowToolCalls.length === 0 ? (
              <p className="muted">No tool calls recorded yet.</p>
            ) : (
              <div className="list">
                {workflowToolCalls.map((toolCall) => (
                  <div className="item" key={toolCall.id}>
                    <div className="item-head">
                      <strong>{toolCall.toolName}</strong>
                      <span className={`status ${toolCall.status === "SUCCEEDED" ? "ok" : "bad"}`}>
                        {toolCall.status}
                      </span>
                    </div>
                    <span className="muted">
                      {toolCall.agentName} · {toolCall.nodeId}
                    </span>
                    <pre className="pre compact">
                      {JSON.stringify(
                        {
                          input: toolCall.input,
                          output: toolCall.output ?? null,
                          errorMessage: toolCall.errorMessage ?? null
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>Model calls</h3>
            {workflowModelCalls.length === 0 ? (
              <p className="muted">No model calls recorded yet.</p>
            ) : (
              <div className="list">
                {totalModelTokens > 0 ? (
                  <div className="trace-summary">
                    <span className="metric-label">Total tokens</span>
                    <strong>{totalModelTokens}</strong>
                  </div>
                ) : null}
                {workflowModelCalls.map((modelCall) => (
                  <div className="item" key={modelCall.id}>
                    <div className="item-head">
                      <strong>{modelCall.task}</strong>
                      <span className={`status ${modelCall.status === "SUCCEEDED" ? "ok" : "bad"}`}>
                        {modelCall.status}
                      </span>
                    </div>
                    <span className="muted">
                      {modelCall.agentName} · {modelCall.provider}
                      {modelCall.model ? `/${modelCall.model}` : ""} · {modelCall.nodeId}
                    </span>
                    <div className="pill-row">
                      {modelCall.responseFormat ? (
                        <span className="pill">{modelCall.responseFormat}</span>
                      ) : null}
                      {renderTokenPill(modelCall.usage)}
                    </div>
                    <pre className="pre compact">
                      {JSON.stringify(
                        {
                          input: modelCall.input,
                          output: modelCall.output ?? null,
                          usage: modelCall.usage ?? null,
                          errorMessage: modelCall.errorMessage ?? null
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>Competitors</h3>
            <div className="pill-row">
              {project.competitors.map((competitor) => (
                <span className="pill" key={competitor.id}>
                  {competitor.name}
                </span>
              ))}
            </div>
          </section>

          <section className="card">
            <h3>Dimensions</h3>
            <div className="pill-row">
              {project.analysisDimensions.map((dimension) => (
                <span className="pill" key={dimension.id}>
                  {dimension.key}
                </span>
              ))}
            </div>
          </section>

          <section className="card">
            <h3>Sources</h3>
            <div className="list">
              {project.sources.map((source) => (
                <div className="item" key={source.id}>
                  <div className="item-head">
                    <strong>{source.title}</strong>
                    <span className="pill">{source.kind}</span>
                  </div>
                  <span className="muted">{source.uri}</span>
                  <span className="muted">{source.chunks.length} chunks</span>
                  {source.chunks[0] ? (
                    <p className="source-preview">{source.chunks[0].text}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h3>Workflow</h3>
            <div className="list">
              {workflowNodes.map((node) => (
                <div className="item" key={node.id}>
                  <div className="item-head">
                    <strong>{node.nodeKey}</strong>
                    <span className={`status ${statusClass(node.status)}`}>{node.status}</span>
                  </div>
                  <span className="muted">{node.agentName}</span>
                  <span className="muted">inputs {node.inputArtifactIds.length}</span>
                  <span className="muted">outputs {node.outputArtifactIds.length}</span>
                </div>
              ))}
            </div>
          </section>

          {latestFindings.length ? (
            <section className="card">
              <h3>Critic Findings</h3>
              <div className="list">
                {latestFindings.map((finding) => (
                  <div className="item" key={finding.id}>
                    <span className="status bad">{finding.severity}</span>
                    <strong>{finding.category}</strong>
                    <p className="muted">{finding.message}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function renderTokenPill(usage: unknown) {
  if (
    typeof usage === "object" &&
    usage !== null &&
    "totalTokens" in usage &&
    typeof usage.totalTokens === "number"
  ) {
    return <span className="pill">{usage.totalTokens} tokens</span>;
  }

  return null;
}

function MetricRatio({ label, value }: { label: string; value: number }) {
  return (
    <div className="trace-summary">
      <span className="metric-label">{label}</span>
      <strong>{Math.round(value * 100)}%</strong>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "SUCCEEDED") {
    return "ok";
  }

  if (status === "FAILED" || status === "BLOCKED") {
    return "bad";
  }

  return "warn";
}

function riskClass(riskLevel: string) {
  if (riskLevel === "low") {
    return "ok";
  }

  if (riskLevel === "medium") {
    return "warn";
  }

  return "bad";
}
