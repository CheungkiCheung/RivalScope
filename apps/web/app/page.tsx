import Link from "next/link";
import { ProjectRepository, prisma } from "@rivalscope/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await new ProjectRepository(prisma).list();

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">
          <h1>RivalScope</h1>
          <p>Multi-agent competitive intelligence with evidence and critique.</p>
        </div>
        <Link className="button" href="/projects/new">
          New analysis
        </Link>
      </div>

      <section className="card">
        <h2>Projects</h2>
        <div className="list">
          {projects.length === 0 ? (
            <p className="muted">No projects yet. Create one to run the Agent DAG.</p>
          ) : (
            projects.map((project) => (
              <Link className="item" href={`/projects/${project.id}`} key={project.id}>
                <h3>{project.name}</h3>
                <p className="muted">{project.description ?? "No description"}</p>
                <div className="pill-row">
                  {project.competitors.map((competitor) => (
                    <span className="pill" key={competitor.id}>
                      {competitor.name}
                    </span>
                  ))}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
