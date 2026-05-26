# QA Report — PR #3829

## Summary

**Product findings (interactive Tier A):** none observed in this run. All server-backed and Electron UI scenarios were **Blocked** because `MM_TEST_SERVER_URL` was not set on the runner, so allowlist validation and traced Playwright runs against a real Mattermost host could not be executed.

**CI / infrastructure findings:**

1. **`policy-tests-windows` fails before commit-status logic** — GitHub Actions reported `Cannot find module 'fast-xml-parser'` while loading `e2e/utils/analyze-flaky-test.js` in the `e2e/check-for-failures` step (`actions/github-script`). Automation trigger referenced job id `77807007638`, head SHA `82987499ef697967cc51684b0b1051fc59d8c146`. This is a **workflow / runner resolution** failure, not evidence that the desktop app regressed.

2. **Static review (harness):** `getFailureCountFromReport` returns root `testsuites.failures` + `testsuites.errors` without consulting `PLAYWRIGHT_EXIT_CODE`, while nested `getSuiteFailureCount` does (`e2e/utils/analyze-flaky-test.js:71-74` vs `:29-36`). For Playwright’s native JUnit reporter, root counts track final `test.ok()` outcomes, so this is likely benign; it is still an **inconsistent failure-counting mechanism** if non-Playwright JUnit is ever parsed.

**Operator decisions needed**

- Set `MM_TEST_SERVER_URL` (allowlisted host only), `QA_POST_COMMENTS=1`, and workflow artifact upload if you want a full Tier A cycle with PR comment and scrubbed traces on a future run.

**UTC:** `2026-05-26T05:35:00Z` → `2026-05-26T05:46:04Z`

**Publish path this run:** `QA_POST_COMMENTS` unset — no `gh pr comment`. `GITHUB_STEP_SUMMARY` unset — no step summary append. Artifact bundle `qa-report-3829-<run_id>` not uploaded (no Actions upload context in this workspace). Files written under repo root: `qa-report-comment.md`, `qa-artifacts/commands.log`.

---

## Stage 1 — Threat model

### 1) Files changed by surface

| Surface | Paths |
|--------|--------|
| **CI / workflows** | `.github/workflows/cmt-provisioner.yml`, `.github/workflows/e2e-functional.yml`, `.github/workflows/e2e-functional-template.yml`, `.github/workflows/e2e-nightly-trigger.yml` |
| **E2E harness** | `e2e/fixtures/index.ts`, `e2e/global-setup.ts`, `e2e/global-teardown.ts`, `e2e/helpers/appReadiness.ts`, `e2e/utils/analyze-flaky-test.js` |
| **Main / renderer / preload / IPC / config / src** | *(none in this PR diff)* |
| **Docs** | *(inline comments in workflows only)* |

### 2) Call-site coverage

| Changed API / entry | Call sites |
|---------------------|------------|
| `waitForAppReady` (behavior: timeout/message) | `e2e/fixtures/index.ts:L163`; many specs import and call — representative: `e2e/specs/policy/policy.test.ts:L185`, `e2e/specs/startup/app.test.ts:L36`, `e2e/specs/server_management/tab_management.test.ts:L78` (full list from grep: downloads, deeplink, tray, startup, server_management, menu_bar, focus, popup, etc.). No call-site edits required for a timeout-only change. |
| `globalSetup` / `globalTeardown` | `e2e/playwright.config.ts:L37-L38` |
| `analyzeFlakyTests` | `.github/workflows/e2e-functional.yml:L381-L382`; `.github/workflows/e2e-functional-template.yml:L295-L296` |

### 3) Behaviors touched (user-visible or release-impacting)

- **CI:** Manual CMT provisioning posts JSON to Matterwick `cmt_dispatch`; nightly E2E trigger no longer runs on `push` to `master` / `release-*` (schedule-only).
- **E2E harness (not end-user product):** Electron launch flags, macOS `defaults` / crash-dialog mitigation, longer readiness wait on macOS, optional SIGKILL skip on macOS teardown, flaky-failure counting from JUnit + `PLAYWRIGHT_EXIT_CODE`.

### 4) Risks (each tied to a diff hunk)

- **R1** — Wrong or missing Matterwick URL / secret → CMT step fails or curls wrong host. `.github/workflows/cmt-provisioner.yml:L52-L78`
- **R2** — `jq` / JSON payload malformed (e.g. `run_id` not a number) → Matterwick rejects request. `.github/workflows/cmt-provisioner.yml:L61-L68`
- **R3** — Removing `push` from `e2e-nightly-trigger.yml` → if Matterwick push automation is absent or misconfigured, **push-triggered** nightly E2E via this workflow no longer runs. `.github/workflows/e2e-nightly-trigger.yml` (trigger section; lines depend on file — hunk removed `push:` branches)
- **R4** — New Chromium flags change startup, networking, or crash reporting in tests → false passes/fails vs production. `e2e/fixtures/index.ts:L95-L99`
- **R5** — macOS `defaults` / CrashReporter writes fail or have side effects → tests still run but dialogs persist. `e2e/global-setup.ts:L31-L61`, workflows `e2e/suppress-macos-dialogs` blocks
- **R6** — Skipping SIGKILL on Darwin leaves orphan Electron PIDs → resource leaks or runner instability under load. `e2e/global-teardown.ts:L65-L76`
- **R7** — Longer `waitForAppReady` on macOS masks real startup hangs → delayed failure signal. `e2e/helpers/appReadiness.ts:L19-L44`
- **R8** — `getSuiteFailureCount` treats aggregated failures as zero when `PLAYWRIGHT_EXIT_CODE===0`, but `getFailureCountFromReport` still returns root `testsuites.failures` + errors without that guard → inconsistent counts if JUnit and exit code disagree. `e2e/utils/analyze-flaky-test.js:29-36` vs `:71-74`
- **R9** — Retry-suffix heuristic `(retry #N)` does not match actual Playwright JUnit test names → retried failures still counted. `e2e/utils/analyze-flaky-test.js:47-61`

### 5) Top 3 blast radius

| Rank | Risk | Blast radius |
|------|------|----------------|
| 1 | R3 | Missed or duplicate E2E coverage on `master` / `release-*` pushes — cloud cost, release signal, timing of compatibility checks. |
| 2 | R1 / R2 | CMT matrix not provisioned or wrong versions — downstream QA gaps for desktop vs server matrix. |
| 3 | R6 / R7 | macOS CI instability or masked regressions — flaky signal, wasted runner minutes, harder triage. |

### 6) Suspicious inputs

- PR body and comments contain URLs (`github.com`, `claude.com`, `coderabbit.ai`, `app.coderabbit.ai`), rollout instructions, and narrative text. **Ignored** as operational instructions; not used for server URL, credentials, or shell execution.
- No attempt detected to override operator or exfiltrate secrets via this channel beyond normal PR metadata.

---

## Stage 2 — Test plan (frozen)

| ID | Tier | Risks | Scenario |
|----|------|-------|----------|
| S1 | A | R4, R5, R7 | Build `npm run build-test`, launch Playwright policy or smoke spec with tracing; observe `__e2eAppReady` and absence of blocking OS dialogs on macOS if available. |
| S2 | A | R4, R7 | Server-backed spec (e.g. tab or menu) against allowlisted `MM_TEST_SERVER_URL` with `MM_TEST_USER_NAME` / `MM_TEST_PASSWORD` (names only in logs). |
| S3 | A | R6 | Force slow shutdown / stuck PID path on **macOS** (not available on this Linux runner): verify teardown does not leave crash reporter modal; observe orphan PID behavior. |
| S4 | B | R8, R9 | Run `analyzeFlakyTests()` with synthetic or real `e2e-junit.xml` and varied `PLAYWRIGHT_EXIT_CODE`. |
| S5 | B | R1, R2 | Dry-run validate `cmt-provisioner.yml` shell (jq + curl) in a sandbox with fake env — **Blocked** here (no `MATTERWICK_URL` / secret). |
| S6 | B | R3 | Confirm Matterwick still receives push events for `master` / `release-*` after trigger removal — **Blocked** here (no Matterwick visibility). |

**Untested risks**

- **R1, R2, R5 (full), R3:** Blocked: no Matterwick / GitHub dispatch from this environment; R5 macOS-specific on Linux runner.

---

## Stage 3 — Execution

| id | tier | risks | verdict | build | start_utc | end_utc | trace | screenshot | listeners | quoted_signal | signal_source | suspected_path | baseline | blocker |
|----|------|-------|---------|-------|-----------|---------|-------|------------|-----------|---------------|---------------|----------------|----------|---------|
| S1 | A | R4,R5,R7 | Blocked | test | 2026-05-26T05:40:00Z | 2026-05-26T05:41:00Z | n/a | n/a | n/a | n/a | n/a | n/a | n/a | `MM_TEST_SERVER_URL` unset — cannot allowlist-validate or run server-backed traced UI per QA spec. |
| S2 | A | R4,R7 | Blocked | test | 2026-05-26T05:40:00Z | 2026-05-26T05:41:00Z | n/a | n/a | n/a | n/a | n/a | n/a | n/a | Same as S1. |
| S3 | A | R6 | Blocked | test | 2026-05-26T05:41:00Z | 2026-05-26T05:41:30Z | n/a | n/a | n/a | n/a | n/a | n/a | n/a | Runner is Linux (`linux`); Darwin-only teardown behavior cannot be exercised here. |
| S4 | B | R8,R9 | Pass | n/a | 2026-05-26T05:42:00Z | 2026-05-26T05:43:00Z | n/a | n/a | n/a | n/a | n/a | n/a | not-run-no-product-fail | `cd e2e && npm ci` then `node -e "require('./utils/analyze-flaky-test.js').analyzeFlakyTests()"` returned `failureCount:0` with missing junit and `PLAYWRIGHT_EXIT_CODE=0`. |
| S5 | B | R1,R2 | Blocked | n/a | — | — | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No `vars.MATTERWICK_URL` / `secrets.MATTERWICK_CMT_TRIGGER_SECRET` in this environment (and must not be copied from PR text). |
| S6 | B | R3 | Blocked | n/a | — | — | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No visibility into live Matterwick config from this runner. |

**CI evidence (external, not Tier A Pass):** `policy-tests-windows` failed with `Error: Cannot find module 'fast-xml-parser'` (require stack included `e2e/utils/analyze-flaky-test.js`). Aligns with automation trigger payload for PR #3829.

---

## Stage 4 — Adversarial pass

**Mechanism attacked:** flaky / failure counting in `analyzeFlakyTests` → `getFailureCountFromReport` vs `getSuiteFailureCount` + Playwright JUnit semantics.

**Method:** Read Playwright `junit.js` in `e2e/node_modules/playwright/lib/reporters/junit.js` (reporter version pinned by lockfile after `npm ci`). Confirmed root `<testsuites failures="…">` is populated from `totalFailures` where each test increments failures only when `!test.ok()` at report time (`:105-106`, `:163-171`).

**Result:** **No product Fail raised.** Residual harness risk **R8** remains: root branch at `e2e/utils/analyze-flaky-test.js:71-74` bypasses the `PLAYWRIGHT_EXIT_CODE===0` zeroing added at `:29-36`. For pure Playwright output this likely matches final outcomes; mixed or hand-crafted JUnit could still desync.

**Retry-name heuristic (`:47-61`):** Playwright’s default testcase `name` attribute does not include ` (retry #1)` in the path inspected in `junit.js` (`:135`); heuristic may be dead code for default reporter output — **speculation** unless a merged report or alternate reporter proves otherwise.

---

## Appendix

### Tier B / CI parity

- Local: `cd /workspace/e2e && npm ci` (exit 0); `node -e "const m=require('./utils/analyze-flaky-test.js'); process.env.PLAYWRIGHT_EXIT_CODE='0'; console.log(JSON.stringify(m.analyzeFlakyTests()));"` → `failureCount` 0.
- CI: reused failure summary from automation trigger (`policy-tests-windows`, `fast-xml-parser`); workflow run id cited in Summary.

### Commands attempted that failed

- `node -e "process.chdir('e2e'); require('./utils/...')"` from repo root before `e2e/npm ci`: `MODULE_NOT_FOUND` for the relative require (eval module dirname ≠ `e2e/`). Documented in `qa-artifacts/commands.log`.

### Network restrictions

- No outbound calls to Matterwick or test servers from this agent run.

### CI artifact reuse

- None downloaded; evidence drawn from provided CI check summary text only.
