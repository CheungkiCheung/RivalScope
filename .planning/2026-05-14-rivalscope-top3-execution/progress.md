# Progress Log

## Session: 2026-05-14

### Planning Harness Setup
- **Status:** complete
- **Started:** 2026-05-14
- Actions taken:
  - Tried cloning `https://github.com/OthmanAdi/planning-with-files`; HTTPS clone timed out.
  - Cloned `git@github.com:OthmanAdi/planning-with-files.git` successfully into `/Users/zhangqixiang/0_2实习/zijie/external/planning-with-files`.
  - Read README, Codex setup docs, SKILL.md, scripts, and templates.
  - Created isolated planning workspace `.planning/2026-05-14-rivalscope-top3-execution/`.
  - Set `.planning/.active_plan` to `2026-05-14-rivalscope-top3-execution`.
  - Replaced generic templates with RivalScope-specific `task_plan.md`, `findings.md`, and `progress.md`.
- Files created/modified:
  - `.planning/.active_plan`
  - `.planning/2026-05-14-rivalscope-top3-execution/task_plan.md`
  - `.planning/2026-05-14-rivalscope-top3-execution/findings.md`
  - `.planning/2026-05-14-rivalscope-top3-execution/progress.md`

### Completed Before Planning Harness
- Branch `codex/judge-comparison-artifact-ui`
  - Commit `2ca5169 feat: add judge comparison artifact ui`
  - Added `entailment_judge_comparison` artifact, DAG node, UI panel, and model judge opt-in/failure fallback.
- Branch `codex/entailment-calibration-suite`
  - Commit `4070645 feat: add entailment calibration suite`
  - Added golden entailment calibration, judge calibration API, CLI calibration output, and evaluator guardrails.

### Phase 4.4: Mimo Judge Calibration Runner
- **Status:** complete
- **Completed:** 2026-05-14 23:16 CST
- Actions taken:
  - Created branch `codex/mimo-judge-calibration-runner`.
  - Added `packages/agents/src/entailment-calibration-runner.ts` with deterministic/model judge calibration reporting.
  - Added `packages/agents/src/entailment-calibration-cli.ts`.
  - Added package script `npm run eval:entailment-judges --workspace @rivalscope/agents`.
  - Added offline tests using `MockModelClient`.
  - Updated README, model gateway ADR, top-3 harness, and next-stage plan.
- Output fields now include:
  - judge accuracy;
  - label, dimension, and risk-type buckets;
  - failed case details;
  - judge disagreements;
  - latency;
  - model call count;
  - token usage.
- Current next phase:
  - Phase 4.5 - Calibration-Gated Repair Policy.

### Phase 4.5: Calibration-Gated Repair Policy
- **Status:** complete
- **Completed:** 2026-05-14 23:34 CST
- Actions taken:
  - Created branch `codex/calibration-gated-repair-policy`.
  - Moved canonical web workflow `judge_compare` before `repair` so repair planning can consume judge comparison artifacts.
  - Extended `entailment_judge_comparison` with `policyDecisions`.
  - Added `request_human_review` repair action type.
  - Added severe label split policy:
    - `unsupported` or `contradicted` split with `entailed` or `partial` routes to human review.
    - Any contradiction split routes to conservative removal.
    - Existing deterministic high-risk removal wins over human review.
  - Added Repair Loop UI gate status, high-risk disagreement rows, and low-risk disagreement disclosure.
  - Updated top-3 harness and next-stage plan.
- Current next phase:
  - Phase 5 - Routed Research DAG.

### Phase 5: Routed Research DAG
- **Status:** complete for first deterministic artifact-level slice
- **Completed:** 2026-05-14 23:50 CST
- Actions taken:
  - Created branch `codex/routed-research-dag`.
  - Added `research_plan`, `research_branch_results`, and `research_synthesis` artifact kinds.
  - Added Research Planner, Research Branch, and Research Synthesis agents.
  - Routed the canonical web workflow through:
    `research_plan -> extract -> analyze -> research_branches -> research_synthesis -> write -> critique -> judge_compare -> repair -> apply_repair -> final_eval -> trust_snapshot`.
  - Encoded expected branch evidence failures as branch-result data rather than thrown workflow failures.
  - Added project-page Research Branches metrics and panel.
  - Added tolerant UI parser for latest `research_synthesis` artifact.
  - Added persistence smoke coverage for routed research artifacts.
- Current next phase:
  - Phase 6 - Delivery And Demo Hardening, with likely sub-slice first: synthesis policy should influence final report inclusion/exclusion more directly.

### Phase 6.1: Synthesis-Gated Report Writing
- **Status:** in progress
- **Started:** 2026-05-15 00:00 CST
- Actions taken:
  - Created branch `codex/synthesis-report-gating`.
  - Added RED coverage proving Writer must exclude claims outside `research_synthesis.includedClaimIds`.
  - Updated Writer Agent to filter report claims through the latest `research_synthesis` artifact.
  - Added report-level synthesis summary with included claim ids, excluded claim ids, and evidence gap ids.
  - Added Report UI pills for synthesis included/excluded counts.

## Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| SSH clone planning-with-files | Repository downloads | Succeeded | pass |
| Active plan creation | `.planning/.active_plan` points to RivalScope plan | Succeeded | pass |
| Secret scan pattern hardening | Real API key fragments are not stored in planning files | Replaced with generic `sk-` detection pattern | pass |
| RED test for calibration runner | New runner test fails before implementation | Failed on missing module as expected | pass |
| Runner unit test | Calibration runner test passes offline | `packages/agents/src/entailment-calibration-runner.test.ts` passed | pass |
| Typecheck | TypeScript strict checks pass | `npm run typecheck` passed after fixes | pass |
| Offline judge CLI | Deterministic-only calibration emits JSON and exit 0 | `npm run eval:entailment-judges --workspace @rivalscope/agents` passed | pass |
| RED tests for calibration-gated policy | Focused tests fail before implementation | Failed on missing policy fields and DAG order as expected | pass |
| Focused policy tests | Repair, workflow order, and Repair Loop parser tests pass | `workflow-runner`, `run-analysis`, and `project-repair-summary` focused suites passed | pass |
| RED tests for routed research | Focused tests fail before implementation | Failed on missing research agents and old web DAG shape as expected | pass |
| Focused routed research tests | Branch planning, branch results, synthesis, web DAG, UI parser, and persistence pass | 39 focused tests passed | pass |
| Typecheck after routed research | TypeScript strict checks pass | `npm run typecheck` passed | pass |
| RED test for synthesis-gated writing | Writer includes excluded claim before implementation | Failed with excluded claim still present in report body and claimIds | pass |
| Focused synthesis-gated writing tests | Writer filters report by synthesis included ids | `workflow-runner` and `project-research-summary` focused suites passed | pass |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-05-14 | HTTPS clone timed out connecting to github.com:443 | 1 | Retried with SSH URL; succeeded. |
| 2026-05-14 | `attest-plan.sh` permission denied when executed directly | 1 | Ran it through `sh attest-plan.sh`; attestation succeeded. |
| 2026-05-14 23:00 CST | Planning verification command contained real API key fragments in the regex | 1 | Replaced with generic secret detection regex before committing. |
| 2026-05-14 23:13 CST | Typecheck rejected direct `process.env`, readonly recorder reassignment, and loose usage reduce typing | 1 | Added explicit env extraction, mutable private recorder list with immutable getter, and typed usage accumulator. |
| 2026-05-14 23:23 CST | zsh treated `[projectId]` in a path as a glob | 1 | Re-ran the read command with the path quoted. |
| 2026-05-14 23:31 CST | `exactOptionalPropertyTypes` rejected optional properties explicitly passed as `undefined` | 1 | Built optional objects only when values exist. |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Phase 6.1 - Synthesis-Gated Report Writing is in progress. |
| Where am I going? | Finish verification, update docs, then continue toward evidence appendix/export and demo hardening. |
| What's the goal? | Build RivalScope into a ByteDance top-3-caliber competitor-intelligence Agent OS. |
| What have I learned? | `planning-with-files` is best used here as persistent `.planning` memory plus active-plan isolation, not as a wholesale framework import. |
| What have I done? | Completed the reproducible judge calibration runner, calibration-gated repair policy, first routed research DAG slice, and initial Writer gating by synthesis policy. |

---
Update this log after each completed phase, significant discovery, or failed attempt.
