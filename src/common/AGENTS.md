# src/common/ — Shared Modules

Shared modules live in the main process. They can be imported from renderer code, but generally should not be—the renderer should use IPC via the preload API instead.

## Key modules

### ServerManager (`servers/serverManager.ts`)

Single source of truth for server state. Servers get a UUID on creation. Emits events: `SERVER_ADDED`, `SERVER_REMOVED`, `SERVER_URL_CHANGED`, `SERVER_SWITCHED`, `SERVER_ORDER_UPDATED`, etc.

### ViewManager (`views/viewManager.ts`)

Manages `MattermostView` data structures — view metadata, types, and primary view tracking per server. Works with `ServerManager` to maintain view-to-server mapping.

### AppState (`appState.ts`)

Tracks mentions, unreads, and expired sessions across all servers. Drives badge counts and tray icon state.

### Communication (`communication.ts`)

All IPC channel names as exported constants. Define new channels here first, then register handlers and expose through preload scripts.

### Validator (`Validator.ts`)

Joi-based validation schemas for all persisted data: config (V0–V4), servers, args, certificates, downloads, window state, and app state. Every module that reads user-editable JSON calls through `Validator` before trusting the data.

Also exports `ipcValidate(handler, schemas)` — a wrapper used at every `ipcMain.on`/`ipcMain.handle` registration whose handler reads renderer-supplied arguments. It validates each positional argument against the provided Joi schemas, drops the call and logs on failure, and only invokes the handler when every argument is well-typed. Shared schemas for renderer payloads (`themeSchema`, `popoutViewPropsSchema`, `joinCallOptsSchema`, `desktopSourcesOptsSchema`) are exported alongside it; add new shared schemas here instead of declaring them in the consumer module.

### JsonFileManager (`JsonFileManager.ts`)

Generic base class for reading/writing typed JSON files with atomic serialization. Used by `Config`, `AppVersionManager`, `CertificateStore`, and others that persist state to disk.

### Constants

- `constants.ts` — Download-related constants (`APP_UPDATE_KEY`, `UPDATE_DOWNLOAD_ITEM`), regex patterns for masking PII in logs, modal name constants, default external links.
- `constants/secureStorage.ts` — Secure storage key constants.

## Logging

`Logger` wrapper around `electron-log` (`log.ts`):

```typescript
import {Logger} from 'common/log';
const log = new Logger('ModuleName');
log.debug('message');
log.withPrefix('instance-id').info('scoped message');
```

Levels: `error`, `warn`, `info`, `verbose`, `debug`, `silly`. View logs via **Help → View Logs**.