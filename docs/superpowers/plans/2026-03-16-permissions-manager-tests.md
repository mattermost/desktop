# Permissions Manager Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 unit tests (PM-U01–U07) to `permissionsManager.test.js` and create `e2e/specs/permissions/permissions_ipc.test.js` with 3 E2E IPC registration tests (E2E-P01–P03), covering Calls widget routing, external fullscreen, null mainWindow guard, Windows ms-settings shortcuts, and OS media access guards.

**Architecture:** Unit tests live in the existing test file — no new file. The `shell` mock is added once; all 7 tests are appended inside existing `describe` blocks. The E2E file is a standalone Mocha spec bootstrapped with `env.getApp()`, identical in structure to existing permission E2E tests in `e2e/specs/`.

**Tech Stack:** Jest (unit), Playwright + Mocha (E2E), Electron `ipcMain`/`contextBridge`, `systemPreferences`, `shell`.

---

## Chunk 1: Unit test scaffolding and Group 1 (Calls widget)

### Task 1: Add `shell` to the electron mock and import

**Files:**
- Modify: `src/main/security/permissionsManager.test.js:4` (import line)
- Modify: `src/main/security/permissionsManager.test.js:19-34` (jest.mock electron factory)

- [ ] **Step 1: Read the current import line and mock factory**

The file currently reads (lines 4 and 19–34):
```js
import {dialog, systemPreferences} from 'electron';

jest.mock('electron', () => ({
    app: { name: 'Mattermost' },
    ipcMain: { on: jest.fn(), handle: jest.fn() },
    dialog: { showMessageBox: jest.fn() },
    systemPreferences: {
        getMediaAccessStatus: jest.fn(),
        askForMediaAccess: jest.fn(),
    },
}));
```

- [ ] **Step 2: Add `shell` to the import and mock factory**

Change the import at line 4:
```js
import {dialog, shell, systemPreferences} from 'electron';
```

Add `shell` to the mock factory after `dialog`:
```js
    shell: {
        openExternal: jest.fn(),
    },
```

- [ ] **Step 3: Run unit tests to confirm no regression**

```bash
cd /Users/yasserkhan/Documents/mattermost/desktop
npm run test:unit -- --testPathPattern=permissionsManager
```

Expected: All 15 existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/security/permissionsManager.test.js
git commit -m "test(permissions): add shell mock to electron factory"
```

---

### Task 2: PM-U01 and PM-U02 — Calls widget routing

**Files:**
- Modify: `src/main/security/permissionsManager.test.js` — append inside `describe('handlePermissionRequest')` block, before the closing `});`

- [ ] **Step 1: Write the two failing tests**

Append these two tests at the end of the `describe('handlePermissionRequest')` block (before its closing `});` on line 288):

```js
        it('PM-U01: should allow Calls widget request when pre-granted and not consult WebContentsManager', async () => {
            CallsWidgetWindow.isCallsWidget.mockReturnValue(true);
            CallsWidgetWindow.getViewURL.mockReturnValue(new URL('http://anyurl.com'));
            isTrustedURL.mockReturnValue(true);
            const permissionsManager = new PermissionsManager('anyfile.json');
            permissionsManager.json = {
                'http://anyurl.com': {screenShare: {allowed: true}},
            };
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest(
                {id: 2},
                'screenShare',
                cb,
                {requestingUrl: 'http://anyurl.com'},
            );
            expect(cb).toHaveBeenCalledWith(true);
            expect(WebContentsManager.getViewByWebContentsId).not.toHaveBeenCalled();
        });

        it('PM-U02: should deny Calls widget request when getViewURL returns null', async () => {
            CallsWidgetWindow.isCallsWidget.mockReturnValue(true);
            CallsWidgetWindow.getViewURL.mockReturnValue(null);
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest(
                {id: 2},
                'screenShare',
                cb,
                {requestingUrl: 'http://anyurl.com'},
            );
            expect(cb).toHaveBeenCalledWith(false);
        });
```

- [ ] **Step 2: Run to confirm both tests fail before any source change**

```bash
npm run test:unit -- --testPathPattern=permissionsManager
```

Expected: PM-U01 and PM-U02 fail (no implementation issue — this verifies the test assertions execute).

> Note: These tests exercise existing source paths. If they pass immediately, that means the code already satisfies the condition — verify the assertion is actually exercising the branch (check `WebContentsManager.getViewByWebContentsId` call count).

- [ ] **Step 3: Run again to confirm tests pass (no source change needed)**

Both tests should pass because the source already implements these paths correctly. The value is regression protection — if the branch is removed later, these tests fail.

```bash
npm run test:unit -- --testPathPattern=permissionsManager
```

Expected: All 17 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/security/permissionsManager.test.js
git commit -m "test(permissions): PM-U01/U02 Calls widget routing tests"
```

---

## Chunk 2: Unit tests Groups 2–3 (fullscreen + null window)

### Task 3: PM-U03 — External fullscreen shows dialog

**Files:**
- Modify: `src/main/security/permissionsManager.test.js` — append inside `describe('handlePermissionRequest')` block

- [ ] **Step 1: Write the failing test**

Append inside `describe('handlePermissionRequest')`:

```js
        it('PM-U03: should show dialog for fullscreen from an external origin', async () => {
            dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 2}));
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest(
                {id: 2},
                'fullscreen',
                cb,
                {requestingUrl: 'http://youtube.com'},
            );
            expect(dialog.showMessageBox).toHaveBeenCalled();
            expect(cb).toHaveBeenCalledWith(true);
        });
```

Key points:
- Server URL for `webContentsId: 2` is `http://anyurl.com` (from inherited `beforeEach`).
- `http://youtube.com` has a different origin → `isExternalFullscreen = true`.
- `fullscreen` is NOT in `authorizablePermissionTypes`, but `isExternalFullscreen` forces the dialog branch.
- `dialog.showMessageBox` response `2` = "Allow" (same as existing dialog tests).

- [ ] **Step 2: Run tests immediately after writing to observe the new test**

```bash
npm run test:unit -- --testPathPattern=permissionsManager
```

Expected: The test runner shows 18 tests. PM-U03 should pass (the source already implements this path — the test adds regression protection). If it fails, investigate before moving on.

- [ ] **Step 3: Commit**

```bash
git add src/main/security/permissionsManager.test.js
git commit -m "test(permissions): PM-U03 external fullscreen dialog test"
```

---

### Task 4: PM-U04 — Null main window guard

**Files:**
- Modify: `src/main/security/permissionsManager.test.js` — append inside `describe('handlePermissionRequest')` block

- [ ] **Step 1: Write the test**

Append inside `describe('handlePermissionRequest')`:

```js
        it('PM-U04: should deny without crash when main window is null at dialog time', async () => {
            MainWindow.get.mockReturnValue(null);
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest(
                {id: 2},
                'notifications',
                cb,
                {requestingUrl: 'http://anyurl.com'},
            );
            expect(cb).toHaveBeenCalledWith(false);
            expect(dialog.showMessageBox).not.toHaveBeenCalled();
        });
```

Key points:
- `MainWindow.get.mockReturnValue(null)` overrides the `beforeEach` which sets it to `{webContents: {id: 1}}`.
- `notifications` is in `authorizablePermissionTypes`, has no prior decision in `permissionsManager.json`, so the dialog path is reached.
- Lines 189–191 in source: `if (!mainWindow) { resolve(false); return; }` — this test exercises that guard.

- [ ] **Step 2: Run tests immediately after writing to observe the new test**

```bash
npm run test:unit -- --testPathPattern=permissionsManager
```

Expected: The test runner shows 19 tests. PM-U04 should pass. If it fails (e.g., `cb` was called with `true` or `dialog.showMessageBox` was called), the null-window guard in the source may be broken — stop and investigate before committing.

- [ ] **Step 3: Commit**

```bash
git add src/main/security/permissionsManager.test.js
git commit -m "test(permissions): PM-U04 null main window guard test"
```

---

## Chunk 3: Unit tests Groups 4–5 (Windows IPC + media guards)

### Task 5: PM-U05 — Windows IPC ms-settings URL correctness

**Files:**
- Modify: `src/main/security/permissionsManager.test.js` — append as a standalone `it` inside `describe('main/PermissionsManager')` (the outer describe), NOT inside `describe('handlePermissionRequest')`

- [ ] **Step 1: Write the test**

Append after the `describe('setForServer')` block closes (after line 81) but before `describe('handlePermissionRequest')` opens:

```js
    it('PM-U05: should open the correct ms-settings URLs for Windows camera and microphone', () => {
        const permissionsManager = new PermissionsManager('anyfile.json');
        permissionsManager['openWindowsCameraPreferences']();
        expect(shell.openExternal).toHaveBeenCalledWith('ms-settings:privacy-webcam');

        permissionsManager['openWindowsMicrophonePreferences']();
        expect(shell.openExternal).toHaveBeenCalledWith('ms-settings:privacy-microphone');
    });
```

Key points:
- `shell.openExternal` is the mock added in Task 1.
- TypeScript `private` is compile-time only; bracket notation works in un-minified Jest.
- No platform gate needed — the test runs everywhere and just verifies the string argument.

- [ ] **Step 2: Run tests immediately after writing to observe the new test**

```bash
npm run test:unit -- --testPathPattern=permissionsManager
```

Expected: The test runner shows 20 tests. PM-U05 should pass. If `shell.openExternal` is called with wrong URLs (e.g., `ms-settings:privacy-camera` instead of `ms-settings:privacy-webcam`), stop — the source has a typo in the settings URL.

- [ ] **Step 3: Commit**

```bash
git add src/main/security/permissionsManager.test.js
git commit -m "test(permissions): PM-U05 Windows ms-settings URL correctness"
```

---

### Task 6: PM-U06 and PM-U07 — OS media access guards

**Files:**
- Modify: `src/main/security/permissionsManager.test.js` — append inside `describe('setForServer')` block

- [ ] **Step 1: Write PM-U06 and PM-U07**

Append inside the `describe('setForServer')` block (after the closing brace of the existing `if (process.platform !== 'linux')` block, before `describe('setForServer')`'s closing `});`):

```js
        if (process.platform !== 'linux') {
            it('PM-U06: should not call askForMediaAccess when OS has already granted access', () => {
                systemPreferences.getMediaAccessStatus.mockReturnValue('granted');
                const permissionsManager = new PermissionsManager('anyfile.json');
                permissionsManager.setForServer(
                    {url: new URL('http://anyurl.com')},
                    {media: {allowed: true}},
                );
                expect(systemPreferences.askForMediaAccess).not.toHaveBeenCalled();
            });
        }

        it('PM-U07: should skip all media access checks on Linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'linux', configurable: true});
            try {
                const permissionsManager = new PermissionsManager('anyfile.json');
                permissionsManager.setForServer(
                    {url: new URL('http://anyurl.com')},
                    {media: {allowed: true}},
                );
                expect(systemPreferences.getMediaAccessStatus).not.toHaveBeenCalled();
                expect(systemPreferences.askForMediaAccess).not.toHaveBeenCalled();
            } finally {
                Object.defineProperty(process, 'platform', {value: originalPlatform, configurable: true});
            }
        });
```

Key points:
- PM-U06 is gated `if (process.platform !== 'linux')` — mirrors the existing `setForServer` test pattern and the source guard (`process.platform === 'win32' || process.platform === 'darwin'`).
- PM-U07 uses `Object.defineProperty` to override `process.platform` to `'linux'`, wrapped in try/finally to guarantee restore even if the assertions fail.
- `configurable: true` is required for `Object.defineProperty` to succeed on `process.platform` in Node.js.

- [ ] **Step 2: Run tests immediately after writing to observe the new tests**

```bash
npm run test:unit -- --testPathPattern=permissionsManager
```

Expected: The test runner shows 22 tests (or 21 if PM-U06 is skipped on Linux). Both new tests should pass. If PM-U06 fails with `askForMediaAccess` being called even when `getMediaAccessStatus` returns `'granted'`, the source is missing the early-exit guard. If PM-U07 fails, check that `configurable: true` is present on both `Object.defineProperty` calls — without it the restore throws `TypeError: Cannot redefine property: platform`.

- [ ] **Step 3: Commit**

```bash
git add src/main/security/permissionsManager.test.js
git commit -m "test(permissions): PM-U06/U07 OS media access guard tests"
```

---

## Chunk 4: E2E tests

### Task 7: Create `e2e/specs/permissions/permissions_ipc.test.js`

**Files:**
- Create: `e2e/specs/permissions/permissions_ipc.test.js`

- [ ] **Step 1: Examine an existing E2E test for file structure reference**

Read `e2e/specs/` to find a comparable test file (e.g., notification or settings E2E test) to confirm the `require` paths for `environment` module and `communication` constants.

```bash
ls e2e/specs/
```

Then check one file to confirm `require('../../modules/environment')` path resolves from `e2e/specs/permissions/`.

- [ ] **Step 2: Create the new file**

Create `e2e/specs/permissions/permissions_ipc.test.js`:

```js
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const {SHOW_SETTINGS_WINDOW} = require('src/common/communication');

const env = require('../../modules/environment');

describe('permissions/ipc', function desc() {
    this.timeout(30000);

    before(async function() {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(env.demoConfig));
        this.app = await env.getApp();
        await this.app.evaluate(({ipcMain}, showWindow) => {
            ipcMain.emit(showWindow);
        }, SHOW_SETTINGS_WINDOW);
        this.settingsWindow = await this.app.waitForEvent('window', {
            predicate: (w) => w.url().includes('settings'),
        });
    });

    after(async function() {
        if (this.app) {
            await this.app.close();
        }
    });

    it('E2E-P01: should return a valid media access status via GET_MEDIA_ACCESS_STATUS IPC', async function() {
        const status = await this.settingsWindow.evaluate(
            () => window.desktop.getMediaAccessStatus('microphone'),
        );
        expect(['granted', 'denied', 'not-determined', 'restricted']).to.include(status);
    });

    env.shouldTest(it, process.platform === 'win32')(
        'E2E-P02: should open ms-settings:privacy-webcam for camera preferences (Windows only)',
        async function() {
            await this.app.evaluate(() => {
                const {shell} = require('electron');
                global.__testCapturedExternalURL = null;
                shell.openExternal = (url) => {
                    global.__testCapturedExternalURL = url;
                    return Promise.resolve();
                };
            });

            await this.settingsWindow.evaluate(
                () => window.desktop.openWindowsCameraPreferences(),
            );

            const capturedURL = await this.app.evaluate(
                () => global.__testCapturedExternalURL,
            );
            expect(capturedURL).to.equal('ms-settings:privacy-webcam');
        },
    );

    env.shouldTest(it, process.platform === 'win32')(
        'E2E-P03: should open ms-settings:privacy-microphone for microphone preferences (Windows only)',
        async function() {
            await this.app.evaluate(() => {
                const {shell} = require('electron');
                global.__testCapturedExternalURL = null;
                shell.openExternal = (url) => {
                    global.__testCapturedExternalURL = url;
                    return Promise.resolve();
                };
            });

            await this.settingsWindow.evaluate(
                () => window.desktop.openWindowsMicrophonePreferences(),
            );

            const capturedURL = await this.app.evaluate(
                () => global.__testCapturedExternalURL,
            );
            expect(capturedURL).to.equal('ms-settings:privacy-microphone');
        },
    );
});
```

Key points:
- `describe` and `before`/`after` use regular `function()` — arrow functions break Mocha's `this` binding.
- `SHOW_SETTINGS_WINDOW` is imported from `src/common/communication` and passed as a second argument to `app.evaluate`, not hardcoded as a string.
- `require('electron')` inside `app.evaluate` is needed because `shell` is not available in the Playwright evaluate context object destructuring — the callback runs in the Electron main process.
- `env.shouldTest(it, process.platform === 'win32')` returns `it` on Windows and `it.skip` on other platforms.
- E2E-P01 runs on all platforms — every OS returns one of the four valid `getMediaAccessStatus` strings.

- [ ] **Step 3: Verify the E2E file is discovered by the test runner**

Check that the E2E runner config picks up `e2e/specs/permissions/`:

```bash
cat e2e/.mocharc.js 2>/dev/null || cat e2e/mocha.opts 2>/dev/null || grep -r "specs" e2e/package.json | head -5
```

Expected: The glob pattern includes `e2e/specs/**/*.test.js` or equivalent.

- [ ] **Step 4: Run E2E tests on current platform (smoke check)**

```bash
npm run e2e -- --grep "permissions/ipc"
```

Expected on macOS/Linux: E2E-P01 passes; E2E-P02 and E2E-P03 are pending (skipped).
Expected on Windows: All three tests pass.

- [ ] **Step 5: Commit**

```bash
git add e2e/specs/permissions/permissions_ipc.test.js
git commit -m "test(permissions): E2E-P01/P02/P03 IPC registration tests"
```

---

## Verification

After all tasks are complete:

```bash
# Unit tests — all 22 should pass
npm run test:unit -- --testPathPattern=permissionsManager

# E2E smoke (platform-appropriate result)
npm run e2e -- --grep "permissions/ipc"

# Full check (lint + types + unit)
npm run check
```

Final state:
- `src/main/security/permissionsManager.test.js` — 22 tests (15 existing + 7 new)
- `e2e/specs/permissions/permissions_ipc.test.js` — 3 tests (1 all-platform + 2 Windows-only)
- No source file changes

## What was intentionally excluded

- `getForServer` / `handleGetMediaAccessStatus` — trivial 1-line getters; no logic to protect
- Full dialog user flow — `NODE_ENV=test` hard-resolves dialogs; OS dialogs cannot be automated
- Persisted-JSON E2E round-trip — requires live server page; fragile and out of scope
