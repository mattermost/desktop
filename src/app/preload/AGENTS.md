# src/app/preload/ — Preload Scripts

Bridge between main and renderer via Electron's `contextBridge`.

## internalAPI.js → `window.desktop`

Full API for trusted internal views (main window, settings, modals, dropdowns). Covers app lifecycle, server/tab management, configuration, UI state, downloads, and themes. Used by all `src/renderer/` entry points.

## externalAPI.ts → `window.desktopAPI`

Restricted API for external Mattermost server views. Covers session management, notifications/unreads, navigation, theme syncing, Calls integration, popout windows, and performance metrics. Also handles secure input toggling on macOS and periodic cache clearing.

## Desktop API types (`api-types/`)

The `api-types/` directory at repo root contains `@mattermost/desktop-api` — a standalone TypeScript types package defining the `DesktopAPI` interface. This is the contract between the Mattermost Web App and `externalAPI.ts`. It has its own `package.json`.

## Adding a new IPC method

1. Define the channel constant in `src/common/communication.ts`.
2. Register the handler in the main process.
3. Add the bridge method to `internalAPI.js` (internal views) or `externalAPI.ts` (server views).
4. If adding to the external API, update the `DesktopAPI` interface in `api-types/`.

### internalAPI.js examples

```javascript
// Fire-and-forget (main process doesn't return a value):
myAction: (arg) => ipcRenderer.send(MY_ACTION, arg),

// Request-response (main process returns a value):
getMyData: () => ipcRenderer.invoke(GET_MY_DATA),

// Listen for main→renderer events:
onMyEvent: (listener) => ipcRenderer.on(MY_EVENT, (_, data) => listener(data)),
```

### externalAPI.ts examples

```typescript
// In the desktopAPI object:
getMyData: () => ipcRenderer.invoke(GET_MY_DATA),
onMyEvent: (listener) => createListener(MY_EVENT, listener),
```
