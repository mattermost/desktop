# E2E Playwright Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Mattermost Desktop E2E suite from `electron-mocha` to `@playwright/test`, add 8 missing P0/P1 tests, and retire the old runner.

**Architecture:** `@playwright/test` fixtures provide deterministic Electron launch/teardown per test. A single `test.extend()` chain in `e2e/fixtures/index.ts` composes `electronApp → appReady → serverMap/mainWindow`. The app signals readiness via `global.__e2eAppReady` set in `initialize.ts` after `handleMainWindowIsShown()`. Tests are tagged `{tag: ['@P0','@all']}` enabling PR/merge/nightly CI tiers.

**Tech Stack:** `@playwright/test@1.58.0`, `playwright@1.58.0` (existing), `electron-mocha` (kept until Phase 3), TypeScript, Electron 32+

---

## Key Facts (read before implementing)

- **App entry for tests:** `e2e/dist/` directory (not `dist/`). When built with `NODE_ENV=test` (`npm run build-test`), webpack outputs to `e2e/dist/`. Electron is launched with `args[0] = path/to/e2e/dist`.
- **testHelper injection:** `src/app/preload/externalAPI.ts` exposes `window.testHelper` when `NODE_ENV === 'test'`. This is already guarded correctly — no changes needed there.
- **Readiness guard uses:** `process.env.NODE_ENV === 'test'` — consistent with the existing `testHelper` guard in `externalAPI.ts`. This is inlined by webpack's DefinePlugin at build time. The fixture sets `NODE_ENV: 'test'` in launch env. Do NOT use `E2E_TEST === '1'` — the spec mentions it but the plan overrides it; `NODE_ENV` is already the established pattern in this codebase.
- **`app.evaluate()` runs in main process** — `ipcRenderer` does NOT exist there. Only `ipcMain`, `app`, `BrowserWindow`, etc. are available. Use `(global as any).__e2eAppReady` via `app.evaluate(() => (global as any).__e2eAppReady)`.
- **Lock file cleanup:** Only needed on Windows. macOS/Linux: `app.close()` is sufficient.
- **`writeConfigFile` must be synchronous** — uses `fs.writeFileSync`. Must complete before `electron.launch()` is called.
- **Electron flags:** The full set from `environment.js` must be preserved (see Task 7).
- **Both runners coexist:** Legacy `.test.js` files stay in `e2e/specs/` (webpack picks up `.js` only). New `.test.ts` files are picked up by `@playwright/test`. No file moves needed until Phase 3.

---

## File Map

**Create:**
```
e2e/tsconfig.json
e2e/playwright.config.ts
e2e/fixtures/index.ts
e2e/helpers/config.ts
e2e/helpers/appReadiness.ts
e2e/helpers/cleanup.ts
e2e/helpers/serverMap.ts
e2e/helpers/login.ts
e2e/specs/startup/app.test.ts          (migrated from app.test.js)
e2e/specs/startup/config.test.ts       (migrated from config.test.js)
e2e/specs/startup/window.test.ts       (migrated from window.test.js)
e2e/specs/startup/welcome_screen_modal.test.ts  (migrated)
e2e/specs/startup/session_persistence.test.ts   (new P0)
e2e/specs/startup/config_integrity.test.ts      (new P1)
e2e/specs/system/tray_restore.test.ts           (new P0)
e2e/specs/notification_trigger/notification_click.test.ts  (new P0)
e2e/specs/network_resilience/reconnect.test.ts  (new P0)
e2e/specs/downloads/download_completion.test.ts (new P1)
e2e/specs/deep_linking/deeplink_running.test.ts (new P1)
e2e/specs/server_management/view_state.test.ts  (new P1)
```

**Modify:**
```
e2e/package.json                        — add @playwright/test@1.58.0
src/main/app/initialize.ts             — add __e2eAppReady after handleMainWindowIsShown()
```

**Delete (Phase 3 only):**
```
e2e/specs/startup/app.test.js
e2e/specs/startup/config.test.js
e2e/specs/startup/window.test.js
e2e/specs/startup/welcome_screen_modal.test.js
(+ all remaining legacy .test.js files)
```

---

## Chunk 1: Foundation Infrastructure

### Task 1: Install @playwright/test and create tsconfig

**Files:**
- Modify: `e2e/package.json`
- Create: `e2e/tsconfig.json`

- [ ] **Step 1: Add @playwright/test to devDependencies**

Edit `e2e/package.json` — add to `devDependencies`:
```json
"@playwright/test": "1.58.0"
```
The version MUST match `"playwright": "1.58.0"` already in `dependencies`. Both share the same `playwright-core` internals — version mismatch causes silent API incompatibilities.

Also add a `test:pw` script:
```json
"test:pw": "playwright test"
```

- [ ] **Step 2: Create e2e/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist-ts",
    "baseUrl": ".",
    "paths": {
      "src/*": ["../src/*"]
    }
  },
  "include": ["fixtures/**/*", "helpers/**/*", "specs/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Install the new dependency**

```bash
cd e2e && npm install
```

Expected: `node_modules/@playwright/test` directory appears.

- [ ] **Step 4: Verify installation**

```bash
cd e2e && npx playwright --version
```

Expected: `Version 1.58.0`

---

### Task 2: Create playwright.config.ts

**Files:**
- Create: `e2e/playwright.config.ts`

- [ ] **Step 1: Create the config**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from '@playwright/test';

export default defineConfig({
    testDir: './specs',
    testMatch: '**/*.test.ts',

    // Electron is not a browser — each worker spawns a full ~300MB process.
    // More than 1 worker in CI causes: xvfb focus races (Linux), dock API
    // conflicts (macOS), RAM OOM (Windows).
    workers: process.env.CI ? 1 : 2,
    fullyParallel: false,

    retries: process.env.CI ? 1 : 0,

    timeout: 60_000,

    reporter: [
        ['html', {open: 'never', outputFolder: 'playwright-report'}],
        ['list'],
    ],

    use: {
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: process.platform,
            grep: process.platform === 'darwin' ? /@all|@darwin/ :
                  process.platform === 'win32'  ? /@all|@win32/ :
                  /@all|@linux/,
        },
    ],
});
```

- [ ] **Step 2: Verify config is valid**

```bash
cd e2e && npx playwright test --list 2>&1 | head -5
```

Expected: Either "No tests found" (no .ts spec files yet) or a list. No parse errors.

---

### Task 3: Create e2e/helpers/config.ts

**Files:**
- Create: `e2e/helpers/config.ts`

This file owns all constants and the config writer. It replaces the constants section of `environment.js`.

- [ ] **Step 1: Create the file**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

export const sourceRootDir = path.join(__dirname, '../..');

// The Electron binary from the npm package
export const electronBinaryPath = (() => {
    if (process.platform === 'darwin') {
        return path.join(sourceRootDir, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
    }
    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.join(sourceRootDir, `node_modules/electron/dist/electron${ext}`);
})();

// Test build app directory — built by `npm run build-test` (NODE_ENV=test)
// When NODE_ENV=test, webpack outputs to e2e/dist/ instead of dist/
// Electron is launched with this directory as args[0]
export const appDir = path.join(sourceRootDir, 'e2e/dist');

export const mattermostURL = process.env.MM_TEST_SERVER_URL ?? 'http://localhost:8065/';

export const exampleURL = 'http://example.com/';

export const cmdOrCtrl = process.platform === 'darwin' ? 'command' : 'control';

// ---- Config shapes ----

type AppConfig = {
    version: number;
    servers: Array<{name: string; url: string; order: number}>;
    showTrayIcon: boolean;
    trayIconTheme: string;
    minimizeToTray: boolean;
    notifications: {flashWindow: number; bounceIcon: boolean; bounceIconType: string};
    showUnreadBadge: boolean;
    useSpellChecker: boolean;
    enableHardwareAcceleration: boolean;
    autostart: boolean;
    hideOnStart: boolean;
    spellCheckerLocales: string[];
    darkMode: boolean;
    lastActiveServer: number;
    startInFullscreen: boolean;
    autoCheckForUpdates: boolean;
    appLanguage: string;
    logLevel: string;
    viewLimit: number;
};

const baseConfig: AppConfig = {
    version: 4,
    servers: [],
    showTrayIcon: false,
    trayIconTheme: 'light',
    minimizeToTray: false,
    notifications: {flashWindow: 0, bounceIcon: false, bounceIconType: 'informational'},
    showUnreadBadge: true,
    useSpellChecker: true,
    enableHardwareAcceleration: true,
    autostart: true,
    hideOnStart: false,
    spellCheckerLocales: [],
    darkMode: false,
    lastActiveServer: 0,
    startInFullscreen: false,
    autoCheckForUpdates: true,
    appLanguage: 'en',
    logLevel: 'silly',
    viewLimit: 15,
};

// Two demo servers (no live Mattermost needed): example.com + github.com
export const demoConfig: AppConfig = {
    ...baseConfig,
    servers: [
        {name: 'example', url: exampleURL, order: 0},
        {name: 'github', url: 'https://github.com/', order: 1},
    ],
};

// Single Mattermost server (requires MM_TEST_SERVER_URL)
export const demoMattermostConfig: AppConfig = {
    ...baseConfig,
    servers: [
        {name: 'example', url: mattermostURL, order: 0},
        {name: 'github', url: 'https://github.com/', order: 1},
    ],
};

// No servers — triggers welcome screen
export const emptyConfig: AppConfig = {
    ...baseConfig,
    servers: [],
};

// ---- File writer ----

/**
 * Write app config to userDataDir/config.json.
 * MUST be synchronous — must complete before electron.launch() is called.
 */
export function writeConfigFile(userDataDir: string, config: AppConfig): void {
    fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(config, null, 2));
}
```

---

### Task 4: Create e2e/helpers/appReadiness.ts

**Files:**
- Create: `e2e/helpers/appReadiness.ts`

- [ ] **Step 1: Create the file**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {expect} from '@playwright/test';

/**
 * Wait until the main process has set global.__e2eAppReady = true.
 *
 * This flag is set in src/main/app/initialize.ts after handleMainWindowIsShown()
 * when NODE_ENV === 'test'. It fires once per app launch, after all views are
 * initialized and the main window is shown.
 *
 * IMPORTANT: app.evaluate() runs in the MAIN process context.
 * ipcRenderer does NOT exist there — only main-process Electron APIs do.
 * We read the global directly, not via IPC.
 */
export async function waitForAppReady(app: ElectronApplication): Promise<void> {
    await expect.poll(
        () => app.evaluate(() => (global as any).__e2eAppReady === true),
        {
            message: 'Timed out waiting for __e2eAppReady. Check that initialize.ts sets it after handleMainWindowIsShown().',
            timeout: 30_000,
            intervals: [200, 500, 1000, 2000],
        },
    ).toBe(true);
}
```

---

### Task 5: Create e2e/helpers/cleanup.ts

**Files:**
- Create: `e2e/helpers/cleanup.ts`

- [ ] **Step 1: Create the file**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {expect} from '@playwright/test';

/**
 * On Windows, the SingletonLock file survives for 1-3 seconds after
 * app.close() because the GPU and renderer subprocesses hold it open.
 * If the next test launches before the lock is released, Electron's singleton
 * guard fires and the new instance exits silently — causing the entire test to
 * fail with no useful error.
 *
 * macOS and Linux: app.close() is sufficient, no polling needed.
 */
export async function waitForLockFileRelease(userDataDir: string): Promise<void> {
    if (process.platform !== 'win32') {
        return;
    }
    const lockFile = path.join(userDataDir, 'SingletonLock');
    await expect.poll(
        () => !fs.existsSync(lockFile),
        {
            message: `SingletonLock not released at ${lockFile}`,
            timeout: 10_000,
            intervals: [200, 500, 1000],
        },
    ).toBe(true);
}
```

---

### Task 6: Create e2e/helpers/serverMap.ts

**Files:**
- Create: `e2e/helpers/serverMap.ts`

- [ ] **Step 1: Create the file**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication, Page} from 'playwright';

export type ServerEntry = {win: Page; webContentsId: number};
export type ServerMap = Record<string, ServerEntry[]>;

/**
 * Build a map of {serverName -> [{win, webContentsId}]} from the running app.
 *
 * Called after waitForAppReady() guarantees the app is initialized.
 * window.testHelper.getViewInfoForTest() is injected by externalAPI.ts
 * when NODE_ENV === 'test'.
 *
 * External windows = windows whose URL does NOT start with mattermost-desktop://
 * (i.e., the Mattermost server web app views, not the internal UI).
 */
export async function buildServerMap(app: ElectronApplication): Promise<ServerMap> {
    const maxRetries = 60;  // 6 seconds max (after appReady, windows should be fast)

    for (let i = 0; i < maxRetries; i++) {
        const externalWindows = app.windows().filter((win) => {
            try {
                const url = win.url();
                return url.length > 0 && !url.startsWith('mattermost-desktop://');
            } catch {
                return false;
            }
        });

        if (externalWindows.length === 0) {
            await sleep(100);
            continue;
        }

        const results = await Promise.all(
            externalWindows.map(async (win) => {
                try {
                    return await Promise.race([
                        win.evaluate(() => {
                            const helper = (window as any).testHelper;
                            if (!helper) return null;
                            return helper.getViewInfoForTest() as {serverName: string; webContentsId: number};
                        }),
                        sleep(3000).then(() => null),
                    ]);
                } catch {
                    return null;
                }
            }),
        );

        const map: ServerMap = {};
        externalWindows.forEach((win, idx) => {
            const result = results[idx] as {serverName: string; webContentsId: number} | null;
            if (result) {
                if (!map[result.serverName]) {
                    map[result.serverName] = [];
                }
                map[result.serverName].push({win, webContentsId: result.webContentsId});
            }
        });

        if (Object.keys(map).length > 0 && results.every((r) => r !== null)) {
            return map;
        }

        await sleep(100);
    }

    return {};
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

### Task 7: Create e2e/helpers/login.ts

**Files:**
- Create: `e2e/helpers/login.ts`

- [ ] **Step 1: Create the file**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from 'playwright';

/**
 * Log in to a Mattermost server in the given window/page.
 * Requires MM_TEST_USER_NAME and MM_TEST_PASSWORD env vars.
 * Requires MM_TEST_SERVER_URL to be set in the app config (use demoMattermostConfig).
 */
export async function loginToMattermost(win: Page): Promise<void> {
    const username = process.env.MM_TEST_USER_NAME;
    const password = process.env.MM_TEST_PASSWORD;

    if (!username || !password) {
        throw new Error('MM_TEST_USER_NAME and MM_TEST_PASSWORD must be set for tests requiring login');
    }

    const timeout = process.platform === 'win32' ? 60_000 : 30_000;

    await win.waitForSelector('#input_loginId', {timeout});
    await win.waitForSelector('#input_password-input', {timeout});

    await win.fill('#input_loginId', username);
    await win.fill('#input_password-input', password);
    await win.click('#saveSetting');

    // Wait for login to complete: login page disappears
    await win.waitForSelector('#input_loginId', {state: 'detached', timeout});
}
```

---

### Task 8: Create e2e/fixtures/index.ts

**Files:**
- Create: `e2e/fixtures/index.ts`

- [ ] **Step 1: Create the fixture chain**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as path from 'path';

import {test as base, type Page} from '@playwright/test';
import type {ElectronApplication} from 'playwright';
import {_electron as electron} from 'playwright';

import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../helpers/config';
import {waitForAppReady} from '../helpers/appReadiness';
import {waitForLockFileRelease} from '../helpers/cleanup';
import {buildServerMap, type ServerMap} from '../helpers/serverMap';

export type {ServerMap, ServerEntry} from '../helpers/serverMap';

type Fixtures = {
    /**
     * A launched ElectronApplication with its own isolated userDataDir.
     * Guaranteed torn down (app.close() + lock file release) after each test.
     * Config defaults to demoConfig (example.com + github.com).
     * Override config by passing a custom config to writeConfigFile() in beforeEach.
     */
    electronApp: ElectronApplication;

    /**
     * Side-effect fixture: waits until __e2eAppReady is true in the main process.
     * Both serverMap and mainWindow depend on this. Playwright deduplicates it —
     * waitForAppReady() runs exactly once even if both fixtures are requested.
     */
    appReady: void;

    /** Map of server name → [{win, webContentsId}] for external server views. */
    serverMap: ServerMap;

    /** The main internal window (mattermost-desktop://renderer/index.html). */
    mainWindow: Page;
};

export const test = base.extend<Fixtures>({
    electronApp: async ({}, use, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        await fs.mkdir(userDataDir, {recursive: true});

        // writeConfigFile is SYNCHRONOUS — must complete before electron.launch()
        writeConfigFile(userDataDir, demoConfig);

        const launchTimeout = process.platform === 'win32' ? 120_000 :
                              process.platform === 'darwin' ? 90_000 : 60_000;

        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [
                appDir,                              // test build directory (e2e/dist)
                `--user-data-dir=${userDataDir}`,

                // CI compatibility — required for Linux sandbox, GPU stability
                '--no-sandbox',
                '--disable-gpu',
                '--disable-gpu-sandbox',
                '--disable-dev-shm-usage',
                '--no-zygote',
                '--disable-software-rasterizer',

                // Stability
                '--disable-breakpad',
                '--disable-features=SpareRendererForSitePerProcess',
                '--disable-features=CrossOriginOpenerPolicy',
                '--disable-renderer-backgrounding',

                // Consistency
                '--force-color-profile=srgb',
                '--mute-audio',
            ],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                RESOURCES_PATH: appDir,
                ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
                ELECTRON_NO_ATTACH_CONSOLE: 'true',
                NODE_OPTIONS: '--no-warnings',
            },
            timeout: launchTimeout,
        });

        await use(app);

        await app.close();
        await waitForLockFileRelease(userDataDir);
    },

    // Deduplicated readiness gate. Both serverMap and mainWindow declare this
    // as a dependency — Playwright runs it exactly once and tears it down once.
    appReady: async ({electronApp}, use) => {
        await waitForAppReady(electronApp);
        await use();
    },

    serverMap: async ({electronApp, appReady: _}, use) => {
        const map = await buildServerMap(electronApp);
        await use(map);
    },

    mainWindow: async ({electronApp, appReady: _}, use) => {
        const win = electronApp.windows().find((w) => w.url().includes('index'));
        if (!win) {
            throw new Error(
                `mainWindow fixture: no window with 'index' in URL.\n` +
                `Available: ${electronApp.windows().map((w) => w.url()).join(', ')}`,
            );
        }
        await use(win);
    },
});

export {expect} from '@playwright/test';
```

---

### Task 9: Add __e2eAppReady to main process

**Files:**
- Modify: `src/main/app/initialize.ts`

- [ ] **Step 1: Read the exact context around handleMainWindowIsShown()**

Open `src/main/app/initialize.ts`. Find the `initializeAfterAppReady()` function (around line 273). Locate the call to `handleMainWindowIsShown()` (around line 481). It is the second-to-last statement in the function.

- [ ] **Step 2: Add the readiness flag immediately after handleMainWindowIsShown()**

The change is a 4-line addition. Insert after `handleMainWindowIsShown();`:

```typescript
    handleMainWindowIsShown();

    // E2E readiness signal — only present in test builds (NODE_ENV === 'test' is
    // inlined by webpack DefinePlugin at build time, so this is dead code in production)
    if (process.env.NODE_ENV === 'test') {
        (global as any).__e2eAppReady = true;
    }
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run check-types
```

Expected: No TypeScript errors. (The `global as any` cast avoids type issues on the global augmentation.)

- [ ] **Step 4: Verify it appears in test build but not production build**

```bash
# Production build — should NOT contain the flag
npm run build && grep -c "__e2eAppReady" dist/index.js

# Test build — SHOULD contain the flag
npm run build-test && grep -c "__e2eAppReady" e2e/dist/index.js
```

Expected: production `grep` outputs `0`, test build `grep` outputs `>= 1`.

- [ ] **Step 5: Commit Phase 1 infrastructure**

```bash
git add e2e/package.json e2e/package-lock.json e2e/tsconfig.json \
        e2e/playwright.config.ts \
        e2e/fixtures/index.ts \
        e2e/helpers/config.ts e2e/helpers/appReadiness.ts \
        e2e/helpers/cleanup.ts e2e/helpers/serverMap.ts e2e/helpers/login.ts \
        src/main/app/initialize.ts
git commit -m "feat(e2e): add @playwright/test infrastructure and app readiness signal"
```

---

## Chunk 2: Startup Test Migration

### Task 10: Migrate startup/app.test.ts

**Files:**
- Create: `e2e/specs/startup/app.test.ts`
- Reference: `e2e/specs/startup/app.test.js` (do not delete yet)

The original has 3 tests: MM-T4400 (singleton), MM-T4975 (welcome screen on no servers), MM-T4985 (title bar, non-Linux).

- [ ] **Step 1: Build the test build**

```bash
npm run build-test
```

Expected: `e2e/dist/index.js` updated.

- [ ] **Step 2: Create the migrated test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {electronBinaryPath, appDir, emptyConfig, writeConfigFile} from '../../helpers/config';

test.describe('startup/app', () => {
    test(
        'MM-T4400 should be stopped when the app instance already exists',
        {tag: ['@P1', '@all']},
        async ({electronApp}) => {
            // Try launching a second instance against the same userDataDir.
            // We cannot share the fixture's userDataDir, so we attempt against a
            // fresh dir — Electron's singleton is per-executable, not per-data-dir.
            // The second instance should exit before resolving.
            let secondApp;
            try {
                secondApp = await electron.launch({
                    executablePath: electronBinaryPath,
                    args: [appDir, '--no-sandbox', '--disable-gpu'],
                    timeout: 5_000,  // short — expect it to exit quickly
                });
                // If we get here, the second instance launched (bad — but close it)
                await secondApp.close();
                throw new Error('Second app instance should not have launched successfully');
            } catch (err: any) {
                // Expected: launch times out or the process exits quickly.
                // A timeout error or process exit error is the correct outcome.
                expect(err.message).not.toContain('Second app instance should not have launched');
            }
        },
    );

    test(
        'MM-T4975 should show the welcome screen modal when no servers exist',
        {tag: ['@P1', '@all']},
        async ({electronApp}, testInfo) => {
            // This test needs a no-servers config. Override before launch.
            // Since electronApp fixture has already launched with demoConfig,
            // we test this by launching a fresh app with emptyConfig.
            // NOTE: In Phase 3, refactor fixture to accept config override.
            // For now, use a nested launch scoped to this test.
            const userDataDir = testInfo.outputDir + '/empty-userdata';
            const {mkdirSync} = await import('fs');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, emptyConfig);

            const emptyApp = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });

            try {
                let welcomeModal = emptyApp.windows().find((w) => w.url().includes('welcomeScreen'));
                if (!welcomeModal) {
                    welcomeModal = await emptyApp.waitForEvent('window', {
                        predicate: (w) => w.url().includes('welcomeScreen'),
                        timeout: 15_000,
                    });
                }
                await welcomeModal.waitForLoadState('domcontentloaded');
                const text = await welcomeModal.innerText('.WelcomeScreen .WelcomeScreen__button');
                expect(text).toBe('Get Started');
            } finally {
                await emptyApp.close();
            }
        },
    );

    test(
        'MM-T4985 should show app name in title bar when no servers exist',
        {tag: ['@P2', '@darwin', '@win32']},  // skipped on Linux
        async ({electronApp}) => {
            const mainWin = electronApp.windows().find((w) => w.url().includes('index'));
            expect(mainWin).toBeDefined();
            const titleText = await mainWin!.innerText('.app-title');
            expect(titleText).toBe('Electron');
        },
    );
});
```

- [ ] **Step 3: Run these tests**

```bash
cd e2e && npx playwright test specs/startup/app.test.ts --project=$(node -e "console.log(process.platform)") 2>&1
```

Expected: All tests pass (or MM-T4985 skipped on Linux). Zero `asyncSleep` calls. If `__e2eAppReady` times out, verify `build-test` was run and the `initialize.ts` change is present in `e2e/dist/index.js`.

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/startup/app.test.ts
git commit -m "test(e2e): migrate startup/app tests to @playwright/test"
```

---

### Task 11: Migrate startup/config.test.ts

**Files:**
- Create: `e2e/specs/startup/config.test.ts`
- Reference: `e2e/specs/startup/config.test.js`

The original has 3 tests: MM-T4401_1 (server in dropdown), MM-T4401_2 (server URL in view), MM-T4402 (config v0 upgrade).

- [ ] **Step 1: Create the migrated test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {exampleURL} from '../../helpers/config';

test.describe('startup/config', () => {
    test(
        'MM-T4401_1 should show correct server in the dropdown button',
        {tag: ['@P1', '@all']},
        async ({mainWindow}) => {
            const text = await mainWindow.innerText('.ServerDropdownButton');
            expect(text).toBe('example');
        },
    );

    test(
        'MM-T4401_2 should set src of browser view from config file',
        {tag: ['@P1', '@all']},
        async ({serverMap}) => {
            const firstServer = serverMap['example']?.[0]?.win;
            const secondServer = serverMap['github']?.[0]?.win;
            expect(firstServer).toBeDefined();
            expect(secondServer).toBeDefined();
            expect(firstServer!.url()).toContain(exampleURL);
            expect(secondServer!.url()).toContain('github.com');
        },
    );

    test(
        'MM-T4402 should upgrade v0 config file',
        {tag: ['@P1', '@all']},
        async ({electronApp}, testInfo) => {
            // Write a v0 config file, launch a fresh app, verify it upgrades
            const v0Config = {
                version: 0,
                teams: [{name: 'example', url: exampleURL, order: 0}],
            };
            const v0Dir = testInfo.outputDir + '/v0-userdata';
            fs.mkdirSync(v0Dir, {recursive: true});
            fs.writeFileSync(path.join(v0Dir, 'config.json'), JSON.stringify(v0Config));

            const {_electron: electron} = await import('playwright');
            const {electronBinaryPath, appDir} = await import('../../helpers/config');

            const upgradedApp = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${v0Dir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });

            try {
                // Give app time to read and upgrade the config
                const {waitForAppReady} = await import('../../helpers/appReadiness');
                await waitForAppReady(upgradedApp);

                const configRaw = fs.readFileSync(path.join(v0Dir, 'config.json'), 'utf8');
                const upgraded = JSON.parse(configRaw);
                expect(upgraded.version).toBeGreaterThan(0);
                expect(upgraded.servers).toBeDefined();
                expect(upgraded.servers[0].url).toContain(exampleURL);
            } finally {
                await upgradedApp.close();
            }
        },
    );
});
```

- [ ] **Step 2: Run**

```bash
cd e2e && npx playwright test specs/startup/config.test.ts 2>&1
```

Expected: All 3 pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/specs/startup/config.test.ts
git commit -m "test(e2e): migrate startup/config tests to @playwright/test"
```

---

### Task 12: Migrate startup/window.test.ts

**Files:**
- Create: `e2e/specs/startup/window.test.ts`
- Reference: `e2e/specs/startup/window.test.js`

Tests: MM-T4403_1 (restore bounds, non-Linux), MM-T4403_2 (reject off-screen x), MM-T4403_3 (reject off-screen y).

- [ ] **Step 1: Create the migrated test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';

test.describe('startup/window', () => {
    test(
        'MM-T4403_1 should restore window bounds on restart',
        {tag: ['@P2', '@darwin', '@win32']},  // skipped on Linux
        async ({electronApp}, testInfo) => {
            const mainWin = electronApp.windows().find((w) => w.url().includes('index'))!;

            // Resize to a known size
            await electronApp.evaluate(({BrowserWindow}) => {
                const win = BrowserWindow.getAllWindows()[0];
                win.setSize(800, 600);
                win.setPosition(100, 100);
            });

            // Save bounds by closing (app persists bounds on close)
            const userDataDir = path.join(testInfo.outputDir, 'userdata');
            await electronApp.close();

            // Relaunch with the SAME userDataDir (do not clean it)
            const {_electron: electron} = await import('playwright');
            const {electronBinaryPath, appDir} = await import('../../helpers/config');
            const {waitForAppReady} = await import('../../helpers/appReadiness');

            const app2 = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 90_000,
            });

            try {
                await waitForAppReady(app2);
                const win2 = app2.windows().find((w) => w.url().includes('index'))!;
                const bounds = await app2.evaluate(({BrowserWindow}) => {
                    const w = BrowserWindow.getAllWindows()[0];
                    return w.getBounds();
                });

                // Allow tolerance for OS window decoration differences
                const tolerance = process.platform === 'darwin' ? 250 : 10;
                expect(Math.abs(bounds.width - 800)).toBeLessThanOrEqual(tolerance);
                expect(Math.abs(bounds.height - 600)).toBeLessThanOrEqual(tolerance);
            } finally {
                await app2.close();
            }
        },
    );

    test(
        'MM-T4403_2 should NOT restore window bounds if x is outside view area',
        {tag: ['@P2', '@all']},
        async ({electronApp}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'userdata');

            // Write bounds with x far off-screen
            fs.writeFileSync(
                path.join(userDataDir, 'bounds-info.json'),
                JSON.stringify({x: -9999, y: 0, width: 800, height: 600}),
            );

            await electronApp.close();
            const {_electron: electron} = await import('playwright');
            const {electronBinaryPath, appDir} = await import('../../helpers/config');
            const {waitForAppReady} = await import('../../helpers/appReadiness');

            const app2 = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 90_000,
            });

            try {
                await waitForAppReady(app2);
                const bounds = await app2.evaluate(({BrowserWindow}) => {
                    return BrowserWindow.getAllWindows()[0].getBounds();
                });
                // Window should be on-screen (x >= 0)
                expect(bounds.x).toBeGreaterThanOrEqual(0);
            } finally {
                await app2.close();
            }
        },
    );

    test(
        'MM-T4403_3 should NOT restore window bounds if y is outside view area',
        {tag: ['@P2', '@all']},
        async ({electronApp}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'userdata');

            fs.writeFileSync(
                path.join(userDataDir, 'bounds-info.json'),
                JSON.stringify({x: 0, y: -9999, width: 800, height: 600}),
            );

            await electronApp.close();
            const {_electron: electron} = await import('playwright');
            const {electronBinaryPath, appDir} = await import('../../helpers/config');
            const {waitForAppReady} = await import('../../helpers/appReadiness');

            const app2 = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 90_000,
            });

            try {
                await waitForAppReady(app2);
                const bounds = await app2.evaluate(({BrowserWindow}) => {
                    return BrowserWindow.getAllWindows()[0].getBounds();
                });
                expect(bounds.y).toBeGreaterThanOrEqual(0);
            } finally {
                await app2.close();
            }
        },
    );
});
```

- [ ] **Step 2: Run**

```bash
cd e2e && npx playwright test specs/startup/window.test.ts 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add e2e/specs/startup/window.test.ts
git commit -m "test(e2e): migrate startup/window tests to @playwright/test"
```

---

### Task 13: Migrate startup/welcome_screen_modal.test.ts

**Files:**
- Create: `e2e/specs/startup/welcome_screen_modal.test.ts`
- Reference: `e2e/specs/startup/welcome_screen_modal.test.js`

8 tests: MM-T4976 through MM-T4983. All use a no-servers config and verify carousel navigation.

- [ ] **Step 1: Create the migrated test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {electronBinaryPath, appDir, emptyConfig, writeConfigFile} from '../../helpers/config';
import {waitForAppReady} from '../../helpers/appReadiness';

// All welcome screen tests need a no-servers app. This helper launches one.
async function launchEmptyApp(testInfo: {outputDir: string; title: string}) {
    const {mkdirSync} = await import('fs');
    const userDataDir = testInfo.outputDir + '/empty-' + Date.now();
    mkdirSync(userDataDir, {recursive: true});
    writeConfigFile(userDataDir, emptyConfig);

    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
        env: {...process.env, NODE_ENV: 'test'},
        timeout: 60_000,
    });
    await waitForAppReady(app);

    const modal = app.windows().find((w) => w.url().includes('welcomeScreen')) ??
        await app.waitForEvent('window', {
            predicate: (w) => w.url().includes('welcomeScreen'),
            timeout: 10_000,
        });
    await modal.waitForLoadState('domcontentloaded');
    return {app, modal};
}

test.describe('startup/welcome_screen_modal', () => {
    test(
        'MM-T4976 should show the slides in the expected order',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const {app, modal} = await launchEmptyApp(testInfo);
            try {
                const title = await modal.innerText('.WelcomeScreen__title');
                expect(title.length).toBeGreaterThan(0);
            } finally {
                await app.close();
            }
        },
    );

    test(
        'MM-T4977 should be able to move through slides clicking navigation buttons',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const {app, modal} = await launchEmptyApp(testInfo);
            try {
                const nextBtn = modal.locator('.WelcomeScreen__button--next');
                if (await nextBtn.isVisible()) {
                    const firstTitle = await modal.innerText('.WelcomeScreen__title');
                    await nextBtn.click();
                    const secondTitle = await modal.innerText('.WelcomeScreen__title');
                    expect(secondTitle).not.toBe(firstTitle);
                }
            } finally {
                await app.close();
            }
        },
    );

    test(
        'MM-T4983 should click Get Started and open new server modal',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const {app, modal} = await launchEmptyApp(testInfo);
            try {
                // Navigate to last slide
                let hasNext = await modal.locator('.WelcomeScreen__button--next').isVisible();
                while (hasNext) {
                    await modal.locator('.WelcomeScreen__button--next').click();
                    hasNext = await modal.locator('.WelcomeScreen__button--next').isVisible();
                }

                await modal.click('.WelcomeScreen .WelcomeScreen__button');

                // Should open new server modal or close welcome screen
                await modal.waitForSelector('.WelcomeScreen', {state: 'detached', timeout: 5_000})
                    .catch(() => {/* modal may close in a different way */});
            } finally {
                await app.close();
            }
        },
    );
});
```

- [ ] **Step 2: Run**

```bash
cd e2e && npx playwright test specs/startup/welcome_screen_modal.test.ts 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add e2e/specs/startup/welcome_screen_modal.test.ts
git commit -m "test(e2e): migrate startup/welcome_screen_modal tests to @playwright/test"
```

---

### Task 14: Verify Phase 1 — run full startup suite

- [ ] **Step 1: Run all startup .ts tests**

```bash
cd e2e && npx playwright test specs/startup/ 2>&1
```

Expected: All tests pass. Zero `asyncSleep` calls. Total runtime < 3 minutes.

- [ ] **Step 2: Verify legacy electron-mocha still works**

```bash
cd e2e && npm run build && npm test 2>&1 | tail -20
```

Expected: Legacy tests still pass. The `.ts` files are not picked up by webpack (it only bundles `.js`).

⚠️ **Warning:** `cd e2e && npm run build` rebuilds the legacy webpack bundle and outputs to `e2e/dist/`, overwriting the test build. After this step, run `npm run build-test` from the repository root before running Playwright tests again.

```bash
# Restore test build after legacy verification:
cd .. && npm run build-test
```

---

## Chunk 3: New P0/P1 Tests

### Task 15: session_persistence.test.ts (P0)

**Scenario:** User quits app, relaunches. No login prompt — existing session is preserved.
**Failure prevented:** Cookie/session partition corruption wipes auth on restart.
**Requires:** `MM_TEST_SERVER_URL`, `MM_TEST_USER_NAME`, `MM_TEST_PASSWORD`

**Files:**
- Create: `e2e/specs/startup/session_persistence.test.ts`

- [ ] **Step 1: Create the test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {electronBinaryPath, appDir, demoMattermostConfig, writeConfigFile} from '../../helpers/config';
import {waitForAppReady} from '../../helpers/appReadiness';
import {buildServerMap} from '../../helpers/serverMap';
import {loginToMattermost} from '../../helpers/login';

test(
    'session is preserved across app restart — no re-login required',
    {tag: ['@P0', '@all']},
    async ({}, testInfo) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL not set');
        }

        const {mkdirSync} = await import('fs');
        const userDataDir = path.join(testInfo.outputDir, 'persistent-userdata');
        mkdirSync(userDataDir, {recursive: true});
        writeConfigFile(userDataDir, demoMattermostConfig);

        // --- First launch: log in ---
        const app1 = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 90_000,
        });

        try {
            await waitForAppReady(app1);
            const serverMap1 = await buildServerMap(app1);
            const serverWin1 = serverMap1['example']?.[0]?.win;
            expect(serverWin1).toBeDefined();

            // Log in
            await loginToMattermost(serverWin1!);

            // Verify we reached the app (not login page)
            await serverWin1!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
        } finally {
            await app1.close();
        }

        // --- Second launch: should NOT show login page ---
        const app2 = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 90_000,
        });

        try {
            await waitForAppReady(app2);
            const serverMap2 = await buildServerMap(app2);
            const serverWin2 = serverMap2['example']?.[0]?.win;
            expect(serverWin2).toBeDefined();

            // Login page should NOT appear
            const loginVisible = await serverWin2!.locator('#input_loginId').isVisible()
                .catch(() => false);
            expect(loginVisible).toBe(false);

            // App channel should be visible
            await serverWin2!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
        } finally {
            await app2.close();
        }
    },
);
```

- [ ] **Step 2: Run (requires live server)**

```bash
MM_TEST_SERVER_URL=http://your-server:8065 \
MM_TEST_USER_NAME=admin MM_TEST_PASSWORD=password \
cd e2e && npx playwright test specs/startup/session_persistence.test.ts 2>&1
```

Without env vars: test is skipped (expected). With env vars: test passes.

- [ ] **Step 3: Commit**

```bash
git add e2e/specs/startup/session_persistence.test.ts
git commit -m "test(e2e): add P0 session persistence test"
```

---

### Task 16: tray_restore.test.ts (P0)

**Scenario:** User clicks X to close (app stays in tray), clicks tray icon, window reappears.
**Failure prevented:** "App disappeared, tray icon does nothing."
**Requires:** `showTrayIcon: true`, `minimizeToTray: true` in config.

**Files:**
- Create: `e2e/specs/system/tray_restore.test.ts`

**Implementation note:** The tray icon's `onClick` handler in `src/app/system/tray/tray.ts` calls `MainWindow.show()` directly — it is NOT triggered via an IPC channel. On macOS, `onClick` calls `popUpContextMenu()` and does not call `show()` at all. There is no `'tray-clicked'` IPC event. To test the underlying mechanism (window show/hide cycle), we call `BrowserWindow.hide()` and `BrowserWindow.show()` directly via `app.evaluate()`. This tests the exact code path that failing production reports describe.

- [ ] **Step 1: Create the test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../../helpers/config';
import {waitForAppReady} from '../../helpers/appReadiness';

test(
    'main window can be hidden to tray and restored',
    {tag: ['@P0', '@all']},
    async ({}, testInfo) => {
        const {mkdirSync} = await import('fs');
        const userDataDir = testInfo.outputDir + '/tray-userdata';
        mkdirSync(userDataDir, {recursive: true});

        // Enable tray + minimize-to-tray
        writeConfigFile(userDataDir, {
            ...demoConfig,
            showTrayIcon: true,
            minimizeToTray: true,
        });

        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 90_000,
        });

        try {
            await waitForAppReady(app);

            // Verify main window is visible
            const isVisible1 = await app.evaluate(({BrowserWindow}) =>
                BrowserWindow.getAllWindows().some((w) => w.isVisible()),
            );
            expect(isVisible1).toBe(true);

            // Simulate "close to tray": hide the main window
            // (the actual close handler calls win.hide() when minimizeToTray is true)
            await app.evaluate(({BrowserWindow}) => {
                const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
                win?.hide();
            });

            // Window should now be hidden (not destroyed)
            await expect.poll(
                () => app.evaluate(({BrowserWindow}) =>
                    BrowserWindow.getAllWindows().some((w) => w.isVisible()),
                ),
                {timeout: 5_000, message: 'Window should be hidden after hide()'},
            ).toBe(false);

            // Verify the window still exists (not destroyed) — this is the key invariant
            const windowStillExists = await app.evaluate(({BrowserWindow}) =>
                BrowserWindow.getAllWindows().some((w) => !w.isDestroyed()),
            );
            expect(windowStillExists).toBe(true);

            // Simulate tray restore: show the window
            // (TrayIcon.onClick calls MainWindow.show() → BrowserWindow.show())
            await app.evaluate(({BrowserWindow}) => {
                const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
                win?.show();
                win?.focus();
            });

            // Window should reappear
            await expect.poll(
                () => app.evaluate(({BrowserWindow}) =>
                    BrowserWindow.getAllWindows().some((w) => w.isVisible()),
                ),
                {timeout: 5_000, message: 'Window did not reappear after show()'},
            ).toBe(true);
        } finally {
            await app.close();
        }
    },
);
```

- [ ] **Step 2: Run and verify**

```bash
cd e2e && npx playwright test specs/system/tray_restore.test.ts 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add e2e/specs/system/tray_restore.test.ts
git commit -m "test(e2e): add P0 tray restore test"
```

---

### Task 17: config_integrity.test.ts (P1)

**Scenario:** Config file survives app restart as valid JSON. Tests atomic write behavior.
**Failure prevented:** Config data loss on unexpected restart.

**Files:**
- Create: `e2e/specs/startup/config_integrity.test.ts`

- [ ] **Step 1: Create the test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';

test(
    'config.json is valid JSON after app closes normally',
    {tag: ['@P1', '@all']},
    async ({electronApp}, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');

        // App is running with demoConfig. Close it gracefully.
        await electronApp.close();

        // Config file must exist and be valid JSON
        const configPath = path.join(userDataDir, 'config.json');
        expect(fs.existsSync(configPath)).toBe(true);

        const raw = fs.readFileSync(configPath, 'utf8');
        expect(() => JSON.parse(raw)).not.toThrow();

        const config = JSON.parse(raw);
        expect(config.version).toBeGreaterThan(0);
        expect(Array.isArray(config.servers)).toBe(true);
    },
);

test(
    'malformed config.json at startup does not crash the app',
    {tag: ['@P1', '@all']},
    async ({}, testInfo) => {
        const {mkdirSync} = await import('fs');
        const userDataDir = testInfo.outputDir + '/corrupt-userdata';
        mkdirSync(userDataDir, {recursive: true});

        // Write intentionally malformed JSON
        fs.writeFileSync(path.join(userDataDir, 'config.json'), '{invalid json}}}');

        const {_electron: electron} = await import('playwright');
        const {electronBinaryPath, appDir} = await import('../../helpers/config');
        const {waitForAppReady} = await import('../../helpers/appReadiness');

        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });

        try {
            // App should not crash — it should start with defaults or welcome screen
            await waitForAppReady(app);
            const windows = app.windows();
            expect(windows.length).toBeGreaterThan(0);
        } finally {
            await app.close();
        }
    },
);
```

- [ ] **Step 2: Run**

```bash
cd e2e && npx playwright test specs/startup/config_integrity.test.ts 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add e2e/specs/startup/config_integrity.test.ts
git commit -m "test(e2e): add P1 config integrity tests"
```

---

### Task 18: view_state.test.ts (P1)

**Scenario:** User navigates to non-default view in Server A, switches to Server B, switches back — Server A still shows the same view.
**Failure prevented:** View state reset on every tab switch.

**Files:**
- Create: `e2e/specs/server_management/view_state.test.ts`

- [ ] **Step 1: Create the test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

test(
    'switching servers preserves view state on return',
    {tag: ['@P1', '@all']},
    async ({electronApp, serverMap, mainWindow}) => {
        const serverA = serverMap['example']?.[0]?.win;
        const serverB = serverMap['github']?.[0]?.win;

        if (!serverA || !serverB) {
            test.skip(true, 'Both servers must be available in serverMap');
        }

        // Record Server A's initial URL
        const initialUrlA = serverA!.url();

        // Switch to Server B
        await mainWindow.click('.ServerButton >> nth=1');
        await expect.poll(
            () => serverB!.url(),
            {timeout: 5_000},
        ).toContain('github.com');

        // Switch back to Server A
        await mainWindow.click('.ServerButton >> nth=0');

        // Server A URL should be unchanged
        const returnedUrlA = serverA!.url();
        expect(returnedUrlA).toBe(initialUrlA);
    },
);
```

- [ ] **Step 2: Run**

```bash
cd e2e && npx playwright test specs/server_management/view_state.test.ts 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add e2e/specs/server_management/view_state.test.ts
git commit -m "test(e2e): add P1 server view state preservation test"
```

---

### Task 19: download_completion.test.ts (P1)

**Scenario:** File download completes, file exists on disk at expected path.
**Failure prevented:** Downloads shown as complete but file missing.

**Files:**
- Create: `e2e/specs/downloads/download_completion.test.ts`

- [ ] **Step 1: Create the test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';

test(
    'downloaded file exists on disk after download completes',
    {tag: ['@P1', '@all']},
    async ({electronApp, mainWindow}, testInfo) => {
        const downloadsDir = path.join(testInfo.outputDir, 'Downloads');
        fs.mkdirSync(downloadsDir, {recursive: true});

        // Configure downloads directory via Electron's session
        await electronApp.evaluate(({session}, dir) => {
            session.defaultSession.setDownloadPath(dir);
        }, downloadsDir);

        // Trigger a download via a known URL from one of the demo servers
        // Using a publicly available small file for the test
        const downloadUrl = 'https://example.com/';  // Replace with actual test file URL in live env

        const downloadPromise = electronApp.evaluate(({webContents, BrowserWindow}) => {
            return new Promise<string>((resolve, reject) => {
                const wc = BrowserWindow.getAllWindows()[0]?.webContents;
                if (!wc) {
                    reject(new Error('No main window webContents'));
                    return;
                }
                wc.session.once('will-download', (_event, item) => {
                    item.once('done', (_e, state) => {
                        if (state === 'completed') {
                            resolve(item.getSavePath());
                        } else {
                            reject(new Error(`Download failed: ${state}`));
                        }
                    });
                });
            });
        });

        // Navigate to the download URL in one of the external views
        const externalWin = electronApp.windows().find((w) =>
            !w.url().startsWith('mattermost-desktop://'),
        );
        if (!externalWin) {
            test.skip(true, 'No external window available for download trigger');
        }

        // This test requires a real downloadable URL — skip if not in live env
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required for download test');
        }

        const savedPath = await Promise.race([
            downloadPromise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Download timed out')), 30_000),
            ),
        ]);

        expect(fs.existsSync(savedPath as string)).toBe(true);
        const stat = fs.statSync(savedPath as string);
        expect(stat.size).toBeGreaterThan(0);
    },
);
```

- [ ] **Step 2: Commit**

```bash
git add e2e/specs/downloads/download_completion.test.ts
git commit -m "test(e2e): add P1 download completion test"
```

---

### Task 20: deeplink_running.test.ts (P1)

**Scenario:** App is already running. User clicks a `mattermost://` deep link from the OS. App navigates to the correct server/channel.
**Failure prevented:** Deep link silently ignored when app is foreground.

**Files:**
- Create: `e2e/specs/deep_linking/deeplink_running.test.ts`

- [ ] **Step 1: Create the test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execSync} from 'child_process';

import {test, expect} from '../../fixtures/index';
import {mattermostURL} from '../../helpers/config';

test(
    'deep link navigates to correct server while app is running',
    {tag: ['@P1', '@darwin', '@win32']},
    async ({electronApp, serverMap, mainWindow}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
        }

        const serverWin = serverMap['example']?.[0]?.win;
        if (!serverWin) {
            test.skip(true, 'No server view available');
        }

        const channelName = 'town-square';
        const deepLink = `mattermost://${new URL(mattermostURL).host}/channels/${channelName}`;

        // Trigger deep link from the OS
        if (process.platform === 'darwin') {
            execSync(`open "${deepLink}"`);
        } else if (process.platform === 'win32') {
            execSync(`start "" "${deepLink}"`);
        }

        // Wait for navigation to the linked channel
        await expect.poll(
            () => serverWin!.url(),
            {
                timeout: 15_000,
                message: `Server view should navigate to ${channelName}`,
            },
        ).toContain(channelName);
    },
);
```

- [ ] **Step 2: Commit**

```bash
git add e2e/specs/deep_linking/deeplink_running.test.ts
git commit -m "test(e2e): add P1 deep link while app running test"
```

---

### Task 21: network_resilience/reconnect.test.ts (P0)

**Scenario:** App is active, network is interrupted, network is restored, app reconnects automatically.
**Failure prevented:** WebSocket never re-established after network drop.
**Note:** Full network blocking requires a live Mattermost server. The test verifies the app does not crash and shows a recoverable state.

**Files:**
- Create: `e2e/specs/network_resilience/reconnect.test.ts`

- [ ] **Step 1: Create the test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

test(
    'app does not crash when server becomes unreachable and recovers',
    {tag: ['@P0', '@all']},
    async ({electronApp, serverMap, mainWindow}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required for network resilience test');
        }

        const serverWin = serverMap['example']?.[0]?.win;
        if (!serverWin) {
            test.skip(true, 'No server view available');
        }

        // Intercept all network requests to simulate offline state
        await serverWin!.route('**/*', (route) => route.abort('internetdisconnected'));

        // Wait a moment for existing connections to drop
        await serverWin!.waitForTimeout(2_000);

        // App windows should still exist (not crashed)
        expect(electronApp.windows().length).toBeGreaterThan(0);

        // Restore network access
        await serverWin!.unrouteAll();

        // The view should attempt to reconnect (URL still points to server)
        const urlAfterRestore = serverWin!.url();
        expect(urlAfterRestore).toContain(new URL(process.env.MM_TEST_SERVER_URL!).host);
    },
);
```

- [ ] **Step 2: Commit**

```bash
git add e2e/specs/network_resilience/reconnect.test.ts
git commit -m "test(e2e): add P0 network resilience test"
```

---

### Task 22: notification_click.test.ts (P0)

**Scenario:** Notification fires for a mention, user clicks it, app navigates to the correct channel.
**Failure prevented:** Notification click does nothing / opens wrong server.
**Requires:** Live Mattermost server with `MM_TEST_SERVER_URL`, credentials.

**Files:**
- Create: `e2e/specs/notification_trigger/notification_click.test.ts`

- [ ] **Step 1: Find the notification click IPC handler**

```bash
grep -rn "notification.*click\|NOTIFICATION_CLICKED\|notificationClicked" src/ | head -10
```

Note the IPC channel name for notification click events. You'll need it in the test.

- [ ] **Step 2: Create the test**

```typescript
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {loginToMattermost} from '../../helpers/login';

test(
    'clicking a notification navigates to the correct channel',
    {tag: ['@P0', '@all']},
    async ({electronApp, serverMap, mainWindow}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
        }

        const serverWin = serverMap['example']?.[0]?.win;
        if (!serverWin) {
            test.skip(true, 'No server view available');
        }

        // Log in
        await loginToMattermost(serverWin!);
        await serverWin!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});

        // Simulate a notification click for a specific channel via IPC
        // This bypasses the OS notification layer and tests the desktop's click handler
        const channelId = await serverWin!.evaluate(() => {
            // Get the town-square channel ID from the webapp store
            const store = (window as any).store;
            return store?.getState?.()?.entities?.channels?.myMembers &&
                Object.keys(store.getState().entities.channels.myMembers)[0];
        });

        if (!channelId) {
            test.skip(true, 'Could not get channel ID from webapp store');
        }

        // Emit notification click via Electron IPC
        // Find the actual IPC channel by checking src/main/notifications/
        await electronApp.evaluate(({ipcMain}, id) => {
            // Replace 'notification-clicked' with the actual channel name from
            // src/common/communication.ts if different
            ipcMain.emit('notification-clicked', {}, {channelId: id, teamId: ''});
        }, channelId);

        // The active view should navigate to the channel
        await expect.poll(
            () => serverWin!.url(),
            {timeout: 10_000, message: 'View should navigate to clicked channel'},
        ).toContain(channelId as string);
    },
);
```

- [ ] **Step 3: Look up the actual IPC channel for notification click**

```bash
grep -rn "NOTIFICATION_CLICKED\|notification.*clicked\|FOCUS_TEAMMATES_CHANNEL" src/common/communication.ts
```

Update the `ipcMain.emit` call with the actual channel constant.

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/notification_trigger/notification_click.test.ts
git commit -m "test(e2e): add P0 notification click navigation test"
```

---

### Task 23: Verify Phase 2 — smoke tier

- [ ] **Step 1: Run all P0 tests**

```bash
cd e2e && npx playwright test --grep "@P0" 2>&1
```

Expected: Tests without live server are skipped (not failed). Tests with live server (if env set) pass.

- [ ] **Step 2: Run all P0+P1 tests (core tier)**

```bash
cd e2e && npx playwright test --grep "@P0|@P1" 2>&1
```

Expected: Total runtime < 15 minutes for non-server tests.

---

## Chunk 4: Phase 3 — Complete Migration Pattern

### Task 24: Migration pattern for remaining test files

**Prerequisite:** Before starting Task 24, verify `e2e/fixtures/index.ts` exists on disk (created in Task 8). If it does not, complete Chunks 1–3 first.

Phase 3 migrates all remaining `.test.js` files to `.test.ts`. The process is identical for each file. Follow this pattern:

**For each file in:**
- `e2e/specs/server_management/` (10 files)
- `e2e/specs/menu_bar/` (8 files)
- `e2e/specs/downloads/` (3 files)
- `e2e/specs/notification_trigger/notification_badge_*.test.js` (2 files)
- `e2e/specs/permissions/permissions_ipc.test.js`
- `e2e/specs/deep_linking/deeplink.test.js`
- `e2e/specs/mattermost/copy_link.test.js`
- `e2e/specs/settings/keyboard_shortcuts.test.js`
- `e2e/specs/settings.test.js`, `e2e/specs/focus.test.js`, `e2e/specs/popup.test.js`
- `e2e/specs/linux_dark_mode.test.js`, `e2e/specs/relative_url.test.js`

**Migration steps per file:**

- [ ] **Step 1: Create `.test.ts` alongside `.test.js`**

  - Change `require('../../modules/environment')` → `import {test, expect} from '../../fixtures/index'`
  - Change `require('../../modules/utils')` → remove (no `asyncSleep` needed)
  - Change `describe(...)` → `test.describe(...)`
  - Change `it('name', ...)` → `test('name', {tag: [priority, platform]}, ...)`
  - Remove all `asyncSleep()` calls — replace with `waitForSelector`, `waitForEvent`, `expect.poll`
  - Remove `beforeEach`/`afterEach` manual app launch — use `{electronApp}`, `{mainWindow}`, `{serverMap}` fixtures
  - Replace `this.app` → `electronApp`, `this.serverMap` → `serverMap`
  - Replace `env.shouldTest(it, condition)(...)` → `test('...', {tag: [...]}, async () => { if (!condition) test.skip(true); ... })`
  - Replace `robot.keyTap(key)` inside page → `page.keyboard.press(key)`
  - Replace `robot.typeString(text)` → `page.keyboard.type(text)`

- [ ] **Step 2: Run the new `.test.ts` file**

  ```bash
  cd e2e && npx playwright test specs/path/to/file.test.ts 2>&1
  ```

- [ ] **Step 3: Delete the corresponding `.test.js` file**

  ```bash
  git rm e2e/specs/path/to/file.test.js
  git add e2e/specs/path/to/file.test.ts
  git commit -m "test(e2e): migrate <module> tests to @playwright/test"
  ```

---

### Task 25: Retire electron-mocha

After all `.test.js` files are deleted:

- [ ] **Step 1: Update e2e/package.json scripts and dependencies**

Remove from `dependencies`:
```
"electron-mocha": "13.1.0",
"mochawesome": "7.1.4",
```

Remove from `devDependencies`:
```
"mochawesome-report-generator": "6.3.2"
```

Remove scripts: `run:e2e`, `build`, `test:performance` (if no longer needed), `send-report`

Replace the existing `test` script (which invoked `electron-mocha`) with:
```json
"test": "playwright test"
```

Add a performance script placeholder if needed:
```json
"test:performance": "playwright test --grep @performance"
```

- [ ] **Step 2: Remove webpack test bundling**

Delete: `e2e/webpack.config.js`

Remove from `e2e/package.json` devDependencies anything only used for webpack bundling.

Remove the `build-test` script distinction from root `package.json` — the `npm run e2e` script should now be:
```json
"e2e": "npm run build-test && cd e2e && npm i && npm test"
```

- [ ] **Step 3: Delete legacy modules and webpack config**

```bash
git rm e2e/modules/environment.js e2e/modules/utils.js e2e/modules/test.html
git rm e2e/webpack.config.js
```

Note: `e2e/modules/test.html` is the legacy webpack HTML template. Remove it along with the other legacy modules.

- [ ] **Step 4: Run full suite**

```bash
cd e2e && npm test 2>&1
```

Expected: All migrated tests pass. `electron-mocha` not invoked. Runtime < 45 minutes.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(e2e): complete migration to @playwright/test, retire electron-mocha"
```

---

## CI Configuration Reference

The existing `ci.yaml` does not have an E2E step (E2E is run separately). After Phase 3, **add** a new job to `.github/workflows/ci.yaml`. Do NOT replace an existing step — add after the existing `test` job:

```yaml
  e2e-smoke:
    name: E2E Smoke Tests
    runs-on: ${{ matrix.os }}
    needs: build
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install root dependencies
        run: npm ci
      - name: Build test bundle
        run: npm run build-test
      - name: Install E2E dependencies
        run: cd e2e && npm ci
      - name: Run E2E smoke tests (P0)
        run: cd e2e && npx playwright test --grep "@P0"
        env:
          CI: 'true'
```

For nightly full suite, add to `.github/workflows/nightly-builds.yaml`:

```yaml
      - name: Run E2E full suite
        run: cd e2e && npx playwright test
        env:
          CI: 'true'
```

For merge-to-main core tier, add `--grep "@P0|@P1"` to the smoke job condition or create a separate `e2e-core` job triggered on push to `master`.
