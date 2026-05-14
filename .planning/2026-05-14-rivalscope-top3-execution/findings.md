# Findings & Decisions

## Requirements
- Build RivalScope for the ByteDance AI-driven competitor analysis Agent collaboration challenge.
- Optimize for top-3 competition quality and autumn recruiting AI Agent engineering signal.
- Preserve durable context so future Codex sessions can continue without relying on conversation history.
- Use evaluation-first development: every major optimization needs a metric, test, and visible artifact.
- Keep docs and harness updated as implementation evolves.
- Push branches to `git@github.com:CheungkiCheung/RivalScope.git`.
- Never write real API keys into files or commits.

## Research Findings
- `planning-with-files` v2.37.0 uses persistent markdown files as external memory.
- Its durable core is a three-file model: `task_plan.md`, `findings.md`, and `progress.md`.
- It supports isolated plans under `.planning/YYYY-MM-DD-slug/` and an active pointer at `.planning/.active_plan`.
- It includes hash attestation for plan tamper detection. Useful later, but the immediate value is persistent planning state.
- For RivalScope, we should adapt the pattern rather than import the full hook setup immediately. Project-specific `.planning` files are safer and easier to review.
- The repository also has Codex hooks, but enabling workspace hooks should be a separate decision because hooks can duplicate global behavior and affect all future tool calls.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Download `planning-with-files` into `external/planning-with-files` | Keeps third-party reference out of RivalScope source while available locally. |
| Use SSH clone | HTTPS clone timed out; SSH clone succeeded with existing GitHub key. |
| Create `.planning/2026-05-14-rivalscope-top3-execution/` | Gives RivalScope a stable active plan directory for session recovery. |
| Do not copy full `.codex/hooks.json` yet | Hook installation changes agent lifecycle globally/workspace-wide and should be reviewed separately. |
| Keep `.planning` project-specific | The project needs a durable execution harness, not a generic template. |

## Current Architecture Snapshot
- Web app: Next.js app under `apps/web`.
- Agents package: workflow agents, model gateway, entailment judge, artifact schemas.
- Evals package: trajectory eval, claim trust, entailment eval/calibration.
- Tools package: source search/fetch/chunk tooling.
- DB package: Prisma persistence with generic artifact table using string `kind`.
- Main workflow currently includes:
  `extract -> analyze -> write -> critique -> repair -> apply_repair -> final_eval -> trust_snapshot -> judge_compare`.

## Implemented Differentiators
- Agent Collaboration Trace.
- Claim Trust Graph.
- Eval-Guided Repair Loop.
- Semantic evidence and source authority scoring.
- Claim Trust snapshots and repair delta.
- Seeded repair-lift demo.
- Optional Mimo model provider.
- Entailment judge comparison artifact/UI.
- Offline entailment calibration suite.
- Reproducible entailment judge calibration runner with failed-case, disagreement, latency, call-count, and token-usage reporting.

## Open Risks
- Golden entailment suite is still small and deterministic-first.
- Mimo judge calibration now has a committed runner, but real-provider calibration results have not been captured in a tracked artifact.
- Routed research DAG is still pending.
- Export/evidence appendix and deployment hardening are still pending.
- UI shows many panels but does not yet converge into a single polished “Intelligence Trace” story.

## Resources
- RivalScope harness: `docs/top3-execution-harness.md`
- Next plan: `docs/next-stage-plan.md`
- External reference: `/Users/zhangqixiang/0_2实习/zijie/external/planning-with-files`
- Planning-with-files Codex docs: `/Users/zhangqixiang/0_2实习/zijie/external/planning-with-files/docs/codex.md`
- Planning-with-files skill: `/Users/zhangqixiang/0_2实习/zijie/external/planning-with-files/skills/planning-with-files/SKILL.md`

## Visual/Browser Findings
- No browser UI review was performed during planning setup.

## Session Recovery Notes
- To resume, read this file, `task_plan.md`, `progress.md`, and project harness docs.
- Active plan pointer should contain `2026-05-14-rivalscope-top3-execution`.
- If future sessions create parallel workstreams, use separate `.planning/<date>-<slug>/` directories and switch `.planning/.active_plan`.
