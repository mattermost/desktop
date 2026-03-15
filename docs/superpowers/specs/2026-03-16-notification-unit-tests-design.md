# Notification Unit Tests — Design Spec

**Date:** 2026-03-16
**Scope:** `src/main/notifications/`
**Approach:** Option A — pure gap-filling, no shared test utilities

---

## Context

`src/main/notifications/index.test.ts` already covers 13 `displayMention` scenarios, 1 `displayDownloadCompleted` scenario, and 3 Linux DND scenarios. `dnd-windows.test.js` covers all Windows Focus Assist cases. The classes `Mention`, `DownloadNotification`, `NewVersionNotification`, and `UpgradeNotification` have no class-level unit tests. `displayUpgrade` and `displayRestartToUpgrade` on `NotificationManager` have zero coverage.

---

## File Layout

```
src/main/notifications/
  index.test.ts          ← existing file — add NM-01…NM-11, DD-01…DD-05, UV-07…UV-13
  Mention.test.ts        ← NEW (construction logic only)
  Download.test.ts       ← NEW (construction logic only)
  Upgrade.test.ts        ← NEW (NewVersionNotification + UpgradeNotification construction only)
  dnd-windows.test.js    ← existing, untouched
```

Each new file mocks only what its class needs. Manager-level tests (`displayUpgrade`, `displayRestartToUpgrade`) stay in `index.test.ts` to avoid pulling in the full `NotificationManager` dependency graph into `Upgrade.test.ts`.

---

## Section 1 — `index.test.ts` additions

### Important mock quirk: `String(false)` is `'false'` (truthy)

In `Mention.ts`, `customSound` is computed as:
```ts
const customSound = String(!options.silent && ((options.soundName !== 'None' && options.soundName) || isWin7));
```
When `silent=true` or `soundName='None'`, this evaluates to `String(false)` = the string `'false'` — which is **truthy** in JavaScript. The `if (notificationSound)` guard in `index.ts` therefore evaluates `'false'` as truthy and **does** send `PLAY_SOUND` with the value `'false'`. Tests NM-03 and NM-04 assert this actual behaviour, not a "sound suppressed" outcome.

### New `displayMention` scenarios (added to existing `describe('displayMention')`)

| ID | Scenario | Assert |
|---|---|---|
| NM-01 | `WebContentsManager.getViewByWebContentsId` returns null | Returns `{status:'error', reason:'missing_view'}`, `mentions.length === 0` |
| NM-02 | `ServerManager.getServer` returns null | Returns `{status:'error', reason:'missing_server'}`, `mentions.length === 0` |
| NM-03 | `silent=true`, no soundName | `MainWindow.sendToRenderer` called with `(PLAY_SOUND, 'false')` — `String(false)` is truthy |
| NM-04 | `soundName='None'` | `MainWindow.sendToRenderer` called with `(PLAY_SOUND, 'false')` |
| NM-05 | Notification emits `failed` (generic error string) | Returns `{status:'error', reason:'electron_notification_failed'}` |
| NM-06 | Notification emits `failed` with string containing `'HRESULT:-2143420143'` | Returns `{status:'not_sent', reason:'windows_permissions_denied'}` |
| NM-07 | 10s timeout fires before `show` event | Returns `{status:'error', reason:'notification_timeout'}` — see fake timer notes below |
| NM-08 | `close` event fires after `show` | `allActiveNotifications` map no longer contains the mention's `uId` |
| NM-09 | Click sends `NOTIFICATION_CLICKED` IPC with correct `channelId`, `teamId`, `url` | `webcontents.send` called with `(NOTIFICATION_CLICKED, 'channel_id', 'team_id', url)` |
| NM-10 | Linux DND active → `displayMention` suppressed | See Linux DND setup note below; `mentions.length === 0` |
| NM-11 | Windows Priority Only + Mattermost NOT in priority list → suppressed | `getFocusAssist` returns `{value:1}`, `isPriority` returns `{value:0}`, `mentions.length === 0` |

**Implementation notes:**

**NM-05/NM-06:** The existing mock defines `show` as an **own instance property** (`show = jest.fn().mockImplementation(...)`), so `Notification.prototype.show` overrides have no effect. To prevent `show` from auto-resolving the promise, use the `blockShow` flag pattern — the same mechanism used for NM-07. Add a module-level `blockShow` flag inside the `jest.mock('electron', ...)` factory:

```js
// Inside jest.mock('electron', ...) factory:
let blockShow = false;
class NotificationMock {
    // ...
    show = jest.fn().mockImplementation(() => {
        if (!blockShow) this.callbackMap.get('show')?.();
    });
}
// Export blockShow so tests can control it:
// (access via the module-level variable in the test file)
```

Then NM-05 and NM-06 go in a nested describe:

```js
describe('notification failed events', () => {
    beforeEach(() => { blockShow = true; });
    afterEach(() => { blockShow = false; });

    it('NM-05 - generic failed error', async () => {
        const promise = NotificationManager.displayMention(...);
        mentions[0].value.callbackMap.get('failed')?.(null, 'some generic error');
        const result = await promise;
        expect(result).toEqual({status: 'error', reason: 'electron_notification_failed'});
    });

    it('NM-06 - HRESULT Windows error', async () => {
        const promise = NotificationManager.displayMention(...);
        mentions[0].value.callbackMap.get('failed')?.(null, 'Error: HRESULT:-2143420143');
        const result = await promise;
        expect(result).toEqual({status: 'not_sent', reason: 'windows_permissions_denied'});
    });
});
```

`blockShow` must be declared at the top of the `jest.mock` factory closure so it is accessible from both the mock class and the test file's `beforeEach`/`afterEach`.

**NM-07 (fake timers):**
- Wrap in a nested `describe` with `beforeEach(() => jest.useFakeTimers())` and `afterEach(() => jest.useRealTimers())`.
- Override `show` on the mock instance to NOT fire the `show` callback: after getting the mention from `mentions[0]`, replace `mention.value.show` with `jest.fn()` (no callback invocation). Since `displayMention` calls `mention.show()` at the end, capture the mention before `show` fires by accessing `mentions` after the sync portion but before show.
- Simpler: set the mock's `show` in this test to `jest.fn()` (not call any callback), then start the call, advance timers, await:
```js
// Before calling displayMention, configure show to be a no-op
// The mention is pushed to `mentions` during construction (before show() is called)
const showSpy = jest.fn(); // will replace show on the instance
// ... call displayMention (don't await yet)
const promise = NotificationManager.displayMention(...);
// Replace show on the constructed instance before it fires
mentions[0].value.show = showSpy;
// But show() was already called in displayMention...
```
The `Mention` is constructed and `.show()` called synchronously at the end of `displayMention`'s sync body. So by the time `displayMention` is called (not awaited), `show()` has already been invoked. The solution: **override the mock's `show` at the `jest.mock` level** to not fire callbacks for the duration of this test, or use a flag:

```js
let blockShow = false;
// In the mock:
show = jest.fn().mockImplementation(() => {
    if (!blockShow) this.callbackMap.get('show')?.();
});
// In NM-07:
blockShow = true;
const promise = NotificationManager.displayMention(...);
await jest.runAllTimersAsync(); // advances 10s timeout
const result = await promise;
expect(result).toEqual({status: 'error', reason: 'notification_timeout'});
blockShow = false;
```
Add `blockShow` as a module-level variable in the `jest.mock('electron', ...)` factory. After `jest.advanceTimersByTime(10001)`, use `await Promise.resolve()` to drain the microtask queue before asserting. Or use `jest.runAllTimersAsync()` which handles both.

**NM-08:** To simulate the OS closing the notification (not the programmatic `close()` call), fire the event via the callbackMap directly:
```js
mention.value.callbackMap.get('close')?.();
```
Do NOT call `mention.value.close()` — that is a spy for programmatic close calls and does not fire the event listener.

**NM-09:** Pass `{id: 1, send: jest.fn()}` as `webcontents`. After click, assert:
```js
expect(webcontents.send).toHaveBeenCalledWith(NOTIFICATION_CLICKED, 'channel_id', 'team_id', url);
```

**NM-10 (Linux DND):** Set `process.platform = 'linux'` AND `cp.execSync.mockReturnValue(Buffer.from('false'))`. Without the execSync mock returning `'false'`, `getLinuxDoNotDisturb` returns `false` (DND off) and the notification is sent.

**NM-11:** The existing `jest.mock('windows-focus-assist', ...)` factory in `index.test.ts` only exposes `getFocusAssist`. Before writing NM-11, add `isPriority: jest.fn()` to that mock factory, and add a corresponding import at the top of the file:
```ts
import {isPriority as notMockedIsPriority} from 'windows-focus-assist';
const isPriority = jest.mocked(notMockedIsPriority);
```
Then in the test: set `process.platform = 'win32'`, `getFocusAssist.mockReturnValue({value: 1, name: ''})`, `isPriority.mockReturnValue({value: 0})`. Restore platform in `afterEach`.

### New `displayDownloadCompleted` scenarios

These go inside the existing `describe('displayDownloadCompleted')` block. Add a `mainWindow` mock and `MainWindow.get.mockReturnValue(mainWindow)` to this block's own `beforeEach` (it is NOT shared with `displayMention`'s `mainWindow`):

```ts
const dlMainWindow = {flashFrame: jest.fn()} as unknown as BrowserWindow;
beforeEach(() => {
    MainWindow.get.mockReturnValue(dlMainWindow);
    // ... other setup
});
```

| ID | Scenario | Assert |
|---|---|---|
| DD-01 | DND active (Darwin) → no notification | Set `process.platform='darwin'`; `getDarwinDoNotDisturb` returns `true`; `Notification.didConstruct` not called |
| DD-02 | `Notification.isSupported` returns false → returns early | `Notification.didConstruct` not called |
| DD-03 | `show` event fires + `Config.notifications.flashWindow = 1` on Linux | `dlMainWindow.flashFrame` called with `true` |
| DD-04 | `close` event fires | `allActiveNotifications` map no longer contains download's `uId` |
| DD-05 | `failed` event fires | `allActiveNotifications` map no longer contains download's `uId` |

**DD-03:** Set `process.platform = 'linux'` and `Config.notifications = {flashWindow: 1, ...}`. The Notification mock fires `show` synchronously so `flashFrame` is called by the time `displayDownloadCompleted` returns.

**DD-04/DD-05:** Fire events via callbackMap directly (same pattern as NM-08):
```js
download.value.callbackMap.get('close')?.();
// or
download.value.callbackMap.get('failed')?.();
```
Access `(NotificationManager as any).allActiveNotifications` to inspect state.

### New `displayUpgrade` scenarios (new `describe('displayUpgrade')` in `index.test.ts`)

| ID | Scenario | Assert |
|---|---|---|
| UV-07 | `Notification.isSupported` false → returns early | `Notification.didConstruct` not called |
| UV-08 | DND active → returns early | `Notification.didConstruct` not called |
| UV-09 | Click triggers `handleUpgrade` callback | `handleUpgrade` mock called exactly once |
| UV-10 | Second `displayUpgrade` call closes previous notification | First notification's `close()` called before second is shown |

### New `displayRestartToUpgrade` scenarios (new `describe('displayRestartToUpgrade')` in `index.test.ts`)

| ID | Scenario | Assert |
|---|---|---|
| UV-11 | `isSupported` false → returns early | `Notification.didConstruct` not called |
| UV-12 | DND active → returns early | `Notification.didConstruct` not called |
| UV-13 | Click triggers `handleUpgrade` callback | `handleUpgrade` mock called exactly once |

**UV-07–UV-13 notes:** Pass `jest.fn()` as `handleUpgrade`. For UV-09/UV-13, trigger click via `mention.value.callbackMap.get('click')?.()`. For UV-10, call `displayUpgrade` twice (awaiting each), then verify `mentions[0].value.close` was called.

---

## Section 2 — `Mention.test.ts` (new file)

**Mocks required:** `electron` (Notification constructor spy), `uuid`, `os`, `main/i18nManager`, `common/utils/util`, `electron-is-dev`

**Key quirk:** `customSound = String(!silent && (soundName !== 'None' && soundName) || isWin7))`. When the expression inside `String()` is `false`, `customSound` = `'false'` (a truthy string). Tests must assert the actual string value, not boolean truthiness.

| ID | Scenario | Assert |
|---|---|---|
| MN-01 | `silent=false` + valid `soundName='Bing'` | `getNotificationSound()` returns `'Bing'` |
| MN-02 | `silent=true` + `soundName='Bing'` | `getNotificationSound()` returns `'false'` (the string) |
| MN-03 | `silent=false` + `soundName='None'` | `getNotificationSound()` returns `'false'` (the string) |
| MN-04 | `soundName='Bing'` (custom sound present) → Notification constructed with `silent: true` | Spy on Notification constructor options |
| MN-05 | macOS → `icon` not passed to Notification | `process.platform='darwin'`, constructor options lack `icon` |
| MN-06 | Windows 10+ (`os.release()` = `'10.0.19041'`, `isVersionGreaterThanOrEqualTo` returns `true`) → `icon` stripped | Constructor options lack `icon` |
| MN-07 | Windows 7 (`os.release()` = `'6.1.7601'`, `isVersionGreaterThanOrEqualTo` returns `false` for `'6.3'`), `silent=false`, no soundName | `getNotificationSound()` returns `'Ding'` |
| MN-08 | Two `Mention` instances → distinct `uId` values | `mention1.uId !== mention2.uId` |
| MN-09 | `channelId` and `teamId` stored on instance | `mention.channelId === 'ch-1'`, `mention.teamId === 'tm-1'` |

**MN-07 note:** Must explicitly pass `silent: false` in options. `isWin7` resolves to `'Ding'` only when platform is `win32`, version is below `6.3`, and `DEFAULT_WIN7 = 'Ding'` is set. `customSound = String(!false && (false || 'Ding'))` = `'Ding'`.

**Mock setup for `common/utils/util`:**
```ts
jest.mock('common/utils/util', () => ({
    default: {isVersionGreaterThanOrEqualTo: jest.fn()},
}));
```
Per test, set `Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(true/false)`.

---

## Section 3 — `Download.test.ts` (new file)

**Mocks required:** `electron` (Notification constructor spy), `os`, `main/i18nManager`, `common/utils/util`, `electron-is-dev`

| ID | Scenario | Assert |
|---|---|---|
| DL-01 | Linux → title is localized "Download Complete" | `localizeMessage` called with `'main.notifications.download.complete.title'` |
| DL-02 | Linux → body is raw `fileName` | Notification constructed with `body: 'test-file.zip'` |
| DL-03 | Windows → title is `serverName` | Notification constructed with `title: 'My Server'` |
| DL-04 | Windows → body contains localized string with `fileName` interpolated | `localizeMessage` called with `'main.notifications.download.complete.body'` and `{fileName: 'test-file.zip'}` |
| DL-05 | macOS → `icon` stripped | Constructor options lack `icon` |
| DL-06 | Windows 10+ (`isVersionGreaterThanOrEqualTo` returns `true`) → `icon` stripped | No `icon` in constructor options |
| DL-07 | Linux → `icon` preserved | Constructor options contain `icon` |
| DL-08 | Two instances → distinct `uId` values | `dl1.uId !== dl2.uId` |

**Capturing constructor options:** Use a module-level `capturedOptions` array and override Notification in the mock:
```ts
const capturedOptions: any[] = [];
jest.mock('electron', () => ({
    app: {getAppPath: () => '/path/to/app'},
    Notification: jest.fn().mockImplementation((opts) => { capturedOptions.push(opts); }),
}));
```

---

## Section 4 — `Upgrade.test.ts` (new file)

**Scope:** Construction-only tests for `NewVersionNotification` and `UpgradeNotification`. Manager-level scenarios (UV-07–UV-13) live in `index.test.ts` (see Section 1).

**Mocks required:** `electron` (Notification constructor spy), `main/i18nManager`, `electron-is-dev`

| ID | Scenario | Assert |
|---|---|---|
| **NewVersionNotification** | | |
| UV-01 | macOS → `icon` stripped | `process.platform='darwin'`, constructor options lack `icon` |
| UV-02 | Windows → `icon` set to `appIconURL` | Constructor options contain `icon` matching resolved assets path |
| UV-03 | Linux → default `icon` preserved | Constructor options contain `icon` |
| **UpgradeNotification** | | |
| UV-04 | Title/body use "ready to install" localization keys | `localizeMessage` called with `'main.notifications.upgrade.readyToInstall.title'` and `'main.notifications.upgrade.readyToInstall.body'` |
| UV-05 | macOS → `icon` stripped | Constructor options lack `icon` |
| UV-06 | Windows → `icon` set to `appIconURL` | Constructor options contain `icon` |

**Note:** `Upgrade.ts` imports `app.getAppPath()` at module load time to compute `appIconURL`. The electron mock must expose `app.getAppPath: () => '/path/to/app'`.

---

## Coverage summary

| File | New tests | Areas addressed |
|---|---|---|
| `index.test.ts` | +18 (NM-01…11, DD-01…05, UV-07…13) | missing view/server, timeout, failed/HRESULT, sound string semantics, Linux DND path, Windows Priority Only, download DND/isSupported/show/close/failed, displayUpgrade/displayRestartToUpgrade |
| `Mention.test.ts` | +9 (MN-01…09) | All Mention class construction and sound selection logic |
| `Download.test.ts` | +8 (DL-01…08) | All DownloadNotification construction and platform formatting |
| `Upgrade.test.ts` | +6 (UV-01…06) | NewVersionNotification + UpgradeNotification construction |
| **Total** | **41 new tests** | |

---

## Constraints

- All tests use Jest (co-located `*.test.ts` pattern per project conventions)
- File headers: `// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.` + license line
- No `require()` — ES module `import`/`export` only
- No new shared utilities — each file owns its mock setup
- `process.platform` overrides restored in `afterEach`/`afterAll` per existing pattern
- `jest.useFakeTimers()` / `jest.useRealTimers()` scoped to nested describe block for NM-07
