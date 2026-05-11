import type { FixtureSearchIndex } from "@rivalscope/tools";

export const demoSearchIndex: FixtureSearchIndex = {
  Cursor: [
    {
      title: "Cursor pricing and teams",
      url: "https://demo.rivalscope.local/cursor/pricing",
      snippet: "Cursor offers individual Pro and Team plans for AI coding."
    }
  ],
  Codex: [
    {
      title: "Codex coding agent workflow",
      url: "https://demo.rivalscope.local/codex/workflow",
      snippet: "Codex focuses on software engineering tasks through a coding agent workflow."
    }
  ],
  Trae: [
    {
      title: "Trae product engineering workflows",
      url: "https://demo.rivalscope.local/trae/developer-experience",
      snippet: "Trae emphasizes AI-assisted development workflows for product engineering teams."
    }
  ]
};

export const demoDocumentsByUrl: Record<string, string> = {
  "https://demo.rivalscope.local/cursor/pricing": `
    <main>
      <h1>Cursor pricing and teams</h1>
      <p>Cursor offers individual Pro and Team plans for AI coding.</p>
      <p>The positioning centers on fast developer experience inside the editor.</p>
    </main>
  `,
  "https://demo.rivalscope.local/codex/workflow": `
    <main>
      <h1>Codex coding agent workflow</h1>
      <p>Codex focuses on software engineering tasks through a coding agent workflow.</p>
      <p>Its positioning emphasizes agentic implementation, testing, and code review.</p>
    </main>
  `,
  "https://demo.rivalscope.local/trae/developer-experience": `
    <main>
      <h1>Trae product engineering workflows</h1>
      <p>Trae emphasizes AI-assisted development workflows for product engineering teams.</p>
      <p>The developer experience message focuses on collaboration and product delivery.</p>
    </main>
  `
};
