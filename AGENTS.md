# AGENTS.md — Mattermost Desktop App

## Project overview

Electron application wrapping the Mattermost Web App for a native desktop experience, enabling some additional features for end-users and admins. Supports multiple simultaneous Mattermost server connections, each in its own isolated process.

Repository: https://github.com/mattermost/desktop

## Architecture

### Electron process model

- **Main process**: Node.js process with access to Electron APIs and the OS. Composed of three source directories:
  - `src/main/` — Electron integrations: OS-level functionality (notifications, auto-launch, downloads), security, and app lifecycle. Entry point: `src/main/app/index.ts` → `initialize()`.
  - `src/app/` — High-level app modules: windows, tabs, modals, menus, and Calls integration.
  - `src/common/` — Shared modules: configuration, server/view management, logging, IPC constants, utilities.
- **Renderer processes** (`src/renderer/`): Chromium instances for the app's internal UI (top bar, settings, modals). React-based.
- **External views**: Each Mattermost server runs in its own `WebContentsView`, loading the web app directly from that server.
- **Preload scripts** (`src/app/preload/`): Bridge between main and renderer via `contextBridge`:
  - `internalAPI.js` → `window.desktop` (full API for trusted internal views)
  - `externalAPI.ts` → `window.desktopAPI` (restricted API for external server views)

### Directory structure

```
api-types/          # @mattermost/desktop-api types package (DesktopAPI interface)
i18n/               # Localization language files
src/
├── main/           # Electron integrations: OS-level functionality, app lifecycle
│   ├── app/        # App initialization and some config handlers
│   ├── notifications/
│   ├── diagnostics/
│   ├── security/   # Certificate store, permissions, pre-auth
│   └── server/     # Server info fetching, server API
├── app/            # High-level app modules: windows, tabs, modals, menus
│   ├── mainWindow/ # Main BrowserWindow, modals, dropdowns
│   ├── views/      # MattermostWebContentsView, loading screen, web content events
│   ├── windows/    # BaseWindow, popout manager
│   ├── menus/      # App menu, tray menu
│   ├── tabs/       # Tab management
│   ├── preload/    # Preload scripts (internalAPI, externalAPI)
│   └── system/     # Badge, tray
├── renderer/       # React UI for internal views
│   ├── components/ # MainPage, settings, modals, dropdowns
│   ├── modals/     # Modal components
│   ├── hooks/      # React hooks (useConfig, useAnimationEnd, useTransitionEnd)
│   └── css/        # SCSS styles
├── common/         # Generic shared main process modules (no Electron-specific imports)
│   ├── config/     # Config reading/writing, defaults, upgrades, Windows GPO, macOS MDM
│   ├── servers/    # ServerManager singleton
│   ├── views/      # ViewManager, MattermostView
│   └── utils/      # URL utilities, constants, validators
├── jest/           # Jest test setup files
├── assets/         # Icons, images
└── types/          # Shared TypeScript type definitions
```

Module-specific documentation lives in `AGENTS.md` files within each subdirectory.

## Development

### Common commands

| Command | Description |
|---|---|
| `npm run watch` | Dev mode with auto-rebuild and restart |
| `npm run build` | Development build (main + preload + renderer in parallel) |
| `npm run build-prod` | Production build |
| `npm start` | Run the built app |
| `npm run restart` | Build then start |
| `npm run check` | Run lint + type check + unit tests in parallel |
| `npm run lint:js` | ESLint |
| `npm run fix:js` | ESLint with auto-fix |
| `npm run check-types` | TypeScript type checking (no emit) |
| `npm run test:unit` | Jest unit tests |
| `npm run e2e` | Build test bundle and run E2E tests (Playwright, in `e2e/`) |

### Path aliases

Configured in webpack and `tsconfig.json` (`baseUrl: ./src`): `renderer`, `main`, `app`, `common`, `assets`.

Use in imports: `import Config from 'common/config';`. Never use `require` in the `src/` directory.

## Build system

### Webpack

Three configs merging from `webpack.config.base.js`:

| Config | Target | Entry point(s) |
|---|---|---|
| `webpack.config.main.js` | `electron-main` | `src/main/app/index.ts` |
| `webpack.config.preload.js` | `electron-preload` | `src/app/preload/internalAPI.js`, `externalAPI.ts` |
| `webpack.config.renderer.js` | `web` | Multiple entries in `src/renderer/`, one for each window or `WebContentsView` |

The base config provides Babel transpilation, path alias resolution, and `DefinePlugin` compile-time constants. The main process config marks native modules as webpack externals.

#### Compile-time constants

`DefinePlugin` in `webpack.config.base.js` injects globals for build-specific configuration (e.g., `__IS_MAC_APP_STORE__` to guard MAS-specific behavior). Available as bare globals in source — no import needed. When adding a new one, also add it to the `globals` in the `jest` config in `package.json`.

#### Renderer entry points

Each UI surface (modal, dropdown, screen) needs an entry in `webpack.config.renderer.js` and a matching `HtmlWebpackPlugin` instance. To add a new one: create the React entry point in `src/renderer/`, add both to the webpack config, then load it from the main process via `mattermost-desktop://renderer/myPage.html`.

### electron-builder

Configured in `electron-builder.json`. Output to `release/`.

- **Lifecycle hooks**: `scripts/beforepack.js` (output dirs), `scripts/afterpack.js` (Electron fuses, Linux sandbox permissions)
- **Windows**: zip + MSI (x64, ARM64). Azure code signing. GPO templates bundled.
- **macOS**: zip + DMG (x64, ARM64, Universal). Hardened runtime, notarization. Separate Mac App Store config.
- **Linux**: tar.gz, deb, rpm, AppImage, Flatpak.

### Native Node modules

Native modules extend OS-specific functionality for features like Do Not Disturb detection or Windows registry access. Most target a single OS, and implement system-level calls in C++ and expose those to Node. When adding one, it must be declared as a webpack external in `webpack.config.main.js`, included in `electron-builder.json` (`files` and `asarUnpack`), and may need a patch to no-op on other platforms so the app doesn't crash. Always test builds on all platforms after adding one.

### Patches (`patches/`)

Applied via `patch-package` during `postinstall`. Used when we need to change the behavior of a dependency and there's no better alternative (upstream fix, config option, wrapper). Avoid adding patches when possible — they create maintenance burden on dependency upgrades. When one is necessary, keep the diff minimal and document the reason in a comment at the top of the patch or in the PR.

### Key scripts

| Script | Purpose |
|---|---|
| `scripts/watch.js` | Dev mode with auto-rebuild and Electron restart |
| `scripts/afterpack.js` | Electron fuses and Linux sandbox permissions |
| `scripts/release.sh` | Release tagging (`start`, `rc`, `pre-final`, `final`, `patch`) |
| `scripts/generate_latest_version.sh` | Generates `latest.json` for auto-updater |

## CI/CD (GitHub Actions)

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yaml` | Every PR | Build all platforms, lint, type check, unit tests |
| `build-for-pr.yml` | `Build Apps for PR` label | Full signed builds for manual testing |
| `release.yaml` | Push of `v*` tag | Full release: build, sign, S3 upload, draft GitHub Release |
| `release-mas.yaml` | Push of `v*-rc.*` or `v*-mas.*` tag | Mac App Store release build |
| `nightly-builds.yaml` | Cron (daily, Mon-Sat 4 AM UTC) | Nightly build + QA |

Release flow: `release-X.Y` branch → `release.sh start` (first RC) → push tag → iterate with `release.sh rc` → `release.sh pre-final` (MAS) → `release.sh final` (GA).

## Code conventions

### File header

Every source file must start with:

```
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
```

Some legacy files have a three-line header crediting the original author. Do not change existing headers.

### Imports

Always use ES module `import`/`export`, never `require()`. Import order is enforced by ESLint: builtins → external → `@mattermost/*` → internal aliases (`app`, `common`, `main`, `renderer`) → `types` → siblings/parent/index. Groups separated by blank lines, alphabetized within groups.

### Singletons

Most main-process modules are singletons: export the class (for tests), create a single instance, default-export it.

```typescript
import {EventEmitter} from 'events';

import {Logger} from 'common/log';

const log = new Logger('MyModule');

export class MyModule extends EventEmitter {
    constructor() {
        super();
    }

    init = () => {
    };
}

const myModule = new MyModule();
export default myModule;
```

Only use for modules needing a single global instance. Use regular classes when multiple instances are needed (e.g., `MattermostWebContentsView` per server, `LoadingScreen` per window).

Import singletons using PascalCase as if importing the class, since they represent the single instance: `import MyModule from 'app/myModule';`. For example: `import ServerManager from 'common/servers/serverManager';`, `import MainWindow from 'app/mainWindow/mainWindow';`.

### IPC channels

1. Define the channel constant in `src/common/communication.ts`.
2. Register the handler in `src/main/app/initialize.ts` (global) or in a module's constructor (scoped).
3. Choose the pattern: `handle`/`invoke` for request/response, `on`/`send` for fire-and-forget.
4. Expose to renderer via the appropriate preload script (`internalAPI.js` or `externalAPI.ts`).

```typescript
// 1. src/common/communication.ts — define channel:
export const GET_MY_DATA = 'get-my-data';

// 2. src/main/app/initialize.ts — register handler:
ipcMain.handle(GET_MY_DATA, handleGetMyData);   // request-response
ipcMain.on(DO_SOMETHING, handleDoSomething);     // fire-and-forget

// Handler implementations live in src/main/app/intercom.ts:
export function handleGetMyData() {
    return {result: 'data'};
}

export function handleDoSomething(e: IpcMainEvent, arg: string) {
    // perform side effect
}
```

#### Validating renderer-supplied arguments

If the handler reads any arguments that originate from the renderer (i.e. anything reachable through `externalAPI.ts`, or any internal API call carrying renderer-controlled data), wrap the registration with `ipcValidate` from `common/Validator`. The wrapper validates each positional argument against a Joi schema, drops the call and logs on failure, and only invokes the handler when every argument is well-typed.

```typescript
import Joi from 'joi';
import {ipcValidate} from 'common/Validator';

ipcMain.on(DO_SOMETHING, ipcValidate(
    handleDoSomething,
    [Joi.string().required()],
));
```

Reuse the shared schema exports (`themeSchema`, `joinCallOptsSchema`, etc.) from `common/Validator` for complex payloads; add new exports there rather than declaring schemas in the handler module. Handlers whose arguments are entirely main-process-internal don't need a wrapper.

### Event-driven communication

Modules extending `EventEmitter` broadcast state changes. Define event constants in `communication.ts`, emit from the source, listen from consumers. Prefer events over direct calls when multiple modules react to the same change.

## Testing

- **Unit tests**: Jest, co-located as `*.test.js` or `*.test.ts`. Mock singletons with `jest.mock()` using `__esModule: true` + `default`. Use `jest.mocked()` for type safety.
- **E2E tests**: Playwright, in `e2e/` (separate `package.json`).
- **Test globals**: `__HASH_VERSION__`, `__IS_NIGHTLY_BUILD__`, `__IS_MAC_APP_STORE__`, `__DISABLE_GPU__`, `__SKIP_ONBOARDING_SCREENS__`, `__SENTRY_DSN__`

### Mocking singletons

Singletons use default exports. Mock them with `__esModule: true` + `default`:

```javascript
jest.mock('common/config', () => ({
    __esModule: true,
    default: {
        set: jest.fn(),
        enableServerManagement: true,
        predefinedServers: [],
        localServers: [],
    },
}));
```

Use `jest.mocked()` for type-safe access to mock functions:

```typescript
const Config = jest.mocked(OriginalConfig);
Config.set.mockImplementation(() => {});
```

## Troubleshooting

### Debug logging

Open Settings (`Ctrl/Cmd+,`) → switch logging to **Debug** → reproduce → **View → Show Logs**. Turn off after.

### Developer Tools

| Target | How to open |
|---|---|
| Web App (current server) | **View → Developer Tools for Current Server** |
| Main Window wrapper | **View → Developer Tools for Application Wrapper** |
| Calls Widget (while active) | **View → Developer Tools for Calls Widget** |
| Modals | Run with `MM_DEBUG_MODALS=true` |

### Troubleshooting sequence

1. **Reproduce in browser** — determines if desktop-specific or server/webapp issue.
2. **Reload** — `Ctrl/Cmd+R`. Clear cache: `Ctrl/Cmd+Shift+R`.
3. **Restart** app (and computer if needed).
4. **Reset data** — **View → Clear All Data**, or delete the config directory.
5. **Collect debug logs and heap snapshots**.


## Cursor Cloud specific instructions

- A virtual display is already running (`DISPLAY=:99` via Xvfb) with Openbox as the window manager. GUI/manual testing of the app's internal UI (onboarding, settings, modals, tab bar) works out of the box.
- Passwordless sudo is available and required by `npm run linux-dev-setup` (sets the chrome-sandbox setuid bit).
- `npm start` runs `linux-dev-setup` then launches `electron dist/ --disable-dev-mode`.
- Benign on startup, not bugs: GTK accel-group assertion warnings, one-time `ENOENT bounds-info.json` on first launch, and isolated `net::ERR_FAILED` from first-launch requests that have no configured server yet (e.g. update checks before any server is added). Treat `net::ERR_FAILED` (and other network errors) as **actionable** when connecting to a configured Mattermost server URL or any other resource the task depends on.
- Reset app to the fresh onboarding screen: `rm -rf ~/.config/Electron`.
- The base image has **no Docker daemon and no Go toolchain**. Don't try to build the server from source or run `docker`/`docker-compose`; use the prebuilt server release + PostgreSQL from `apt` (see below).
- `/dev/shm` defaults to a **64MB tmpfs**, which is too small for Electron/Chromium once a real Mattermost server is loaded in a `WebContentsView` (each renderer process shares it). This surfaces as `ERR_INSUFFICIENT_RESOURCES` in the view instead of the loaded web app, even though host RAM is plentiful — it's not a memory-sizing problem, it's this mount. Remount it larger before launching the app: `sudo mount -o remount,size=2G /dev/shm`.
- **Manual/GUI testing (including computer-use) needs a `NODE_ENV=test` build**, not a plain `npm run build` + `npm start`. `webpack.config.base.js`'s `DefinePlugin` inlines `process.env.NODE_ENV` into the bundle at **build time**, so setting `NODE_ENV=test` only when launching has no effect on an already-built `dist/`. Without a test build, connecting to a server pops a blocking native "Permission Requested" (notifications) dialog on top of the app that computer-use/`xdotool` cannot reliably click through, since `dialog.showMessageBox` is only skipped when the build itself was compiled with `NODE_ENV=test` (`src/main/security/permissionsManager.ts`). Build and launch instead:

  ```bash
  npm run build-test               # NODE_ENV=test — outputs to e2e/dist/, NOT dist/
  npm run linux-dev-setup && ./node_modules/.bin/electron e2e/dist/ --disable-dev-mode
  ```
- Do **not** pass `--no-sandbox` when launching manually. Combined with this environment's zygote setup it reliably crashes the app (`GPU process launch failed: error_code=1002`, `Network service crashed`, sometimes a fatal `GPU process isn't usable. Goodbye.` that kills the whole process). The plain launch above works fine because `npm run linux-dev-setup` already configures a real, working `chrome-sandbox` setuid binary — the sandbox doesn't need to be disabled here. If you want extra renderer stability, `--disable-gpu` alone (without `--no-sandbox`) is safe.
- **Never open Chrome (or any other browser) to work around a stuck or blank app window**, and never let a manual-testing/computer-use session spawn its own second `npm start` or `electron` process from a terminal. A stray second instance — especially one still pointed at the stale `dist/` build instead of `e2e/dist/` — produces confusing symptoms that look like app regressions but are really just two instances fighting each other (the notification dialog reappearing, GPU crashes, focus jumping between windows). Before and after manual GUI testing, confirm exactly one Electron process tree is running and pointed at the intended build dir: `ps -ef | grep -i electron`.

### Typing into a server view (WebContentsView)

Each server renders in a `WebContentsView` whose `webContents.focus()` is gated on the main window being focused (`src/app/views/MattermostWebContentsView.ts`). A synthetic click (computer use / `xdotool`) landing *inside* the WebContentsView content (e.g. directly on the login form) does not reliably transfer OS/Electron-level keyboard focus to it, even though the outer `BrowserWindow` and Openbox both report the window as focused — this is not a missing-window-manager issue.

Working procedure for manual/GUI keyboard entry into a server view (e.g. the login form):

1. Click once on the app's own internal chrome — the tab bar / server-tab area at the very top of the window, above the WebContentsView content — before typing anything. This is what actually triggers the app to call `view.focus()` and forward keyboard focus to the WebContentsView; it also lands on whatever element already has autofocus inside it (e.g. the login form's "Email or Username" field).
2. From there, use **keyboard only** — `Tab` to move between fields, type, `Enter` to submit. Do **not** click a second time inside the WebContentsView content: a raw click on a different field (e.g. clicking directly into the password field after typing the username) silently drops focus from the whole view, and any further typed text goes nowhere with no error logged.

This is a manual-testing/computer-use-specific quirk — real users with a physical mouse don't hit it. For scripted (non-GUI) testing, the E2E harness avoids it entirely by driving `webContents` via Playwright/CDP (`loginToMattermost` / `ServerView` helper, see `e2e/AGENTS.md` and `e2e/helpers/`) instead of OS-level synthetic input.

### Running a local Mattermost server (for login / manual testing)

The Desktop App needs a real server to add and log into. Spin one up with the prebuilt **Enterprise Edition** binary (unlicensed → Team Edition features; it also bundles `mmctl`) backed by PostgreSQL.

1. Install and start PostgreSQL, then create the DB user and database:

   ```bash
   sudo apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql
   sudo pg_ctlcluster 16 main start
   sudo -u postgres psql -c "CREATE USER mmuser WITH PASSWORD 'mmuser_password';"
   sudo -u postgres psql -c "CREATE DATABASE mattermost_test OWNER mmuser;"
   ```

2. Download and extract a pinned server release, then start it in a long-lived session (e.g. tmux). Configure it via `MM_*` env vars and enable local mode so `mmctl` can seed without auth:

   ```bash
   MATTERMOST_VERSION=11.9.0
   curl -fsSL -o /tmp/mattermost.tar.gz "https://releases.mattermost.com/${MATTERMOST_VERSION}/mattermost-${MATTERMOST_VERSION}-linux-amd64.tar.gz"
   tar xzf /tmp/mattermost.tar.gz -C ~/
   cd ~/mattermost
   export MM_SQLSETTINGS_DRIVERNAME=postgres
   export MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:mmuser_password@127.0.0.1:5432/mattermost_test?sslmode=disable&connect_timeout=10"
   export MM_SERVICESETTINGS_SITEURL="http://localhost:8065"
   export MM_SERVICESETTINGS_ENABLELOCALMODE=true
   export MM_SERVICESETTINGS_ENABLEONBOARDINGFLOW=false   # skip the "Welcome to Mattermost" checklist modal after login
   ./bin/mattermost   # keep running; wait for "Server is listening on"
   ```

3. Seed a system admin, a regular user, and a team (local mode needs no login):

   ```bash
   ./bin/mmctl --local user create --email admin@example.com --username sysadmin --password 'Sys-Admin-123!' --system-admin
   ./bin/mmctl --local user create --email user1@example.com --username user-1 --password 'User-Test-123!'
   ./bin/mmctl --local team create --name main --display-name "Main Team"
   ./bin/mmctl --local team users add main sysadmin user-1
   ```

4. Verify it's up: `curl -s http://localhost:8065/api/v4/system/ping` → `{"status":"OK"}`.

The Desktop App can now add `http://localhost:8065` and log in as `sysadmin` / `Sys-Admin-123!`. Server-backed E2E specs read these credentials from `MM_TEST_SERVER_URL`, `MM_TEST_USER_NAME`, and `MM_TEST_PASSWORD`.