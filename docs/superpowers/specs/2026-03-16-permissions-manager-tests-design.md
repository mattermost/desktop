# Permissions Manager Test Coverage Design

## Goal

Add 7 unit tests and 3 E2E tests to the existing `permissionsManager.test.js` and a new `e2e/specs/permissions/permissions_ipc.test.js`, covering the real user-facing permission flows that are currently untested: Calls screen share routing, external fullscreen dialogs, Windows IPC settings shortcuts, and OS-level media access guards.

## Context

`src/main/security/permissionsManager.ts` (272 lines) has 15 existing unit tests covering the main `doPermissionRequest` decision tree. The gaps targeted here were chosen because they either (a) protect against a crash, (b) guard a real user-visible feature that would silently break, or (c) test non-obvious branching that code reviews regularly miss.

---

## Unit Tests — `src/main/security/permissionsManager.test.js`

All 7 tests go into the existing file. No new test file needed.

### Mock additions required

1. Add `shell: { openExternal: jest.fn() }` to the `jest.mock('electron', ...)` factory.
2. Add `shell` to the destructured import at the top of the file alongside `dialog` and `systemPreferences`:
   ```js
   import {dialog, shell, systemPreferences} from 'electron';
   ```

---

### Group 1: Calls Widget routing (PM-U01, PM-U02)

`doPermissionRequest` has a hard branch at line 146: if `CallsWidgetWindow.isCallsWidget(webContentsId)` is true, it skips `WebContentsManager` entirely and calls `CallsWidgetWindow.getViewURL()`. All existing tests set `isCallsWidget` to `false`. If this branch is removed or broken, screen share in Calls silently stops working for every user on an active call.

Both tests go inside the existing `describe('handlePermissionRequest')` block, inheriting its `beforeEach` (which sets up `WebContentsManager`, `ServerURL`, `parseURL`, `isTrustedURL`, `MainWindow`, and `NODE_ENV: 'jest'`).

**PM-U01 — Calls widget with pre-granted permission is allowed**

Setup (inside the describe, in addition to inherited beforeEach):
- `CallsWidgetWindow.isCallsWidget.mockReturnValue(true)`
- `CallsWidgetWindow.getViewURL.mockReturnValue(new URL('http://anyurl.com'))`
- `isTrustedURL.mockReturnValue(true)`
- `permissionsManager.json = { 'http://anyurl.com': { screenShare: { allowed: true } } }`

Call: `handlePermissionRequest({id: 2}, 'screenShare', cb, {requestingUrl: 'http://anyurl.com'})`

Assert: `cb` called with `true`. `WebContentsManager.getViewByWebContentsId` is NOT called.

Note: `requestingUrl` must be provided in `details`; for non-`media` permissions the code uses `details.requestingUrl` (not `details.securityOrigin`) to build `parsedURL`.

**PM-U02 — Calls widget denied when getViewURL returns null**

Setup:
- `CallsWidgetWindow.isCallsWidget.mockReturnValue(true)`
- `CallsWidgetWindow.getViewURL.mockReturnValue(null)`

Call: `handlePermissionRequest({id: 2}, 'screenShare', cb, {requestingUrl: 'http://anyurl.com'})`

Assert: `cb` called with `false`. Verifies the null-serverURL guard (line 156–158) is reached via the Calls widget path.

---

### Group 2: External fullscreen (PM-U03)

`permission === 'fullscreen'` is NOT in `authorizablePermissionTypes`, so trusted same-origin fullscreen is auto-granted (line 242). However, `isExternalFullscreen = permission === 'fullscreen' && parsedURL.origin !== serverURL.origin` (line 168) overrides this and forces a dialog — regardless of `isTrustedURL`'s return value. A developer cleaning up line 176 could collapse `authorizablePermissionTypes.includes(permission) || isExternalFullscreen` to just the array check, silently breaking YouTube/Vimeo embeds in fullscreen.

This test must be inside the `describe('handlePermissionRequest')` block to inherit the `beforeEach` that sets `NODE_ENV: 'jest'`, which bypasses the `if (process.env.NODE_ENV === 'test') { resolve(false) }` guard at lines 200–203 and allows the real dialog path to execute.

**PM-U03 — External fullscreen (different origin) shows dialog**

Call: `handlePermissionRequest({id: 2}, 'fullscreen', cb, {requestingUrl: 'http://youtube.com'})` — server is `http://anyurl.com` from the inherited beforeEach.

Setup: `dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 2}))`.

Assert: `dialog.showMessageBox` is called; `cb` called with `true`.

Note: `isTrustedURL` returning `false` for this pair is not load-bearing here — `isExternalFullscreen` alone drives the dialog branch. The mock is inherited but its return value does not affect the outcome.

---

### Group 3: No main window at dialog time (PM-U04)

Lines 189–191: if `mainWindow` is null when a dialog is needed (authorizable permission, no prior decision), the function returns `false` rather than calling `dialog.showMessageBox(null, ...)` which would throw. The window can be null when minimized to tray, during restart, or before first render.

This test must be inside `describe('handlePermissionRequest')` so the `beforeEach` configures `WebContentsManager.getViewByWebContentsId` and `getServerURLByViewId` for webContentsId `2`. Without those mocks, execution short-circuits earlier at line 151 with `false` for a different reason, making the test a false positive.

**PM-U04 — Authorizable permission denied without crash when main window is null**

Setup (inside the describe): `MainWindow.get.mockReturnValue(null)`. No prior decision in `permissionsManager.json`.

Call: `handlePermissionRequest({id: 2}, 'notifications', cb, {requestingUrl: 'http://anyurl.com'})`

Assert: `cb` called with `false`. `dialog.showMessageBox` NOT called.

---

### Group 4: Windows IPC handlers (PM-U05)

`openWindowsCameraPreferences` and `openWindowsMicrophonePreferences` are private 1-line methods that open specific `ms-settings:` URLs. A typo routes Windows users to the wrong settings page silently. Access via bracket notation (`permissionsManager['openWindowsCameraPreferences']()`); TypeScript `private` is compile-time only and bracket notation works in the un-minified Jest environment.

**PM-U05 — Windows IPC handlers open the correct ms-settings URLs**

```js
const permissionsManager = new PermissionsManager('anyfile.json');
permissionsManager['openWindowsCameraPreferences']();
expect(shell.openExternal).toHaveBeenCalledWith('ms-settings:privacy-webcam');

permissionsManager['openWindowsMicrophonePreferences']();
expect(shell.openExternal).toHaveBeenCalledWith('ms-settings:privacy-microphone');
```

---

### Group 5: setForServer media access guards (PM-U06, PM-U07)

`setForServer` calls `checkMediaAccess('microphone')` and `checkMediaAccess('camera')`, which call `systemPreferences.askForMediaAccess` if the OS status is not `'granted'`. Calling `askForMediaAccess` when already granted triggers a redundant OS-level permission prompt. On Linux, `askForMediaAccess` is not implemented and throws.

**PM-U06 — No askForMediaAccess when OS already granted**

Gate: `if (process.platform !== 'linux')` — mirrors the existing `setForServer` test pattern; the source code's `process.platform === 'win32' || process.platform === 'darwin'` guard means this test is vacuously true on Linux.

Setup: `systemPreferences.getMediaAccessStatus.mockReturnValue('granted')`.

Call: `permissionsManager.setForServer({url: new URL('http://anyurl.com')}, {media: {allowed: true}})`

Assert: `systemPreferences.askForMediaAccess` NOT called.

**PM-U07 — No media access check on Linux**

```js
const originalPlatform = process.platform;
Object.defineProperty(process, 'platform', {value: 'linux'});
permissionsManager.setForServer({url: new URL('http://anyurl.com')}, {media: {allowed: true}});
expect(systemPreferences.getMediaAccessStatus).not.toHaveBeenCalled();
expect(systemPreferences.askForMediaAccess).not.toHaveBeenCalled();
Object.defineProperty(process, 'platform', {value: originalPlatform});
```

Platform must be restored after the test (use `afterEach` or inline restore as shown).

---

## E2E Tests — `e2e/specs/permissions/permissions_ipc.test.js`

Unit tests call handler methods directly. These three tests prove the IPC channels are actually registered in the running app — if an `ipcMain.on`/`ipcMain.handle` registration line is removed, unit tests pass but the feature is dead.

### Test infrastructure

The outer `describe` must use a regular `function` (not an arrow function) so that `this` binds to the Mocha context. `before` and `after` hooks must also use regular functions.

```js
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
        if (this.app) await this.app.close();
    });
    // tests below
});
```

`SHOW_SETTINGS_WINDOW` is passed as a second argument to `app.evaluate` (serialised across the process boundary) rather than hardcoded as a string, following the pattern in existing E2E tests.

---

**E2E-P01 — GET_MEDIA_ACCESS_STATUS IPC returns a valid status (all platforms)**

```js
it('should return a valid media access status via IPC', async function() {
    const status = await this.settingsWindow.evaluate(
        () => window.desktop.getMediaAccessStatus('microphone'),
    );
    expect(['granted', 'denied', 'not-determined', 'restricted']).to.include(status);
});
```

Proves `ipcMain.handle(GET_MEDIA_ACCESS_STATUS, ...)` is registered and `systemPreferences.getMediaAccessStatus` is reachable end-to-end. Valid on all CI platforms — every OS returns one of the four strings.

---

**E2E-P02 — OPEN_WINDOWS_CAMERA_PREFERENCES IPC opens correct URL (Windows only)**

```js
env.shouldTest(it, process.platform === 'win32')(
    'should open ms-settings:privacy-webcam for camera preferences',
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

        const capturedURL = await this.app.evaluate(() => global.__testCapturedExternalURL);
        expect(capturedURL).to.equal('ms-settings:privacy-webcam');
    },
);
```

Note: `require('electron')` inside `app.evaluate` is required because the Playwright evaluate context object does not expose `shell` as a top-level destructurable property. The `app.evaluate` callback runs in the Electron main process where `require('electron')` is available.

---

**E2E-P03 — OPEN_WINDOWS_MICROPHONE_PREFERENCES IPC opens correct URL (Windows only)**

Same pattern as E2E-P02. Replace `openWindowsCameraPreferences()` with `openWindowsMicrophonePreferences()` and assert `ms-settings:privacy-microphone`.

---

## File Changes Summary

| File | Change |
|---|---|
| `src/main/security/permissionsManager.test.js` | Add `shell` to electron mock + import; add 7 tests (PM-U01–U07) |
| `e2e/specs/permissions/permissions_ipc.test.js` | New file; 3 tests (E2E-P01–P03) |

No source file changes required.

## What is intentionally not tested

- **`getForServer` / `handleGetMediaAccessStatus`** — trivial 1-line getters; no logic to protect
- **Full dialog user flow** — `NODE_ENV=test` hard-resolves dialogs to `false`; OS dialogs cannot be automated
- **Persisted-JSON E2E round-trip** — requires pre-populating `permissionsManager.json` and triggering a real browser permission request from a live server page; fragile and out of scope for this iteration
