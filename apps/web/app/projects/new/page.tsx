import { redirect } from "next/navigation";
import { ProjectRepository, SourceRepository, prisma } from "@rivalscope/db";

const defaultSource = `Cursor offers individual Pro and Team plans for AI coding.
Codex focuses on software engineering tasks through a coding agent workflow.
Trae emphasizes AI-assisted development workflows for product engineering teams.`;

export default function NewProjectPage() {
  async function createProject(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "AI coding tools analysis");
    const description = String(
      formData.get("description") ?? "Competitive analysis for AI coding tools."
    );
    const competitors = String(formData.get("competitors") ?? "Cursor,Codex,Trae")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const dimensions = String(
      formData.get("dimensions") ?? "pricing,positioning,developer_experience"
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const sourceText = String(formData.get("sourceText") ?? defaultSource);

    const project = await new ProjectRepository(prisma).create({
      owner: {
        email: "demo@rivalscope.local",
        name: "Demo User"
      },
      name,
      description,
      competitors: competitors.map((competitor, index) => ({
        name: competitor,
        isPrimary: index === 0
      })),
      dimensions: dimensions.map((dimension) => ({
        key: dimension,
        label: dimension.replaceAll("_", " ")
      }))
    });

    await new SourceRepository(prisma).create({
      projectId: project.id,
      kind: "TEXT",
      title: "Seed competitive notes",
      uri: "manual://seed-notes",
      chunks: sourceText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => ({
          ordinal: index,
          text: line,
          tokenCount: line.split(/\s+/).length
        }))
    });

    redirect(`/projects/${project.id}`);
  }

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">
          <h1>New analysis</h1>
          <p>Create a project with competitors, dimensions, and seed sources.</p>
        </div>
      </div>

      <form className="card form" action={createProject}>
        <div className="field">
          <label htmlFor="name">Project name</label>
          <input id="name" name="name" defaultValue="AI coding tools analysis" />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <input
            id="description"
            name="description"
            defaultValue="Compare leading AI coding tools across positioning, pricing, and developer experience."
          />
        </div>
        <div className="field">
          <label htmlFor="competitors">Competitors, comma-separated</label>
          <input id="competitors" name="competitors" defaultValue="Cursor,Codex,Trae" />
        </div>
        <div className="field">
          <label htmlFor="dimensions">Required dimensions, comma-separated</label>
          <input
            id="dimensions"
            name="dimensions"
            defaultValue="pricing,positioning,developer_experience"
          />
        </div>
        <div className="field">
          <label htmlFor="sourceText">Seed source text</label>
          <textarea id="sourceText" name="sourceText" defaultValue={defaultSource} />
        </div>
        <button className="button" type="submit">
          Create project
        </button>
      </form>
    </main>
  );
}
