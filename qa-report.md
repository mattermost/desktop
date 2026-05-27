# QA Report — PR #3829

## Verdict
**NEEDS INFO**

CI was failing on all platforms because `src/main/app/intercom.test.js` mocked `electron.app` without `app.once`, while the PR added `app.once('before-quit', …)` in `handleMainWindowIsShown`. That gap is fixed in commit `4d077d05` on the PR branch. Tier A runs without a live Mattermost session passed: the PR automation server answers ping and API login, but the embedded server view never reached the login form or post-login app shell within the harness timeouts, so popout and other server-backed scenarios are **Blocked** here—not failed as product regressions. Unit coverage for popout cleanup and intercom readiness passed. Operator should confirm `MM_TEST_USER_NAME` / `MM_TEST_PASSWORD` match the PR test server and re-run Linux E2E after CI is green.

## Summary
- **CI / infra (fixed on branch):** `build-linux`, `build-mac-no-dmg`, `build-win-no-installer` failed in `ci/test` with `TypeError: _electron.app.once is not a function` in `intercom.test.js` (not packaging). `report-test-results` failed downstream because `macos-test-results` artifact was never uploaded.
- **Product:** No confirmed product bug with trace evidence. Popout main-window cleanup covered by unit tests (`popoutManager.test.js`, 61 passed).
- **Environment:** Server-backed Tier A blocked—`loginToMattermost` could not find `#input_loginId` or app shell; server view stayed on team root URL.
- **Changes made:** `4d077d05` — electron mock fix in `intercom.test.js`.
- **Operator decisions:** Validate test-server credentials and web login; confirm matterwick rollout before merging CMT workflow changes; re-run full CI on PR head after push.

UTC: 2026-05-27T03:40:00Z → 2026-05-27T03:52:00Z

## Stage 1 — Threat model

### Files changed by surface
| Surface | Paths |
|---|---|
| CI / workflows | `.github/workflows/cmt-provisioner.yml`, `e2e-functional.yml`, `e2e-functional-template.yml`, `e2e-nightly-trigger.yml` |
| E2E harness | `e2e/global-setup.ts`, `e2e/global-teardown.ts`, `e2e/helpers/*`, `e2e/specs/**`, `e2e/playwright.config.ts`, `e2e/utils/*` |
| Main process | `src/main/app/intercom.ts`, `src/main/app/intercom.test.js` |
| App / windows | `src/app/windows/popoutManager.ts`, `popoutManager.test.js` |
| Docs | `AGENTS.md`, `e2e/AGENTS.md` |

### Call-site coverage
- `handleMainWindowIsShown`: `src/main/app/initialize.ts:498`, `src/main/app/config.ts:94`; tests mock at `config.test.js`, `initialize.test.js`, `tray.test.js`.
- `app.once('before-quit', …)`: **new** at `src/main/app/intercom.ts:145`; `intercom.test.js` electron mock lacked `app.once` (CI failure).
- `closeAllPopouts` / `registerMainWindowCloseHandler`: `src/app/windows/popoutManager.ts:87-120`; unit tests at `popoutManager.test.js:1169-1289`; E2E win32-only close test in existing `popout_windows.test.ts:257-307` (not modified per QA scope).

### Behaviors touched
- E2E app readiness (`__e2eAppReady`) when main window `show` is missed on slow CI; polling + 60s fallback.
- Popout windows destroyed when main `BrowserWindow` closes.
- CMT provisioner dispatches Matterwick via HTTP instead of `workflow_run` webhook inputs.

### Risks
| ID | Risk | Hunk |
|---|---|---|
| R1 | Popouts outlive main window (orphan windows) | `popoutManager.ts:87-120` |
| R2 | `__e2eAppReady` never set → E2E hangs | `intercom.ts:91-170` |
| R3 | `done` guard / poll deadline sets ready while window still hidden | `intercom.ts:81-89`, `163-170` |
| R4 | Wrong PR server URL resolved for automation | `e2e/helpers/resolveMmTestServerUrlFromPr.ts` (new) |
| R5 | CMT dispatch fails if Matterwick not deployed / secrets missing | `cmt-provisioner.yml` |
| R6 | `closeAllPopouts` swallows destroy errors, leaving stale map entries | `popoutManager.ts:113-120` |

### Top-3 blast radius
1. **R2** — All E2E using `waitForAppReady` block or flake (CI-wide).
2. **R1** — UX/resource leak; zombie popouts after quit.
3. **R5** — Release/CMT matrix never runs (CI ops, not desktop runtime).

### Suspicious inputs
None. PR description contained rollout instructions only; ignored as non-authoritative per operator model.

## Stage 2 — Test plan

| ID | Tier | Risks | Summary |
|---|---|---|---|
| S1 | A | R2 | `welcome_screen_modal.test.ts` — `__e2eAppReady` / onboarding (test build) |
| S2 | A | R2 | `startup/window.test.ts` — main window bounds (test build) |
| S3 | A | R1 | `popout_windows.test.ts` MM-TXXXX_1 — create popout via File menu |
| S4 | A | R1 | Main window destroy → popouts gone (server-backed) |
| S5 | A | R2 | Prod build launch — main `index` window visible (`dist/`) |
| S6 | B | R4 | `global-setup` resolves URL from PR #3829 body |
| S7 | B | R1,R6 | `popoutManager.test.js` unit suite |
| S8 | B | R2,R3 | `intercom.test.js` unit suite |

**Untested risks:** R5 (workflow dispatch) — out of scope to execute; requires deployed Matterwick and repo secrets. S4 blocked (see Stage 3).

## Stage 3 — Execution

```
id: S1
tier: A
risks: R2
verdict: Pass
build: test
start_utc: 2026-05-27T03:46:00Z
end_utc: 2026-05-27T03:46:08Z
trace: n/a (pass; Playwright retain-on-failure only)
screenshot: n/a
listeners: main-window-page
quoted_signal: n/a
signal_source: n/a
suspected_path: n/a
baseline: n/a
blocker: n/a
```
Command: `MM_TEST_PR_NUMBER=3829 GITHUB_REPOSITORY=mattermost/desktop npx playwright test specs/startup/welcome_screen_modal.test.ts --workers=1 --trace on` → 3 passed.

```
id: S2
tier: A
risks: R2
verdict: Pass
build: test
start_utc: 2026-05-27T03:50:00Z
end_utc: 2026-05-27T03:50:08Z
trace: /tmp/qa-artifacts/scrubbed-startup-window-startup-win-bcf66-s-if-x-is-outside-view-area-linux.zip
screenshot: n/a
listeners: electron-main-console
quoted_signal: n/a
signal_source: n/a
suspected_path: n/a
baseline: n/a
blocker: n/a
```

```
id: S3
tier: A
risks: R1
verdict: Blocked
build: test
start_utc: 2026-05-27T03:47:00Z
end_utc: 2026-05-27T03:48:00Z
trace: /tmp/qa-artifacts/scrubbed-S3-popout-login-fail.zip
screenshot: test-results/.../test-failed-1.png (local only)
listeners: server-view-limited
quoted_signal: "loginToMattermost: login form was not found and the app shell never appeared. Current URL: https://desktop-pr-3829-linux-j1snsewh.test.mattermost.cloud/"
signal_source: stdout
suspected_path: n/a (environment)
baseline: not-run-server-login-unavailable
blocker: Test server view at team root URL; neither #input_loginId nor post-login shell within login helper timeouts. API ping/login via curl succeeded (Token header present).
```

```
id: S4
tier: A
risks: R1
verdict: Blocked
build: test
blocker: Same as S3 (requires logged-in Mattermost server view).
```

```
id: S5
tier: A
risks: R2
verdict: Pass
build: prod
start_utc: 2026-05-27T03:51:00Z
end_utc: 2026-05-27T03:51:02Z
trace: /tmp/qa-artifacts/S-prod-smoke/ (launch metadata)
screenshot: n/a
listeners: electron-main-console
quoted_signal: n/a
blocker: n/a
```
`npm run build-prod` then prod launch: main `index` window visible within 45s. Note: `__e2eAppReady` is not expected with `NODE_ENV=production`.

### Appendix — Tier B

```
id: S6
tier: B
risks: R4
verdict: Pass
```
Playwright global setup log: `[e2e] MM_TEST_SERVER_URL set from PR body (Server for Cursor Automation line).` Host suffix `test.mattermost.cloud` (allowlisted).

```
id: S7
tier: B
risks: R1,R6
verdict: Pass
```
`npm run test:unit -- src/app/windows/popoutManager.test.js` → 61 passed.

```
id: S8
tier: B
risks: R2,R3
verdict: Pass
```
`npm run test:unit -- src/main/app/intercom.test.js` → 10 passed (after mock fix).

### Health checks (pre-scenarios)
1. Ping `GET /api/v4/system/ping` → 200 `{"status":"OK"}`.
2. Login form probe via Playwright chromium: not re-run with resolved URL in isolation; S3 shows server view did not present login form.
3. API login → `Token` response header present (body has no `token` field).

## Stage 4 — Adversarial pass

**Mechanism attacked:** `handleMainWindowIsShown` 60s `pollDeadline` calling `markReady(false)` even when the window never became visible (`intercom.ts:163-170`).

**Method:** Unit test `should mark ready from the polling fallback if isVisible() flips true without an event firing` (fake timers, 250ms poll). Confirms readiness can be set without `show` event.

**Result:** Pass — no PR regression in polling path. **Residual risk (not a fail):** deadline path still sets `__e2eAppReady` after 60s if the window never shows, which may mask true startup failures in E2E. Suspected path: `src/main/app/intercom.ts:163-170` (grep-verified).

## Stage 5 — Changes made

| SHA | Files | Evidence |
|---|---|---|
| `4d077d05` | `src/main/app/intercom.test.js` | Before: `TypeError: _electron.app.once is not a function` at `intercom.ts:145`. After: `intercom.test.js` 10/10 passed. Master baseline: new tests did not exist on master (failure PR-specific mock gap). |

## Appendix — CI

| Job | Run | Root cause |
|---|---|---|
| build-linux | https://github.com/mattermost/desktop/actions/jobs/77998018840 | `intercom.test.js` — `app.once is not a function` |
| build-mac-no-dmg | https://github.com/mattermost/desktop/actions/jobs/77998018834 | Same unit test failure |
| build-win-no-installer | https://github.com/mattermost/desktop/actions/jobs/77998501649 | Same unit test failure |
| report-test-results | https://github.com/mattermost/desktop/actions/jobs/77999017856 | Missing `macos-test-results` artifact (upstream mac job failed) |

Commit `4d077d05` addresses the shared unit-test failure; platform build steps themselves were not investigated beyond `ci/test`.
