# src/main/ — Main Process

Entry point: `src/main/app/index.ts` → `initialize()` in `src/main/app/initialize.ts`.

Node.js main process managing windows, IPC, OS integrations, and security. Has direct access to Electron APIs and the operating system.

## Key modules

### App initialization (`app/`)

- `initialize.ts` — Registers global IPC handlers in `initializeInterCommunicationEventListeners()`. Most `ipcMain.handle()` and `ipcMain.on()` calls live here.
- `intercom.ts` — Handler implementations for the IPC channels registered in `initialize.ts`.

### Downloads (`downloadsManager.ts`)

`DownloadsManager` manages download lifecycle: progress, completion, errors, save dialogs, and history. Handles Mac App Store security-scoped bookmarks for download folder access. App update downloads are tracked separately from file downloads.

### Auto-update (`updateNotifier.ts`)

Checks for updates by fetching from a remote manifest file (configurable via `buildConfig.updateNotificationURL`). Controlled by `Config.canUpgrade`, `Config.autoCheckForUpdates`, and the `EnableAutoUpdater` GPO/MDM policy.

### Performance monitoring (`performanceMonitor.ts`)

Collects CPU and memory metrics across all processes and views, sending them to server views periodically to be consumed by the server's Prometheus instance. Pauses on system suspend/lock.

### Other singletons

- **`AutoLauncher`** (`AutoLauncher.ts`): Auto-start on login via `auto-launch`.
- **`ThemeManager`**: Syncs the Desktop App themes with the server and OS native theme.
- **`I18nManager`**: Localization — loads language files from `i18n/`, provides `localizeMessage()`.
- **`DeveloperMode`**: Enabled in dev mode, nightly builds, or via `MM_DESKTOP_DEVELOPER_MODE`. Changes core behaviour of the app for debugging purposes.
- **`CriticalErrorHandler`** (`CriticalErrorHandler.ts`): Handles uncaught exceptions, integrates with Sentry.
- **`SentryHandler`** (`sentryHandler.ts`): Initializes Sentry SDK for error tracking in production. Adds app and platform context. Controlled by `Config.enableSentry`.
- **`SecureStorage`**: Encrypted per-server secret storage using Electron's `safeStorage` API.
- **`NonceManager`**: CSP nonces for internal `mattermost-desktop://` responses.
- **`AppVersionManager`** (`AppVersionManager.ts`): Persists last app version and skipped version for update tracking. Extends `JsonFileManager`.
- **`UserActivityMonitor`** (`UserActivityMonitor.ts`): Monitors system idle time via `powerMonitor.getSystemIdleTime()`. Emits `status` events for active/inactive transitions.
- **`ContextMenu`** (`contextMenu.ts`): Right-click context menu for web contents using `electron-context-menu`.
- **`ParseArgs`** (`ParseArgs.ts`): CLI argument parsing via `yargs`. Supports `--dataDir`, `--disableDevMode`, `--fullscreen`. Strips args after deep links.

### Utility functions (`utils.ts`)

Window bounds helpers (`getWindowBoundaries`, `getAdjustedWindowBoundaries`), preload path resolution (`getLocalPreload`), user agent composition, filename deduplication, macOS screenshare permission helpers, KDE detection, and light/dark color detection.

## Server info (`server/`)

- `serverInfo.ts` — Fetches server metadata (version, features) from a Mattermost server URL.
- `serverAPI.ts` — API client for server-side REST endpoints used by the desktop app.
