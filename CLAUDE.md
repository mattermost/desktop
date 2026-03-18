# CLAUDE.md — Mattermost Desktop App

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

Module-specific documentation lives in `CLAUDE.md` files within each subdirectory.

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
