# src/app/ — High-Level App Modules

Windows, tabs, modals, menus, and Calls integration. These modules sit between the main process (OS-level) and the renderer (React UI).

## Key modules

### Windows

- **`BaseWindow`** (`windows/baseWindow.ts`): Wraps `BrowserWindow` with standard behavior — bounds persistence, context menu, loading screen, URL view, secure input toggling, and keyboard shortcut handling. Most app windows should use `BaseWindow` rather than raw `BrowserWindow`.
- **`MainWindow`** (`mainWindow/mainWindow.ts`): Primary `BrowserWindow` — creation, bounds persistence, fullscreen, focus.
- **`PopoutManager`** (`windows/popoutManager.ts`): Popout windows for views (RHS, boards). Creates `BaseWindow` instances that are isolated to a specific URL.

To add a new window: create a class using `BaseWindow` (or raw `BrowserWindow` for specialized cases like frameless/transparent). Singleton pattern if only one instance needed. Set preload via `getLocalPreload('internalAPI.js')`, load content via `mattermost-desktop://renderer/myPage.html`, and attach navigation guards.

### Menus (`menus/`)

`MenuManager` (`index.ts`) builds the application menu and tray context menu, and rebuilds them when config, tabs, or views change. Each top-level menu (File, Edit, View, History, Window, Help) has its own factory function in `appMenu/`. The tray context menu is in `tray.ts`.

To add a menu item: find the appropriate factory function in `appMenu/` (e.g., `view.ts` for the View menu), add a `MenuItemConstructorOptions` entry, and wire it to an IPC event or direct main process action. The menu rebuilds automatically on relevant state changes.

### System (`system/`)

**`TrayIcon`**: System tray icon — updates based on unread/mention/expired status. Platform-specific click behavior.

### Other modules

- **`NavigationManager`**: Deep linking (`mattermost://`) and browser history push from the web app.
- **`CallsWidgetWindow`**: Calls plugin widget — screen sharing, desktop sources, call lifecycle. Registers its own IPC handlers in constructor.
- **`ServerHub`**: Server management IPC — add/edit/remove server modals, URL validation.
- **`PopoutMenu`** (`popoutMenu.ts`): Context menu for popout windows and tabs — copy link, close, reopen in tab.

## Dependency constraints

`WebContentsManager` (`views/webContentsManager.ts`) is imported by both `TabManager` and `PopoutManager`. To avoid circular dependencies, **`WebContentsManager` must never import `TabManager` or `PopoutManager`**. When an IPC event needs view-type-specific handling, register listeners in both `TabManager` (guarded on `ViewType.TAB`) and `PopoutManager` (guarded on `ViewType.WINDOW`) rather than centralizing in `WebContentsManager`.

## Navigation model

Navigation is tightly controlled for security and UX:

- **`NavigationManager`** (`src/app/navigationManager.ts`): Handles deep linking (`mattermost://` protocol) and `browserHistory.push` calls within individual server views.
- **External navigation**: Links to non-configured servers open in the user's default browser via `will-navigate`, `did-start-navigation`, and `setWindowOpenHandler`.
- **Magic link flow**: Exception path allowing passwordless login via magic links to navigate within the app.
- Navigation guards are centralized in `WebContentsEventManager` (`src/app/views/webContentEvents.ts`).

