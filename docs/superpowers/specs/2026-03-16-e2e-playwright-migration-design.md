# E2E Test Suite Migration: electron-mocha → @playwright/test

**Date:** 2026-03-16
**Status:** Draft
**Scope:** Mattermost Desktop E2E test infrastructure

---

## Problem Statement

The existing E2E test suite (36 test files, `electron-mocha` runner) has three compounding problems:

1. **Pervasive timing-based flakiness** — `asyncSleep()` calls throughout `environment.js` and every test file are calibrated to developer machines. Under CI load they cause `ElementNotFound` errors that only reproduce in CI.
2. **Racy process cleanup** — `clearElectronInstances()` uses `ps-node` kill loops and fixed sleeps. On Windows, the `SingletonLock` file survives the kill, causing the next test's app launch to exit silently (singleton guard), making 10+ subsequent tests fail with no clear root cause.
3. **Missing critical coverage** — Notification click navigation, session persistence across restarts, tray restore, network recovery, and download file-on-disk verification are completely untested. These are the top sources of production bug reports.

The root cause of problems 1 and 2 is architectural: `electron-mocha` has no lifecycle management. The fix is `@playwright/test` fixtures, which provide deterministic setup and teardown.

---

## Goals

- Eliminate timing-based flakiness from the test suite
- Provide deterministic app startup and teardown per test
- Add P0/P1 missing coverage on a solid foundation
- Enable tag-based CI tiers (smoke / core / full / nightly)
- Maintain CI signal throughout migration (no "dark period" where tests don't run)

## Non-Goals

- Rewriting the Mattermost Web App selectors (managed separately)
- Performance testing migration (stays on `electron-mocha` / `webpack.config.performance.js`)
- E2E coverage for auto-update (requires mock update server infrastructure, separate project)

---

## Architecture

### Runner

Replace `electron-mocha` with `@playwright/test`. The `playwright` package is already a dependency (`"playwright": "1.58.0"`). The migration adds `@playwright/test` pinned to the **same version**:

```json
"@playwright/test": "1.58.0"
```

Both packages share the same `playwright-core` internals. If versions diverge, incompatible API signatures and mismatched binary paths cause silent failures. Version parity is a hard requirement.

`@playwright/test` discovers and transpiles TypeScript test files directly via its esbuild pipeline. The `e2e/webpack.config.js` and `npm run build` step for tests are retired as migration completes — no webpack needed for test files.

Tests run against the built app (existing `npm run build` step, unchanged). The Electron binary and the app's compiled JS bundle are the two paths the fixture must know:

```typescript
// e2e/helpers/config.ts (constants)
const sourceRootDir = path.join(__dirname, '../..');

export const electronBinaryPath = (() => {
    if (process.platform === 'darwin') {
        return path.join(sourceRootDir, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
    }
    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.join(sourceRootDir, `node_modules/electron/dist/electron${ext}`);
})();

export const appEntryPath = path.join(sourceRootDir, 'dist/index.js');  // package.json "main" field
```

These mirror the existing `electronBinaryPath` constant in `environment.js`.

### Parallelism

Electron is not a browser. Each worker spawns a full Electron instance (~300MB RAM + GPU subprocess). The following constraints apply:

- **Linux CI**: multiple workers race on the same xvfb display and steal keyboard focus
- **macOS CI**: multiple Electron instances conflict on dock badge and notification APIs
- **Windows CI**: RAM pressure causes OOM kills above 2 workers

```typescript
// playwright.config.ts
export default defineConfig({
    workers: process.env.CI ? 1 : 2,
    fullyParallel: false,  // within a file, tests run sequentially
});
```

### Platform Projects

Platform-specific tests are selected via tags, not file naming or separate configs:

```typescript
projects: [
    {name: 'darwin', testMatch: '**/*.test.ts', grep: /@all|@darwin/},
    {name: 'win32',  testMatch: '**/*.test.ts', grep: /@all|@win32/},
    {name: 'linux',  testMatch: '**/*.test.ts', grep: /@all|@linux/},
],
```

Only the project matching the current `process.platform` is activated per CI job.

---

## Core Fixtures

All fixtures live in `e2e/fixtures/index.ts` as a single `test.extend()` chain. Every test file imports `{test, expect}` from `../../fixtures/index.ts` only.

`ElectronApplication` is typed from `playwright`, not `@playwright/test` (which does not re-export it). The `_electron` launcher also comes from `playwright`:

```typescript
// e2e/fixtures/index.ts
import {test as base, Page} from '@playwright/test';
import type {ElectronApplication} from 'playwright';
import {_electron as electron} from 'playwright';
import * as path from 'path';
import * as fs from 'fs/promises';

import {electronBinaryPath, appEntryPath, demoConfig, writeConfigFile} from '../helpers/config';
import {waitForAppReady} from '../helpers/appReadiness';
import {waitForLockFileRelease} from '../helpers/cleanup';
import {buildServerMap, ServerMap} from '../helpers/serverMap';

type Fixtures = {
    electronApp: ElectronApplication;
    appReady: void;                        // side-effect fixture: waits for readiness
    serverMap: ServerMap;
    mainWindow: Page;
};

export const test = base.extend<Fixtures>({
    electronApp: async ({}, use, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        await fs.mkdir(userDataDir, {recursive: true});
        writeConfigFile(userDataDir, demoConfig);  // synchronous (fs.writeFileSync) — must complete before launch

        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [
                appEntryPath,
                `--user-data-dir=${userDataDir}`,
                '--no-sandbox',
                '--disable-gpu',
                '--disable-gpu-sandbox',
                '--disable-dev-shm-usage',
                '--no-zygote',
                '--disable-software-rasterizer',
                '--mute-audio',
            ],
            env: {...process.env, E2E_TEST: '1'},
        });

        await use(app);

        await app.close();
        if (process.platform === 'win32') {
            await waitForLockFileRelease(userDataDir);
        }
    },

    // Shared readiness gate — both serverMap and mainWindow depend on this,
    // so Playwright's fixture deduplication runs it exactly once per test.
    appReady: async ({electronApp}, use) => {
        await waitForAppReady(electronApp);
        await use();
    },

    serverMap: async ({electronApp, appReady: _}, use) => {
        const map = await buildServerMap(electronApp);
        await use(map);
    },

    mainWindow: async ({electronApp, appReady: _}, use) => {
        const win = electronApp.windows().find(w => w.url().includes('index'));
        if (!win) {
            throw new Error(
                `mainWindow fixture: no window with 'index' in URL.\n` +
                `Available windows: ${electronApp.windows().map(w => w.url()).join(', ')}`,
            );
        }
        await use(win);
    },
});

export {expect} from '@playwright/test';
```

### Why a single chain

`@playwright/test` resolves fixture dependencies by declared parameter names. `serverMap` declaring `appReady` as its dependency means the runner guarantees readiness before `serverMap` setup runs and tears down in reverse order. The `appReady` fixture is deduplicated — if both `serverMap` and `mainWindow` are requested, `waitForAppReady` runs once.

### Config overrides per test

Tests that need non-default server configuration (e.g. bad servers, single-server layout) call `writeConfigFile` themselves before or instead of the fixture default. The `electronApp` fixture writes `demoConfig` by default; tests override by using a scoped fixture or writing the config file before launch via a `beforeEach`. The exact pattern is left to the implementation plan.

---

## App Readiness Signal

The existing `getServerMap()` polling loop (up to 300 retries × 100ms = 30s on macOS) is the largest single contributor to slow test startup. It polls because there is no deterministic readiness signal.

**Required main process change** (`src/main/app/initialize.ts`):

The correct insertion point is in `initializeAfterAppReady()`, immediately after the existing `handleMainWindowIsShown()` call at line 481. This is the final step of app initialization — the main window is shown, all servers are loaded, and the app is ready for user interaction.

```typescript
// src/main/app/initialize.ts — in initializeAfterAppReady(), after handleMainWindowIsShown():
handleMainWindowIsShown();

// E2E readiness signal — only present when E2E_TEST=1, never in production
if (process.env.E2E_TEST === '1') {
    (global as any).__e2eAppReady = true;
}
```

No event listener or emitter is needed. The global is set synchronously at the exact point the app is ready. The `waitForAppReady` helper polls this global from the test process via `app.evaluate()`.

**`helpers/appReadiness.ts`**:

```typescript
import type {ElectronApplication} from 'playwright';
import {expect} from '@playwright/test';

// app.evaluate() runs in the main process — ElectronType is typeof import('electron').
// ipcRenderer does NOT exist in the main process; use a global set by main.
export async function waitForAppReady(app: ElectronApplication): Promise<void> {
    await expect.poll(
        () => app.evaluate(() => (global as any).__e2eAppReady === true),
        {timeout: 30_000, intervals: [500, 1000, 2000]},
    ).toBe(true);
}
```

`app.evaluate()` runs in the **main process** context. The `ElectronType` argument is `typeof import('electron')` — `ipcRenderer` does not exist there and must not be destructured from it. The global variable set by the main process is the correct mechanism.

**Guard:** The global and the `ViewManager` listener must only be registered when `process.env.E2E_TEST === '1'`. They must not be present in production builds.

---

## Post-Close Cleanup (`helpers/cleanup.ts`)

`app.close()` is necessary but not sufficient on Windows. The `SingletonLock` file survives for 1–3 seconds after the launcher process exits because renderer/GPU subprocesses hold it open.

```typescript
import * as fs from 'fs';
import * as path from 'path';
import {expect} from '@playwright/test';

export async function waitForLockFileRelease(userDataDir: string): Promise<void> {
    const lockFile = path.join(userDataDir, 'SingletonLock');
    await expect.poll(
        () => !fs.existsSync(lockFile),
        {timeout: 10_000, intervals: [200, 500, 1000]},
    ).toBe(true);
}
```

On macOS and Linux, `app.close()` is sufficient — no lock file polling needed.

---

## Test Tagging Strategy

Every test carries two tags: priority and platform scope, using the `@playwright/test` `TestDetails` API (available since Playwright 1.42, which `1.58.0` satisfies):

```typescript
// Structured tags — filterable with --grep, not embedded in title string
test(
    'notification click navigates to channel',
    {tag: ['@P0', '@all']},
    async ({electronApp}) => { ... }
);

test(
    'tray icon restores hidden window',
    {tag: ['@P1', '@darwin']},
    async ({electronApp}) => { ... }
);
```

The `TestDetails` form is **required** (not the `@tag` in title string form). Embedding tags in the title string risks `--grep @P0` matching unrelated descriptions. The structured form guarantees correct filtering.

**CI tiers:**

| Tier | Trigger | Command | Target runtime |
|---|---|---|---|
| Smoke | Every PR | `--grep "@P0"` | < 3 min |
| Core | Merge to main | `--grep "@P0\|@P1"` | < 15 min |
| Full | Nightly | (no grep, all tests) | < 45 min |

---

## robotjs Replacement Strategy

`robotjs` usage falls into three categories with different replacement strategies:

| Usage | Replace with | Notes |
|---|---|---|
| `robot.keyTap()` inside page | `page.keyboard.press()` | Full replacement |
| `robot.typeString()` | `page.keyboard.type()` | Full replacement |
| `robot.moveMouse()` title bar drag | `page.mouse.move()` + `dragTo()` | Content area only; OS title bar requires special handling |
| Tray icon click | `app.evaluate(() => tray.emit('click'))` | Call Electron tray object directly via main process eval |
| OS-level dialog dismiss | `page.keyboard.press('Escape')` if in-page | robotjs still required for true OS dialogs |

`robotjs` is not removed entirely — it is scoped to the cases where Playwright has no equivalent. All in-page keyboard/typing interactions migrate to Playwright APIs.

---

## Migration Plan (Phases)

### Phase 1 — Foundation (Days 1–3)

Deliverables:
- `@playwright/test@1.58.0` added to `e2e/package.json` devDependencies
- `playwright.config.ts` written (`workers:1` CI, platform projects, tag grep)
- `e2e/fixtures/index.ts` with `electronApp`, `appReady`, `serverMap`, `mainWindow` fixtures
- `helpers/appReadiness.ts`, `helpers/cleanup.ts`, `helpers/serverMap.ts`, `helpers/config.ts`
- `__e2eAppReady` global set synchronously after `handleMainWindowIsShown()` in `initializeAfterAppReady()` (guarded by `process.env.E2E_TEST === '1'`)
- `startup/` tests migrated to TypeScript as proof-of-concept (4 files)
- Both runners active: `electron-mocha` still runs all legacy tests

Success criteria: `startup/` tests pass reliably on all three platforms in `@playwright/test` with zero `asyncSleep` calls.

### Phase 2 — New P0/P1 Tests (Days 4–7)

New test files written directly on the new infrastructure:

| Test | Tag | File |
|---|---|---|
| Notification click → channel navigation | `@P0 @all` | `notification_trigger/notification_click.test.ts` |
| App relaunch preserves session | `@P0 @all` | `startup/session_persistence.test.ts` |
| Tray icon restores hidden window | `@P0 @all` | `system/tray_restore.test.ts` |
| Network disconnect + auto-reconnect | `@P0 @all` | `network_resilience/reconnect.test.ts` |
| Download completes, file on disk | `@P1 @all` | `downloads/download_completion.test.ts` |
| Deep link with app already running | `@P1 @darwin @win32` | `deep_linking/deeplink_running.test.ts` |
| Multi-server switch preserves view state | `@P1 @all` | `server_management/view_state.test.ts` |
| Config write is atomic | `@P1 @all` | `startup/config_integrity.test.ts` |

Success criteria: All 8 new tests pass on CI, tagged correctly, run in < 8 min total as part of `@P0|@P1` tier.

### Phase 3 — Complete Migration (Days 8–10)

Remaining `electron-mocha` test categories migrated to `@playwright/test`:
- `server_management/` (10 files)
- `menu_bar/` (8 files)
- `downloads/` (3 files)
- `notification_trigger/` (2 files)
- `permissions/`, `deep_linking/`, `mattermost/`, `settings/keyboard_shortcuts.test.js`
- Root-level: `settings.test.js`, `focus.test.js`, `popup.test.js`, `linux_dark_mode.test.js`, `relative_url.test.js`

`electron-mocha`, `e2e/webpack.config.js`, and `e2e/modules/environment.js` retired.

`robotjs` dependency scoped to remaining OS-level operations only.

Success criteria: All 36 legacy tests + 8 new tests pass on `@playwright/test`. `electron-mocha` removed from `e2e/package.json`. CI runtime for full suite < 45 min.

---

## Directory Structure (Final State)

```
e2e/
├── playwright.config.ts
├── fixtures/
│   └── index.ts                        # single test.extend() chain, all fixtures
├── helpers/
│   ├── appReadiness.ts                 # waitForAppReady() via __e2eAppReady global
│   ├── cleanup.ts                      # waitForLockFileRelease() (Windows only)
│   ├── serverMap.ts                    # buildServerMap()
│   ├── login.ts                        # loginToMattermost()
│   └── config.ts                       # electronBinaryPath, appEntryPath, demoConfig, writeConfigFile (uses fs.writeFileSync — must be synchronous)
├── specs/
│   ├── startup/
│   ├── server_management/
│   ├── menu_bar/
│   ├── notification_trigger/
│   ├── downloads/
│   ├── deep_linking/
│   ├── permissions/
│   ├── system/                         # tray, dock, badge (new)
│   ├── network_resilience/             # new
│   ├── mattermost/
│   ├── settings/
│   ├── focus.test.ts
│   ├── linux_dark_mode.test.ts
│   ├── popup.test.ts
│   ├── settings.test.ts
│   └── relative_url.test.ts
└── legacy/                             # electron-mocha tests, deleted in Phase 3
    └── (existing .js files)
```

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `__e2eAppReady` global breaks production build | Low | `process.env.E2E_TEST === '1'` guard; verified in CI production build job |
| Phase 1 migration takes longer than 3 days | Medium | `startup/` migration is the proof-of-concept; if it slips, adjust Phase 2 start |
| macOS CI dock badge/notification API conflicts with multiple simultaneous Electron instances | Low | `workers: 1` in CI prevents this |
| `waitForLockFileRelease` insufficient on Windows | Medium | Fallback to `taskkill /F /IM electron.exe` if lock not released in 10s |
| Webapp selector breakage during migration | Medium | Catalogue all webapp-sourced selectors in `helpers/webappSelectors.ts` with version annotation |
| `@playwright/test` version drift from `playwright` | Low | Pin both to `1.58.0` in `package.json`; enforced by `npm ci` in CI |

---

## Success Metrics

- Zero `asyncSleep` calls in migrated tests
- Zero `clearElectronInstances` calls in migrated tests
- CI flake rate (retry-required runs) drops from current baseline to < 2%
- Smoke tier (`@P0`) completes in < 3 minutes
- 8 new P0/P1 tests added, all passing on macOS + Windows + Linux CI
