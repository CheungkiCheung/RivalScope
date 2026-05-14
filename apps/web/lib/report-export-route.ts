import type { ReportExport } from "./report-export";

export type ReportExportFormat = "json" | "markdown";

export function buildReportExportResponse(input: {
  projectName: string;
  format: ReportExportFormat;
  exportResult: ReportExport;
}): Response {
  const filenameBase = `rivalscope-${slugify(input.projectName)}`;

  if (input.format === "json") {
    return new Response(JSON.stringify(input.exportResult.json, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filenameBase}.json"`
      }
    });
  }

  return new Response(input.exportResult.markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${filenameBase}.md"`
    }
  });
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "report";
}
