import { ProjectRepository, prisma } from "@rivalscope/db";
import { buildProjectClaimTrustSummary } from "../../../../lib/project-claim-trust";
import { buildProjectResearchSummary } from "../../../../lib/project-research-summary";
import { buildReportExport } from "../../../../lib/report-export";
import {
  buildReportExportResponse,
  type ReportExportFormat
} from "../../../../lib/report-export-route";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: Request, { params }: RouteProps) {
  const { projectId } = await params;
  const project = await new ProjectRepository(prisma).get(projectId);

  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  const format = getExportFormat(new URL(request.url).searchParams);
  const latestReport = project.reports[0] ?? null;
  const reportSections = latestReport?.sections ?? [];
  const claimTrust = buildProjectClaimTrustSummary({
    sources: project.sources,
    reportSections,
    reviewFindings: latestReport?.reviewFindings ?? []
  });
  const research = buildProjectResearchSummary({
    artifacts: project.artifacts
  });
  const exportResult = buildReportExport({
    project: {
      id: project.id,
      name: project.name,
      description: project.description
    },
    report: latestReport,
    claimTrust,
    research
  });

  return buildReportExportResponse({
    projectName: project.name,
    format,
    exportResult
  });
}

function getExportFormat(searchParams: URLSearchParams): ReportExportFormat {
  return searchParams.get("format") === "json" ? "json" : "markdown";
}
