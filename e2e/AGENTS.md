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

## Architecture: Two Kinds of Windows

This is the most important thing to understand before writing any test.

The app has two distinct window types and they are accessed differently:

**1. The main internal window** — the Electron `BrowserWindow` that hosts the app chrome (tab bar, server switcher, settings). Accessible as a Playwright `Page` via the `mainWindow` fixture or by finding the window whose URL contains `index`.

**2. Server views** — each Mattermost server renders in its own `WebContentsView`, which is NOT a `BrowserWindow` and does NOT appear in `app.windows()`. They are discovered via main-process registries exposed on `global.__e2eTestRefs`.

```typescript
// ❌ WRONG — app.windows() only returns BrowserWindows, not WebContentsViews
const serverPage = app.windows().find((w) => w.url().includes('mattermost'));

// ✅ CORRECT — use buildServerMap() which reads from __e2eTestRefs
const serverMap = await buildServerMap(electronApp);
const exampleServer = serverMap['example'][0].win;
await exampleServer.waitForSelector('#sidebarItem_town-square');
```

`app.evaluate()` runs in the **main process** context — `ipcRenderer` does not exist there. Use it only to read/write main-process state via `global.__e2eTestRefs` or `global.__e2eAppReady`.

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

**Example — fixing a failing server view test:**

```
# 1. Read the spec
Read: e2e/specs/server_management/tab_management.test.ts
Read: e2e/helpers/serverMap.ts
Read: e2e/helpers/appReadiness.ts

# 2. Run just the failing file
env MM_TEST_SERVER_URL=http://localhost:8065 MM_TEST_USER_NAME=sysadmin MM_TEST_PASSWORD=Sys@dmin-sample1 \
  npx playwright test specs/server_management/tab_management.test.ts --reporter=list --workers=1

# 3. Failure: "buildServerMap timed out" — server views never registered
# Root cause: test called buildServerMap() before waitForAppReady() completed
# Fix: the fixture already chains appReady → serverMap, so the spec was
#      bypassing the fixture and calling buildServerMap() directly too early.
# Fix layer: spec logic — use the serverMap fixture instead

# 4. Rerun same file — confirm pass
```

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

**Prefer deterministic selectors and explicit waits over sleeps:**

```typescript
// ❌ WRONG
await page.click('#newTabButton');
await new Promise((resolve) => setTimeout(resolve, 2000)); // arbitrary sleep
const tab = await page.waitForSelector('.TabBar li:nth-child(2)');

// ✅ CORRECT
await page.click('#newTabButton');
await page.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15_000});
```

**Prefer polling over one-shot assertions for async state:**

```typescript
// ❌ WRONG — tab title updates asynchronously, this will flake
const text = await page.locator('.TabBar li:nth-child(1)').innerText();
expect(text).toContain('Off-Topic');

// ✅ CORRECT
await expect(page.locator('.TabBar li.serverTabItem:nth-child(1)')).toContainText('Off-Topic', {timeout: 15_000});
```

**Prefer main-process invocation over keyboard shortcuts for menu actions:**

```typescript
// ❌ WRONG — keyboard delivery is OS-dependent and fails in CI headless mode
await mainWindow.keyboard.press('Meta+Shift+S');

// ✅ CORRECT — invoke via the app menu directly or via IPC
await electronApp.evaluate(() => {
    const refs = (global as any).__e2eTestRefs;
    refs.ServerManager.updateCurrentServer(serverId);
});
```

**Prefer shared login in `beforeAll` for serial suites:**

```typescript
// ❌ WRONG — logs in before every test in a 10-test suite (10× expensive)
test.beforeEach(async ({serverMap}) => {
    await loginToMattermost(serverMap['example'][0].win);
});

// ✅ CORRECT — login once, reset cheap state between tests
test.describe.configure({mode: 'serial'});
test.beforeAll(async ({serverMap}) => {
    await loginToMattermost(serverMap['example'][0].win);
});
test.beforeEach(async () => {
    await resetState(); // cheap — just switches back to the right server/tab
});
```

**Avoid duplicating launch/login logic already in fixtures:**

```typescript
// ❌ WRONG — reimplements what the fixture already does
test('my test', async () => {
    const userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mm-'));
    writeConfigFile(userDataDir, demoConfig);
    const app = await electron.launch({executablePath: electronBinaryPath, ...});
    await waitForAppReady(app);
    // ... test ...
    await app.close();
});

// ✅ CORRECT — let the fixture handle it
test('my test', async ({electronApp, mainWindow, serverMap}) => {
    // app is already launched, ready, and torn down automatically
});
```

The exception is tests that genuinely need custom launch parameters (e.g., `MM-T4400` testing singleton lock enforcement), where the spec controls its own launch with a short timeout and specific env vars.

## Fixture Rules

`e2e/fixtures/index.ts` is the shared Playwright fixture layer.

Use it for:
- `electronApp` — launched with correct args, unique `userDataDir`, auto-torn-down
- `mainWindow` — the internal `BrowserWindow` (`mattermost-desktop://renderer/index.html`)
- `serverMap` — map of `serverName → [{win, webContentsId}]` for external server views
- `appConfig` — override with `test.use({ appConfig: myConfig })` before the suite

**Overriding config for a test suite:**

```typescript
import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';

test.use({appConfig: demoMattermostConfig});

test.describe('my suite', () => {
    test('loads the server', async ({mainWindow, serverMap}) => {
        const server = serverMap['example'][0].win;
        await server.waitForSelector('#sidebarItem_town-square');
    });
});
```

Do not bypass fixtures unless the spec genuinely needs custom launch control (e.g., testing app startup behavior itself, or needing a very short launch timeout to verify a second instance exits).

## Debugging Guidance

When a test fails, classify the failure first:

**App did not launch**
- Check `electronBinaryPath` points to a built binary (`e2e/dist/`).
- Run `npm run build` or `npm run e2e` from the project root first.

**App launched but readiness never completed**
- `waitForAppReady` polls `global.__e2eAppReady` in the main process.
- This flag is set in `src/main/app/initialize.ts` after `handleMainWindowIsShown()` when `NODE_ENV === 'test'`.
- If it never fires: check `initialize.ts` still sets `__e2eAppReady` and that `NODE_ENV=test` is passed to `electron.launch()`.

**Server view discovery failed (`buildServerMap` timed out)**
- `buildServerMap` reads `global.__e2eTestRefs` in the main process.
- If `__e2eTestRefs` is `undefined`: the app did not register test refs. Check `initialize.ts`.
- If views array is empty: `ViewManager.getViewsByServerId()` returned nothing — server may not have loaded yet. Add an `expect.poll` with a longer timeout.
- Timeout message includes all available `webContents` URLs — use that to diagnose what DID load.

**Selector is stale / element not found**
- Use `waitForSelector` or `expect(...).toContainText(..., {timeout})` instead of reading `innerText()` directly.
- For tab titles (which update asynchronously after channel navigation), always poll:
  ```typescript
  await expect(mainWindow.locator('.TabBar li:nth-child(1)')).toContainText('Off-Topic', {timeout: 15_000});
  ```

**Teardown left Electron hanging**
- The fixture uses `SIGTERM` (not `SIGKILL`) for hanging processes. `SIGKILL` causes macOS crash dialogs.
- Global teardown (`e2e/global-teardown.ts`) cleans up orphaned PIDs after the full suite.
- If you see hangs during development: `killall Electron 2>/dev/null || true`.

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
- Root cause: server view discovery assumed Playwright pages, but the app now uses embedded `WebContentsView`s. `app.windows()` returned only the main `BrowserWindow`, so all `serverMap` entries were missing.
- Fix: rewrote `buildServerMap` to read from `global.__e2eTestRefs.ViewManager` and `WebContentsManager` in the main process context, then wrapped the `webContentsId` in a `ServerView` helper to expose a `Page`-compatible interface.

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
