import type { ProjectClaimTrustSummary } from "./project-claim-trust";
import type { ProjectResearchSummary } from "./project-research-summary";

export interface BuildReportExportInput {
  project: {
    id: string;
    name: string;
    description?: string | null;
  };
  report: ProjectExportReport | null;
  claimTrust: ProjectClaimTrustSummary;
  research: ProjectResearchSummary;
}

export interface ProjectExportReport {
  id: string;
  title: string;
  status: string;
  qualityScore: number | null;
  sections: ProjectExportReportSection[];
}

export interface ProjectExportReportSection {
  id: string;
  title: string;
  body: string;
  claims: Array<{
    claimId: string;
    claim: {
      id: string;
      statement: string;
      dimension: string;
      confidence: number;
      kind: string;
      facts: Array<{
        factId: string;
        fact: {
          id: string;
          statement: string;
          dimension: string;
          confidence: number;
          competitor: {
            name: string;
          };
          chunks: Array<{
            chunkId: string;
            chunk?: {
              id: string;
              text: string;
              sourceId: string;
            };
          }>;
        };
      }>;
    };
  }>;
}

export interface ReportExport {
  json: ReportExportJson;
  markdown: string;
}

export interface ReportExportJson {
  project: {
    id: string;
    name: string;
    description: string | null;
  };
  report: {
    id: string;
    title: string;
    status: string;
    qualityScore: number | null;
    sections: Array<{
      id: string;
      title: string;
      body: string;
      claimIds: string[];
    }>;
  } | null;
  synthesis: {
    includedClaimIds: string[];
    excludedClaimIds: string[];
    evidenceGapIds: string[];
  };
  evidenceAppendix: ReportEvidenceAppendixEntry[];
}

export interface ReportEvidenceAppendixEntry {
  claimId: string;
  statement: string;
  dimension: string;
  trustScore: number;
  riskLevel: string;
  facts: Array<{
    id: string;
    statement: string;
    dimension: string;
    confidence: number;
    competitorName: string;
    sourceChunks: Array<{
      id: string;
      text: string;
      source: {
        id: string;
        title: string;
        uri: string;
      } | null;
    }>;
  }>;
}

export function buildReportExport(input: BuildReportExportInput): ReportExport {
  const evidenceAppendix = buildEvidenceAppendix(input.claimTrust);
  const json: ReportExportJson = {
    project: {
      id: input.project.id,
      name: input.project.name,
      description: input.project.description ?? null
    },
    report: input.report
      ? {
          id: input.report.id,
          title: input.report.title,
          status: input.report.status,
          qualityScore: input.report.qualityScore,
          sections: input.report.sections.map((section) => ({
            id: section.id,
            title: section.title,
            body: section.body,
            claimIds: section.claims.map((link) => link.claimId)
          }))
        }
      : null,
    synthesis: {
      includedClaimIds: input.research.includedClaimIds,
      excludedClaimIds: input.research.excludedClaimIds,
      evidenceGapIds: input.research.evidenceGaps.map((gap) => gap.id)
    },
    evidenceAppendix
  };

  return {
    json,
    markdown: buildMarkdown({
      project: input.project,
      report: input.report,
      research: input.research,
      evidenceAppendix
    })
  };
}

function buildEvidenceAppendix(
  claimTrust: ProjectClaimTrustSummary
): ReportEvidenceAppendixEntry[] {
  return claimTrust.nodes.map((node) => {
    const chunksById = new Map(node.chunks.map((chunk) => [chunk.id, chunk]));
    const sourcesById = new Map(node.sources.map((source) => [source.id, source]));

    return {
      claimId: node.claimId,
      statement: node.statement,
      dimension: node.dimension,
      trustScore: node.score,
      riskLevel: node.riskLevel,
      facts: node.facts.map((fact) => ({
        id: fact.id,
        statement: fact.statement,
        dimension: fact.dimension,
        confidence: fact.confidence,
        competitorName: fact.competitorName,
        sourceChunks: node.chunks.map((chunk) => {
          const trustedChunk = chunksById.get(chunk.id) ?? chunk;
          const source = sourcesById.get(trustedChunk.sourceId);

          return {
            id: trustedChunk.id,
            text: trustedChunk.text,
            source: source
              ? {
                  id: source.id,
                  title: source.title,
                  uri: source.uri
                }
              : null
          };
        })
      }))
    };
  });
}

function buildMarkdown(input: {
  project: BuildReportExportInput["project"];
  report: ProjectExportReport | null;
  research: ProjectResearchSummary;
  evidenceAppendix: ReportEvidenceAppendixEntry[];
}): string {
  const lines: string[] = [];
  const title = input.report?.title ?? input.project.name;

  lines.push(`# ${title}`);
  lines.push("");

  if (input.project.description) {
    lines.push(input.project.description);
    lines.push("");
  }

  if (!input.report) {
    lines.push("No report has been generated yet.");
    return lines.join("\n");
  }

  lines.push(`Status: ${input.report.status}`);
  if (input.report.qualityScore !== null) {
    lines.push(`Quality Score: ${input.report.qualityScore}`);
  }
  lines.push(
    `Synthesis: ${input.research.includedClaimIds.length} included, ${input.research.excludedClaimIds.length} excluded`
  );
  lines.push("");

  for (const section of input.report.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.body);
    lines.push("");
  }

  if (input.research.evidenceGaps.length > 0) {
    lines.push("## Evidence Gaps");
    lines.push("");

    for (const gap of input.research.evidenceGaps) {
      lines.push(`- ${gap.competitorName} / ${gap.dimension}: ${gap.reason}`);
    }

    lines.push("");
  }

  lines.push("## Evidence Appendix");
  lines.push("");

  if (input.evidenceAppendix.length === 0) {
    lines.push("No claim evidence is available.");
    return lines.join("\n");
  }

  for (const entry of input.evidenceAppendix) {
    lines.push(
      `### Claim \`${entry.claimId}\`: ${entry.statement}`
    );
    lines.push("");
    lines.push(
      `Dimension: ${entry.dimension}; Trust: ${entry.trustScore}; Risk: ${entry.riskLevel}`
    );
    lines.push("");

    for (const fact of entry.facts) {
      lines.push(`- Fact \`${fact.id}\`: ${fact.statement}`);
      lines.push(
        `  - Competitor: ${fact.competitorName}; Confidence: ${Math.round(
          fact.confidence * 100
        )}%`
      );

      for (const chunk of fact.sourceChunks) {
        lines.push(`  - Chunk \`${chunk.id}\`: ${chunk.text}`);
        lines.push(
          `  - Source: ${chunk.source?.title ?? "Unknown source"} - ${
            chunk.source?.uri ?? "unknown"
          }`
        );
      }
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
