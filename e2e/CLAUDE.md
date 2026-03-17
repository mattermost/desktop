# E2E Agent Guide

This directory contains the Mattermost Desktop E2E test suite.

Follow these instructions when writing, fixing, optimizing, or running tests in this folder.

## Objective

Your job is to make the Playwright E2E suite more reliable, faster, and easier to debug without masking real regressions.

Success means:
- the target spec file passes locally with the exact command used to verify it
- the fix is minimal and technically justified
- the test remains readable and deterministic
- the change does not reintroduce legacy `electron-mocha`, `robotjs`, or Mochawesome flows

## Runner

- Use Playwright only.
- Keep `playwright` and `@playwright/test` on the exact same version.
- Import `test` and `expect` from `e2e/fixtures/index.ts`.
- Reuse helpers from `e2e/helpers` before creating new launch, login, or server-discovery logic.
- Do not add new `electron-mocha`, `robotjs`, or Mochawesome-based code.

## Version Compatibility

Treat dependency upgrades as infrastructure changes, not routine edits.

When changing Electron, Playwright, or `@playwright/test`:

- keep `playwright` and `@playwright/test` pinned to the same version
- assume Electron launch behavior may change
- assume embedded view discovery may change
- assume preload/test hooks may change
- assume CI artifact behavior may change

Do not claim an upgrade is safe based only on install success or typecheck success.

Minimum verification after an Electron or Playwright upgrade:

1. `npx playwright test --list`
2. one startup smoke file
3. one server-backed file
4. one menu-bar file
5. one downloads file
6. one CI-shaped run with `CI=1`

If any of those fail, debug the shared infrastructure first:
- `e2e/fixtures/index.ts`
- `e2e/helpers/appReadiness.ts`
- `e2e/helpers/serverMap.ts`
- `e2e/helpers/login.ts`
- `src/main/app/initialize.ts`
- preload test hooks and any `__e2e` refs

## Default Workflow

When asked to fix E2E tests, use this sequence:

1. Read the target spec and the helpers it depends on.
2. Run one spec file at a time.
3. If the spec fails, identify the real failure mode before editing.
4. Fix the smallest useful layer:
   - spec logic
   - shared helper
   - fixture
   - app-side test hook
5. Rerun the same spec file.
6. Only stage the file after the target spec passes.

Do not claim a file is fixed unless you reran that exact spec and it passed.

## Commands

Prefer these commands:

- Single file:
  - `env MM_TEST_SERVER_URL=http://localhost:8065 MM_TEST_USER_NAME=sysadmin MM_TEST_PASSWORD=Sys@dmin-sample1 npx playwright test <spec> --reporter=list --workers=1`
- CI-shaped local run:
  - `CI=1 npx playwright test <spec> --workers=1`
- List tests:
  - `npx playwright test --list`

If a failed run leaves Electron behind:

- `killall Electron 2>/dev/null || true`

## Environment

Many server-backed specs require:

- `MM_TEST_SERVER_URL`
- `MM_TEST_USER_NAME`
- `MM_TEST_PASSWORD`

Do not remove skips or platform guards unless the test can actually run in the current environment.

Examples:
- Tests tagged for Windows or Linux are not truthfully verified on macOS.
- Tests requiring a live Mattermost server should not be treated as fixed unless those env vars are set and the spec was rerun.

## Test Design Rules

Prefer:
- deterministic selectors and explicit waits
- app-menu or main-process invocation over fragile OS-level keyboard delivery
- shared login/setup in `beforeAll` for expensive serial suites when it materially reduces runtime
- local mocks for third-party dependencies when the behavior under test does not require the real external service
- helper reuse over copy-pasted launch/login code

Avoid:
- arbitrary sleeps when a real readiness signal exists
- introducing new global state coupling between tests
- hiding real failures with `skip`, broad retries, or weakened assertions
- depending on window focus unless the behavior specifically requires it
- duplicating server-discovery or app-readiness logic already handled by fixtures/helpers

## Fixture Rules

`e2e/fixtures/index.ts` is the shared Playwright fixture layer.

Use it for:
- `electronApp`
- `mainWindow`
- `serverMap`
- `appConfig`

Do not bypass fixtures unless there is a concrete reason and the spec genuinely needs custom launch control.

## Debugging Guidance

When a test fails, classify the failure first:

- app did not launch
- app launched but readiness never completed
- server view discovery failed
- login/navigation failed
- selector is stale
- menu or window action is flaky
- teardown left Electron hanging
- dependency upgrade changed behavior
- Playwright/Electron compatibility mismatch

Then fix the layer that owns the failure.

When the failure appears across many files at once, assume shared infrastructure first, not broken assertions in every spec.

Good fixes:
- waiting for the correct embedded window to load
- creating real files on disk when the app validates file existence
- replacing flaky keyboard shortcuts with direct menu invocation
- moving repeated login into shared setup for serial suites
- restoring version parity between `playwright` and `@playwright/test`
- updating shared discovery or readiness hooks after an Electron upgrade

Weak fixes:
- adding long sleeps
- retrying the whole test without understanding the race
- asserting less
- bumping one Playwright package without the other
- changing many spec assertions before validating the fixture layer

## Reporting And Artifacts

Playwright artifacts are the source of truth.

- HTML report: `e2e/playwright-report`
- JUnit: `e2e/test-results/e2e-junit.xml`
- Video: retained only on final failure
- Trace: retained only on final failure

If a test fails once and passes on retry, final artifacts should not be treated as a real failure.

## Editing Rules

- Use `apply_patch` for file edits.
- Keep changes scoped to the problem being solved.
- Do not revert unrelated user changes.
- Preserve existing verified harness patterns unless there is a strong reason to replace them.

## Output Expectations

When reporting work:

- state the exact spec command you ran
- state pass/fail result clearly
- name the real cause, not just the symptom
- summarize the fix in terms of behavior

Good example:

- `env MM_TEST_SERVER_URL=http://localhost:8065 MM_TEST_USER_NAME=sysadmin MM_TEST_PASSWORD=Sys@dmin-sample1 npx playwright test menu_bar/view_menu.test.ts --reporter=list --workers=1`
- Result: `9 passed`
- Root cause: server view discovery assumed Playwright pages, but the app now uses embedded `WebContentsView`s.
- Fix: rewrote shared server discovery to use main-process test refs and updated the affected specs to use that path.

Bad example:

- `I changed some waits and now it works.`

## If Unsure

If two approaches are possible, prefer the one that:
- improves determinism
- reduces suite runtime
- keeps the test closest to real user behavior without depending on flaky OS behavior
- strengthens shared infrastructure instead of patching the same issue repeatedly in individual specs

If the change is a dependency upgrade, prefer the approach that:
- preserves version parity
- validates a small cross-section of the suite before broad edits
- fixes the shared harness before touching many spec files
