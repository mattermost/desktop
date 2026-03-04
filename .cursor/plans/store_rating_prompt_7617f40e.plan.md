---
name: Store rating prompt
overview: Add a configurable rating prompt for Mac App Store and Microsoft Store users, delivered as both an OS notification and a downloads dropdown item on cold start when all conditions are met (logged in, supported server versions, time gates).
todos:
  - id: store-detection
    content: Add __IS_WINDOWS_STORE__ compile-time flag to webpack DefinePlugin, Jest globals, and TypeScript globals
    status: pending
  - id: types-config
    content: Add minimumServerVersionForRating to BuildConfig type, buildConfig defaults, AppState type, Validator, and AppVersionManager
    status: pending
  - id: ipc-channels
    content: Add SHOW_RATING_PROMPT, DISMISS_RATING_PROMPT, OPEN_STORE_RATING to communication.ts; add APP_RATING_KEY/RATING_DOWNLOAD_ITEM constants; add RATING to DownloadItemTypeEnum
    status: pending
  - id: rating-notification
    content: Create src/main/notifications/Rating.ts notification class and add displayRating() to NotificationManager
    status: pending
  - id: rating-manager
    content: Create src/main/notifications/ratingManager.ts singleton with condition evaluation, time gates, store build detection, and IPC handlers
    status: pending
  - id: downloads-integration
    content: Update DownloadsManager to listen for SHOW_RATING_PROMPT and manage rating items in the dropdown
    status: pending
  - id: preload-types
    content: Expose openStoreRating and dismissRatingPrompt in internalAPI.js and window.ts types
    status: pending
  - id: rating-prompt-ui
    content: Create RatingPrompt component and styles in DownloadsDropdown; update DownloadsDropdownItem and downloadsDropdown.tsx sorting/clear logic
    status: pending
  - id: initialization
    content: Wire up ratingManager.init() in initialize.ts, passing deep link launch flag
    status: pending
  - id: localization
    content: Add English strings to i18n/en.json
    status: pending
  - id: tests
    content: Write unit tests for RatingManager covering all conditions, time gates, and edge cases
    status: pending
isProject: false
---

# Store Rating Prompt

## Store Build Detection

We use **compile-time flags** (`__IS_MAC_APP_STORE__` and a new `__IS_WINDOWS_STORE__`) rather than Electron's runtime properties (`process.mas` / `process.windowsStore`) to detect store builds. The reasoning:

- **Windows Store builds use the same MSI** that ships on GitHub. The release team uploads it to the Microsoft Store manually. Because it's an MSI (not an APPX/MSIX), Electron's `process.windowsStore` is `false` at runtime. A compile-time flag gives us reliable detection regardless of how Microsoft packages or distributes the installer.
- **Consistent with existing pattern.** `__IS_MAC_APP_STORE__` already exists and is set via the `IS_MAC_APP_STORE` env var in the MAS build pipeline. Adding `__IS_WINDOWS_STORE__` via `IS_WINDOWS_STORE` follows the same mechanism.
- **Easy to migrate later.** The rating manager calls a single `isStoreBuild()` helper. If the team later adopts native APPX packaging (making `process.windowsStore` available), the implementation can switch without changing any callers.

### Changes for `__IS_WINDOWS_STORE__`

- `[webpack.config.base.js](webpack.config.base.js)` — Add `__IS_WINDOWS_STORE__: JSON.stringify(process.env.IS_WINDOWS_STORE === 'true')` to `codeDefinitions`
- `[package.json](package.json)` — Add `__IS_WINDOWS_STORE__: false` to Jest `globals`
- TypeScript global declaration (wherever `__IS_MAC_APP_STORE__` is declared, or add alongside `@ts-ignore` usages)

The release team then sets `IS_WINDOWS_STORE=true` in the Windows Store build pipeline.

## Architecture

The feature follows the same dual-notification pattern as auto-updates: an OS-level notification (via `NotificationManager`) plus an in-app item in the downloads dropdown. A new `RatingManager` singleton under `src/main/notifications/` evaluates conditions on cold start and triggers both.

```mermaid
sequenceDiagram
    participant Init as initializeAfterAppReady
    participant RM as RatingManager
    participant SM as ServerManager
    participant NM as NotificationManager
    participant DM as DownloadsManager
    participant DD as DownloadsDropdown

    Init->>RM: init(launchedFromDeepLink)
    Note over RM: Check: is store build?<br/>Record firstRatingCheckDate if new
    SM-->>RM: SERVER_LOGGED_IN_CHANGED (loggedIn: true)
    Note over RM: Wait ~15s for all servers to load
    RM->>RM: evaluateConditions()
    Note over RM: 1. Store build<br/>2. >= 1 server logged in<br/>3. Not launched from deep link<br/>4. All servers have supported version<br/>5. Time gate passed (14d first / 90d repeat)
    RM->>NM: displayRating() (OS notification)
    RM->>DM: ipcMain.emit(SHOW_RATING_PROMPT)
    DM->>DD: Add rating item, open dropdown
    DD->>DD: Render RatingPrompt component
    DD-->>RM: User clicks Rate / Dismiss
    RM->>RM: Record lastRatingPromptDate
```



This mirrors how `updateNotifier.ts` calls both `NotificationManager.displayUpgrade()` (OS notification) and emits `UPDATE_AVAILABLE` (downloads dropdown item). The rating prompt uses the same two channels.

## Condition Details

- **Store build**: `__IS_MAC_APP_STORE__` or `__IS_WINDOWS_STORE__` (compile-time flags set in store build pipelines). Also reject `electronIsDev`.
- **Logged in**: `ServerManager.getAllServers().some(s => s.isLoggedIn)`.
- **Not deep link launch**: Track whether `getDeeplinkingURL()` found a URL during this cold start via a flag passed to `RatingManager.init()`.
- **Supported server versions**: All servers with remote info must have `serverVersion >= buildConfig.minimumServerVersionForRating`. Servers without version info are treated as unsupported.
- **Time gates**: First-ever prompt requires 14 days since `firstRatingCheckDate`. Subsequent prompts require 90 days since `lastRatingPromptDate`. Both "Rate" and "Dismiss" actions record the date (resetting the 90-day timer).

## Store Links

Reuse existing `buildConfig` URLs:

- macOS: `buildConfig.macAppStoreUpdateURL` (`macappstore://apps.apple.com/...`)
- Windows: `buildConfig.windowsStoreUpdateURL` (`ms-windows-store://pdp/...`)

## Files to Create

### `src/main/notifications/Rating.ts`

New OS notification class following the same pattern as `[src/main/notifications/Upgrade.ts](src/main/notifications/Upgrade.ts)`:

- `RatingNotification extends Notification` with title "Enjoying Mattermost?" and body "Tap to rate us in the store"
- Platform-specific icon handling (same as `NewVersionNotification`)
- Clicking the notification opens the appropriate store link

### `src/main/notifications/ratingManager.ts`

New singleton module under `src/main/notifications/`. Handles all rating prompt logic:

- `init(launchedFromDeepLink: boolean)` called from `initializeAfterAppReady`
- `isStoreBuild()` checks `__IS_MAC_APP_STORE__` or `__IS_WINDOWS_STORE__`, rejects `electronIsDev`
- Listens for `SERVER_LOGGED_IN_CHANGED`, debounces 15 seconds, then evaluates all conditions
- Records `firstRatingCheckDate` on first run via `AppVersionManager`
- Calls `NotificationManager.displayRating()` to show OS notification
- Emits `SHOW_RATING_PROMPT` to trigger the downloads dropdown item
- Registers IPC handlers: `DISMISS_RATING_PROMPT` (records date, removes item), `OPEN_STORE_RATING` (opens store link, records date, removes item)

### `src/renderer/components/DownloadsDropdown/RatingPrompt/RatingPrompt.tsx`

New React component rendered in the downloads dropdown. Similar layout to `[src/renderer/components/DownloadsDropdown/Update/UpdateAvailable.tsx](src/renderer/components/DownloadsDropdown/Update/UpdateAvailable.tsx)`:

- Title: "Enjoying Mattermost?"
- Description: "Rate us on the [Mac App Store / Microsoft Store]"
- Primary button: "Rate in Store" (calls `window.desktop.openStoreRating()`)
- Secondary link: "Not now" (calls `window.desktop.dismissRatingPrompt()`)

### `src/renderer/components/DownloadsDropdown/RatingPrompt/RatingPrompt.scss`

Styles matching the existing `DownloadsDropdown__Update` pattern.

## Files to Modify

### Types and Config

- `[src/types/config.ts](src/types/config.ts)` — Add `minimumServerVersionForRating?: string` to `BuildConfig`
- `[src/common/config/buildConfig.ts](src/common/config/buildConfig.ts)` — Set default `minimumServerVersionForRating` (e.g., `'10.11.0'` for current ESR)
- `[src/types/appState.ts](src/types/appState.ts)` — Add `lastRatingPromptDate?: string` and `firstRatingCheckDate?: string`
- `[src/common/Validator.ts](src/common/Validator.ts)` — Add `lastRatingPromptDate: Joi.string()` and `firstRatingCheckDate: Joi.string()` to `appStateSchema`
- `[src/main/AppVersionManager.ts](src/main/AppVersionManager.ts)` — Add getter/setter pairs for both new date fields (same pattern as `updateCheckedDate`)

### Build System

- `[webpack.config.base.js](webpack.config.base.js)` — Add `__IS_WINDOWS_STORE__` to `codeDefinitions`
- `[package.json](package.json)` — Add `__IS_WINDOWS_STORE__` to Jest `globals`

### Notifications

- `[src/main/notifications/index.ts](src/main/notifications/index.ts)` — Import `RatingNotification` from `Rating.ts`, add `displayRating(handleRate: () => void)` method to `NotificationManager` (same pattern as `displayUpgrade`)

### IPC and Preload

- `[src/common/communication.ts](src/common/communication.ts)` — Add `SHOW_RATING_PROMPT`, `DISMISS_RATING_PROMPT`, `OPEN_STORE_RATING`
- `[src/app/preload/internalAPI.js](src/app/preload/internalAPI.js)` — Expose `openStoreRating` and `dismissRatingPrompt` via `window.desktop`
- `[src/types/window.ts](src/types/window.ts)` — Add `openStoreRating()` and `dismissRatingPrompt()` to the desktop API type

### Downloads Integration

- `[src/types/downloads.ts](src/types/downloads.ts)` — Add `RATING = 'rating'` to `DownloadItemTypeEnum`
- `[src/common/constants.ts](src/common/constants.ts)` — Add `APP_RATING_KEY` and `RATING_DOWNLOAD_ITEM` constants (same pattern as `APP_UPDATE_KEY` / `UPDATE_DOWNLOAD_ITEM`)
- `[src/main/downloadsManager.ts](src/main/downloadsManager.ts)` — Listen for `SHOW_RATING_PROMPT`, add rating item to downloads, open dropdown. Listen for `DISMISS_RATING_PROMPT`/`OPEN_STORE_RATING` to remove the item.

### Dropdown UI

- `[src/renderer/components/DownloadsDropdown/DownloadsDropdownItem.tsx](src/renderer/components/DownloadsDropdown/DownloadsDropdownItem.tsx)` — Add case for `type === 'rating'` rendering `RatingPrompt`
- `[src/renderer/downloadsDropdown.tsx](src/renderer/downloadsDropdown.tsx)` — Update sort logic (rating items after update items, before files). Update `clearAllButtonDisabled` to also exclude rating items.

### Initialization

- `[src/main/app/initialize.ts](src/main/app/initialize.ts)` — Import `ratingManager`, call `ratingManager.init(!!deeplinkingURL)` after the deep link check runs. Move the `deeplinkingURL` detection slightly earlier or pass the result.

### Localization

- `[i18n/en.json](i18n/en.json)` — Add message strings for the rating prompt UI and OS notification

### Tests

- `src/main/notifications/ratingManager.test.js` — Unit tests covering each condition, time gate logic, and store build detection

