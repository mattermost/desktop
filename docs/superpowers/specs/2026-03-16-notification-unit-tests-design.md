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
  index.test.ts          ← existing file — add NM-01…NM-10, DD-01…DD-05
  Mention.test.ts        ← NEW
  Download.test.ts       ← NEW
  Upgrade.test.ts        ← NEW
  dnd-windows.test.js    ← existing, untouched
```

Each new file mocks only what its class needs. No shared test utilities introduced.

---

## Section 1 — `index.test.ts` additions

### New `displayMention` scenarios (added to existing `describe('displayMention')`)

| ID | Scenario | Assert |
|---|---|---|
| NM-01 | `WebContentsManager.getViewByWebContentsId` returns null | Returns `{status:'error', reason:'missing_view'}`, `mentions.length === 0` |
| NM-02 | `ServerManager.getServer` returns null | Returns `{status:'error', reason:'missing_server'}`, `mentions.length === 0` |
| NM-03 | `silent=true`, no soundName | `MainWindow.sendToRenderer` not called with `PLAY_SOUND` |
| NM-04 | `soundName='None'` | `MainWindow.sendToRenderer` not called with `PLAY_SOUND` |
| NM-05 | Notification emits `failed` (generic error string) | Returns `{status:'error', reason:'electron_notification_failed'}` |
| NM-06 | Notification emits `failed` with string containing `'HRESULT:-2143420143'` | Returns `{status:'not_sent', reason:'windows_permissions_denied'}` |
| NM-07 | 10s timeout fires before `show` event | Returns `{status:'error', reason:'notification_timeout'}` — uses `jest.useFakeTimers()` |
| NM-08 | `close` event fires after `show` | `allActiveNotifications` map no longer contains the mention's `uId` |
| NM-09 | Click sends `NOTIFICATION_CLICKED` IPC with correct `channelId`, `teamId`, `url` | `webcontents.send` called with `(NOTIFICATION_CLICKED, 'channel_id', 'team_id', url)` |
| NM-10 | Linux DND active (`execSync` returns `'false'`) → `displayMention` suppressed | `process.platform` mocked to `'linux'`, `mentions.length === 0` |

**Implementation notes:**
- NM-07 requires `jest.useFakeTimers()` in a nested `describe` block with `afterEach(() => jest.useRealTimers())`. The Notification mock's `show` must NOT fire the `show` callback so the timeout can advance with `jest.advanceTimersByTime(10001)`.
- NM-08: access `(NotificationManager as any).allActiveNotifications` to inspect map state after triggering `close`.
- NM-09: pass `{id: 1, send: jest.fn()}` as `webcontents`; assert `webcontents.send.mock.calls[0]`.

### New `displayDownloadCompleted` scenarios (added to existing `describe('displayDownloadCompleted')`)

| ID | Scenario | Assert |
|---|---|---|
| DD-01 | DND active (Darwin) → no notification | `getDarwinDoNotDisturb` returns `true`, `Notification.didConstruct` not called |
| DD-02 | `Notification.isSupported` returns false → returns early | `Notification.didConstruct` not called |
| DD-03 | `show` event fires + `Config.notifications.flashWindow = 1` on Linux | `mainWindow.flashFrame` called with `true` |
| DD-04 | `close` event fires | `allActiveNotifications` map no longer contains download's `uId` |
| DD-05 | `failed` event fires | `allActiveNotifications` map no longer contains download's `uId` |

**Implementation notes:**
- DD-03: set `process.platform = 'linux'` and `Config.notifications.flashWindow = 1`; the existing `mainWindow` mock is available from the outer `describe`.
- DD-04/DD-05: the Notification mock needs `close` and `failed` callbacks wired. Add `close` and `failed` trigger methods to the mock similar to how `click` is already handled.

---

## Section 2 — `Mention.test.ts` (new file)

**Mocks required:** `electron` (Notification constructor spy), `uuid`, `os`, `main/i18nManager`, `common/utils/util`

| ID | Scenario | Assert |
|---|---|---|
| MN-01 | `silent=false` + valid `soundName` | `getNotificationSound()` returns the soundName |
| MN-02 | `silent=true` + valid `soundName` | `getNotificationSound()` returns falsy |
| MN-03 | `soundName='None'` | `getNotificationSound()` returns falsy |
| MN-04 | Custom sound present → Notification constructed with `silent: true` | Spy on Notification constructor options |
| MN-05 | macOS → `icon` not passed to Notification | `process.platform='darwin'`, constructor options lack `icon` |
| MN-06 | Windows 10+ (`os.release()` = `'10.0.19041'`) → `icon` stripped | Constructor options lack `icon` |
| MN-07 | Windows 7 (`os.release()` = `'6.1.7601'`) + no soundName → falls back to `'Ding'` | `getNotificationSound()` returns `'Ding'` |
| MN-08 | Two `Mention` instances → distinct `uId` values | `mention1.uId !== mention2.uId` |
| MN-09 | `channelId` and `teamId` stored on instance | `mention.channelId === 'ch-1'`, `mention.teamId === 'tm-1'` |

**Implementation notes:**
- Capture constructor options by spying on `Notification` with `jest.spyOn` or by capturing args in the mock.
- `Utils.isVersionGreaterThanOrEqualTo` must be mockable — mock `common/utils/util` returning `true` or `false` per test.

---

## Section 3 — `Download.test.ts` (new file)

**Mocks required:** `electron` (Notification constructor spy), `os`, `main/i18nManager`, `common/utils/util`

| ID | Scenario | Assert |
|---|---|---|
| DL-01 | Linux → title is localized "Download Complete" | `localizeMessage` called with `'main.notifications.download.complete.title'` |
| DL-02 | Linux → body is raw `fileName` | Notification constructed with `body: fileName` |
| DL-03 | Windows → title is `serverName` | Notification constructed with `title: serverName` |
| DL-04 | Windows → body contains localized string with `fileName` interpolated | `localizeMessage` called with body key and `{fileName}` |
| DL-05 | macOS → `icon` stripped | Constructor options lack `icon` |
| DL-06 | Windows 10+ → `icon` stripped | `os.release()` = `'10.0.19041'`, no `icon` |
| DL-07 | Linux → `icon` preserved | Constructor options contain `icon` |
| DL-08 | Two instances → distinct `uId` values | `dl1.uId !== dl2.uId` |

---

## Section 4 — `Upgrade.test.ts` (new file)

**Mocks required:** `electron` (Notification constructor + `isSupported` + `didConstruct`), `main/i18nManager`, `macos-notification-state`, `windows-focus-assist`, `electron-is-dev`

### `NewVersionNotification` construction

| ID | Scenario | Assert |
|---|---|---|
| UV-01 | macOS → `icon` stripped | Constructor options lack `icon` |
| UV-02 | Windows → `icon` set to `appIconURL` | Constructor options contain `icon` |
| UV-03 | Linux → default `icon` preserved | Constructor options contain `icon` |

### `UpgradeNotification` construction

| ID | Scenario | Assert |
|---|---|---|
| UV-04 | Title/body use "ready to install" localization keys | `localizeMessage` called with `'main.notifications.upgrade.readyToInstall.title'` and `'...body'` keys |
| UV-05 | macOS → `icon` stripped | Constructor options lack `icon` |
| UV-06 | Windows → `icon` set to `appIconURL` | Constructor options contain `icon` |

### `displayUpgrade` (via `NotificationManager`)

| ID | Scenario | Assert |
|---|---|---|
| UV-07 | `Notification.isSupported` false → returns early | `didConstruct` not called |
| UV-08 | DND active → returns early | `didConstruct` not called |
| UV-09 | Click triggers `handleUpgrade` callback | Callback mock called exactly once |
| UV-10 | Second `displayUpgrade` call closes previous notification | First notification's `close` called before second is shown |

### `displayRestartToUpgrade` (via `NotificationManager`)

| ID | Scenario | Assert |
|---|---|---|
| UV-11 | `isSupported` false → returns early | `didConstruct` not called |
| UV-12 | DND active → returns early | `didConstruct` not called |
| UV-13 | Click triggers `handleUpgrade` callback | Callback mock called exactly once |

**Implementation notes:**
- Import `NotificationManager` from `./index` (the singleton) for manager-level tests.
- The same Notification mock pattern from `index.test.ts` applies — `callbackMap`, `show`, `click`, `close` methods.
- `handleUpgrade` passed as `jest.fn()` to `displayUpgrade`/`displayRestartToUpgrade`.

---

## Coverage summary

| File | Tests added | Previously uncovered areas addressed |
|---|---|---|
| `index.test.ts` | +15 (NM-01…10, DD-01…05) | missing view/server, timeout, failed/HRESULT, silent suppression, close cleanup, click IPC payload, Linux DND path, download DND/isSupported/show/close/failed |
| `Mention.test.ts` | +9 (MN-01…09) | All Mention class construction logic |
| `Download.test.ts` | +8 (DL-01…08) | All DownloadNotification construction logic |
| `Upgrade.test.ts` | +13 (UV-01…13) | All upgrade notification construction + displayUpgrade/displayRestartToUpgrade |
| **Total** | **45 new tests** | |

---

## Constraints

- All tests use Jest (co-located `*.test.ts` pattern per project conventions)
- File headers: `// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.` + license line
- No `require()` — ES module `import`/`export` only
- No new shared utilities — each file owns its mock setup
- `process.platform` overrides restored in `afterEach`/`afterAll` per existing pattern
