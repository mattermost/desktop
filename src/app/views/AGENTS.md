# src/app/views/ — Views and Tabs

## Concepts

The app has two layers of abstraction for what the user sees:

- **Views** are Electron `WebContentsView` instances — the actual rendered content. `MattermostWebContentsView` wraps one per server, loading the web app with the external preload script. 

Other views include `LoadingScreen`, `ServerDropdownView`, `DownloadsDropdownView`, and modal views. These are overlays on windows that provide additional functionality.

- **Tabs** are the user-facing representation of views in the tab bar. A server can have multiple tabs. Tabs map to views, but the tab layer handles ordering, switching, and persistence independently.

## Managers

- **`WebContentsManager`** (`webContentsManager.ts`): Creates, destroys, and coordinates `MattermostWebContentsView` instances. Owns the lifecycle of the Electron `WebContentsView` objects.
- **`TabManager`** (`tabs/tabManager.ts`): Manages the tab bar — active tab per server, switching, creation, removal, ordering. Coordinates with `WebContentsManager` to show/hide the corresponding views.
- **`WebContentsEventManager`** (`webContentEvents.ts`): Core security boundary. Attaches navigation guards to every `webContents` instance to control where content can navigate.
- **`PluginsPopUpsManager`** (`pluginsPopUps.ts`): Manages popup windows from Mattermost plugins. Restricts navigation to the originating server's domain.
- **`ModalManager`** (`mainWindow/modals/`): Queue-based modal system. Shows one modal at a time as a `WebContentsView` layered on the main window.

## Overlay views on the main window

`ServerDropdownView` and `DownloadsDropdownView` (`mainWindow/`) are `WebContentsView` overlays rendered on top of the main window content.

## Adding new WebContentsViews (overlays)

For views that render on top of existing windows: create a `WebContentsView` with the internal preload script, load via `mattermost-desktop://renderer/myView.html`, add/remove from the parent window's `contentView`, and handle bounds changes on parent resize.
