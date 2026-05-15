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

### Phase 6.2: Evidence Appendix Export
- **Status:** in progress
- **Started:** 2026-05-15 00:16 CST
- Actions taken:
  - Added `buildReportExport` for deterministic JSON and Markdown exports.
  - Added evidence appendix rows from Claim Trust nodes, including claim, fact, source chunk, source, trust score, and risk level.
  - Added export response helper with stable markdown/json attachment filenames.
  - Added project export route at `/projects/[projectId]/export?format=markdown|json`.
  - Added project-page `Export MD` and `Export JSON` actions.

### Phase 6.3: Stable Seeded Demo Script
- **Status:** complete
- **Completed:** 2026-05-15 00:32 CST
- Actions taken:
  - Created branch `codex/seeded-demo-script`.
  - Added `buildSeedDemoProjectInput()` as a deterministic offline demo contract for Cursor, Codex, and Trae.
  - Added root `npm run demo:seed` script.
  - Added `apps/web/scripts/seed-demo-project.ts`, which requires `DATABASE_URL`, deletes only the scoped demo project for `demo@rivalscope.local`, recreates seeded competitors/dimensions/sources, persists source collection tool-call observability, and prints project/export URLs.
  - Verified idempotency against a temporary local Postgres container on port `15433`; repeated seed left one scoped demo project.
  - Docker Compose `postgres:16-alpine` pull was blocked by Docker Hub TLS timeout, so validation used already available local image `postgres:18-alpine` without changing project compose files.

### Core Quality Hardening: Source Coverage And Branch Citation Validity
- **Status:** in progress
- **Started:** 2026-05-15
- Actions taken:
  - Created branch `codex/core-quality-hardening`.
  - Added TDD coverage proving routed research must exclude claims with incomplete fact citation chains from synthesis inclusion.
  - Updated routed research branch evaluation so a claim is valid for a competitor/dimension branch only when all cited facts exist and match that exact branch.
  - Added explicit `invalid_claim_citations` evidence gaps and partial branch status when facts exist but the branch claim is not publication-safe.
  - Added TDD coverage for source collection by competitor × dimension, with URL dedupe.
  - Updated source ingestion so each competitor/dimension pair gets its own search request and duplicate URLs are skipped before fetch/chunk persistence.
  - Added TDD coverage proving model-synthesized claims cannot mix dimensions or misuse `single_competitor` when citing facts from multiple competitors.
  - Updated Analyst normalization so model claims are rejected when cited fact dimensions do not match the claim dimension, while valid same-dimension comparative claims remain allowed.
  - Added source traceability to trajectory eval metrics and scoring.
  - Added `untraced_fact` trajectory findings so facts without source chunks no longer count toward supported claim or required-dimension coverage.
  - Extended Critic Agent with high-severity `untraced_fact` findings for claims citing facts that lack source chunks.
  - Extended Repair Planner so high-severity `untraced_fact` claim findings become deterministic claim-removal actions instead of unresolved warnings.

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
| RED tests for report export | Export modules do not exist before implementation | Failed on missing `report-export` and `report-export-route` modules | pass |
| Focused report export tests | JSON/Markdown export and attachment responses are generated | `report-export` and `report-export-route` focused suites passed | pass |
| RED test for demo seed helper | `demo-project-seed` module is absent | Failed on missing module as expected | pass |
| Focused demo seed helper test | Offline demo contract is deterministic and contains sources | `apps/web/lib/demo-project-seed.test.ts` passed | pass |
| Demo seed missing DB guard | Script fails clearly without `DATABASE_URL` | `npm run demo:seed` exited 1 with required env message | pass |
| Demo seed DB run | Script creates project and prints project/export URLs | Passed against temporary Postgres on `localhost:15433` | pass |
| Demo seed idempotency | Repeated run leaves one scoped demo project | SQL count for owner/name returned `1` | pass |
| Full verification after demo seed | Typecheck/test/evals/build/audit/secret scan pass | Passed; known moderate Next/PostCSS audit advisory remains non-blocking | pass |
| RED test for invalid branch citations | Branch incorrectly includes claim citing unknown fact | Failed with `claim_mixed_known_and_unknown` included in succeeded branch | pass |
| Focused routed research hardening | Invalid citation claim excluded and branch marked partial | `packages/agents/src/workflow-runner.test.ts -t "research routing agents"` passed | pass |
| RED test for dimension source search | Source ingestion searches all dimensions together once | Failed with one combined search call | pass |
| Focused source ingestion hardening | Per-dimension search and URL dedupe work | `apps/web/lib/source-ingestion.test.ts` passed | pass |
| Related core tests after hardening | Source tooling, seed demo, source persistence, workflow runner pass | 5 focused suites / 52 tests passed | pass |
| Typecheck after core hardening | TypeScript strict checks pass | `npm run typecheck` passed | pass |
| RED tests for model claim schema hardening | Analyst accepts mixed-competitor single claim and mixed-dimension claim | Failed because model claims were accepted before validation | pass |
| Focused analyst hardening tests | Invalid model claims rejected; valid comparative claim allowed | `packages/agents/src/workflow-runner.test.ts -t "analyst agent"` passed | pass |
| Workflow runner after claim hardening | Full agent workflow suite passes | `packages/agents/src/workflow-runner.test.ts` passed, 36 tests | pass |
| RED test for trajectory source traceability | Eval counts fact without source chunks as supported | Failed with evidence and dimension coverage still at `1` | pass |
| Golden eval after source traceability | Golden fixture expected old broken score | Updated expected score from `39` to `54`; `npm run eval:golden` passed | pass |
| RED test for repair untraced facts | Repair Planner keeps `untraced_fact` as warning | Failed with `keep_with_warning` and no quality delta | pass |
| Focused untraced fact workflow tests | Critic flags untraced facts and Repair Planner removes affected claims | `packages/agents/src/workflow-runner.test.ts -t "source chunks"` and `-t "untraced"` passed | pass |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-05-14 | HTTPS clone timed out connecting to github.com:443 | 1 | Retried with SSH URL; succeeded. |
| 2026-05-14 | `attest-plan.sh` permission denied when executed directly | 1 | Ran it through `sh attest-plan.sh`; attestation succeeded. |
| 2026-05-14 23:00 CST | Planning verification command contained real API key fragments in the regex | 1 | Replaced with generic secret detection regex before committing. |
| 2026-05-14 23:13 CST | Typecheck rejected direct `process.env`, readonly recorder reassignment, and loose usage reduce typing | 1 | Added explicit env extraction, mutable private recorder list with immutable getter, and typed usage accumulator. |
| 2026-05-14 23:23 CST | zsh treated `[projectId]` in a path as a glob | 1 | Re-ran the read command with the path quoted. |
| 2026-05-14 23:31 CST | `exactOptionalPropertyTypes` rejected optional properties explicitly passed as `undefined` | 1 | Built optional objects only when values exist. |
| 2026-05-15 00:28 CST | `docker compose up -d postgres` could not pull `postgres:16-alpine` due to Docker Hub TLS handshake timeout | 2 | Used existing local `postgres:18-alpine` image in a temporary `rivalscope-seed-postgres` container on port `15433` for DB verification. |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Core hardening branch is in progress after user prioritized internals over display polish. |
| Where am I going? | Finish source/DAG/facts/report/eval hardening slices, then return to deployment and demo narrative. |
| What's the goal? | Build RivalScope into a ByteDance top-3-caliber competitor-intelligence Agent OS. |
| What have I learned? | `planning-with-files` is best used here as persistent `.planning` memory plus active-plan isolation, not as a wholesale framework import. |
| What have I done? | Completed calibration runner, calibration-gated repair policy, routed research DAG, synthesis-gated writing, evidence appendix export, reproducible offline seeded demo script, and first core hardening slice for source coverage plus branch citation validity. |

---
Update this log after each completed phase, significant discovery, or failed attempt.
