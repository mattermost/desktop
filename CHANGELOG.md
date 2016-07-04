# Mattermost Desktop Application Changelog

## Release v1.3.0 (Beta)

### Changes
- Changed the license, from MIT License to Apache License, Version 2.0.

### Fixes

#### Windows
- Fixed the pixelated app icon on the top left of the window.
- Fixed the blurred tray icon.
- Fixed that the redundant description appears in the pinned start menu on Windows 7.
- The main window is now minimized to system tray on close
- Added Option to toggle minimize/restore on click on system tray icon

#### OS X
- Fixed that two icons appear on a notification.
- Added Option to hide Window from dock on close

### Improvements
- Added shortcuts
  - Zoom
    - Ctrl+0 (View -> Actual Size): Reset the zoom level.
    - Ctrl+Plus (View -> Zoom In)
    - Ctrl+Minus (View -> Zoom Out)
  - Control window
    - Ctrl+W (Window -> Close): On Windows and Linux, this works as minimize for the main window.
    - Ctrl+M (Window -> Minimize)
  - Switch teams (these shotcuts also reopen the main window)
    - Ctrl+{1-9} (Window -> *Team name*): Open the *n*-th tab.
    - Ctrl+Tab or Alt+Command+Right (Window -> Select Next Team): Open the right tab.
    - Ctrl+Shift+Tab or Alt+Command+Left (Window -> Select Previous Team): Open the left tab.
- Added **Add** button next to the "Teams" label on the Setting page.
- Added **Edit** button on the team list on the Setting page.
- Added **Help** menu to indicate the application version.
- Added **Mattermost Docs** menu item under **Help** linking to the mattermost docs.
- Added auto-reloading when the tab failed to load the team.

#### Windows
- Added the tooltip text for the tray icon in order to show count of unread channels/mantions.
- Added the option to launch the application on login.
- Added the option to blink the taskbar icon when a new message has arrived.
- Added installers (experimental)

#### OS X
- Added colored badges to the menu icon when there are unread channels/mentions.

#### Linux
- Added the option to show the icon on menu bar. (requires libappindicator1 on Ubuntu)
- Added the option to launch the application on login.


## Release v1.2.1 (Beta)

### Fixes
- Fixed issue to remove "Electron" from appearing in the title bar on startup.

### Improvements
- Added a dialog to confirm use of non-http(s) protocols prior to opening links. For example, clicking on a link to `file://test` will open a dialog to confirm the user intended to open a file.

#### Windows and OS X
- Added a right-click menu option for tray icon to open the Desktop application on Windows and OS X.

### Known issues
- The shortcuts can't switch teams twice in a raw.
- The team pages are not correctly rendered until the window is resized when the zoom level is changed.


## Release v1.2.0 (Beta)

- **Released:** 2016-05-17

This release contains a security update and it is highly recommended that users upgrade to this version.

### Fixes
- Node.js environment is enabled in the new window.
- The link other than `http://` and `https://` is opened by clicking.

#### Linux
- Desktop notification is shown as a dialog on Ubuntu 16.04.

### Improvements
- Improve the style for tab badges.
- Add **Allow mixed content** option to render images with `http://`.
- Add the login dialog for http authentication.

#### OS X
- Add the option to show the icon on menu bar.

#### Linux
- Add **.deb** packages to support installation.


## Release v1.1.1 (Beta)

- **Released:** 2016-04-13

### Fixes

#### All platforms
- **Settings** page doesn't return to the main page when the located path contains a blank.

#### Linux
- Alt+Shift opens menu on Cinnamon desktop environment.


## Release v1.1.0 (Beta)

- **Released:** 2016-03-30

The `electron-mattermost` project is now the official desktop application for the Mattermost open source project.


### Changes

#### All platforms

- Rename project from `electron-mattermost` to  `desktop`
- Rename the executable file from `electron-mattermost` to `Mattermost`
  - The configuration directory is also different from previous versions.
  - Should execute following command to take over `config.json`.
    - Windows: `mkdir %APPDATA%\Mattermost & copy %APPDATA%\electron-mattermost\config.json %APPDATA%\Mattermost\config.json`
    - OS X: `ditto ~/Library/Application\ Support/electron-mattermost/config.json ~/Library/Application\ Support/Mattermost/config.json`
    - Linux: `mkdir -p ~/.config/Mattermost && cp ~/.config/electron-mattermost/config.json ~/.config/Mattermost/config.json`


### Improvements

#### All platforms
- Refine application icon.
- Show error messages when the application failed in loading Mattermost server.
- Show confirmation dialog to continue connection when there is certificate error.
- Add validation to check whether both of **Name** and **URL** fields are not blank.
- Add simple basic HTTP authentication (requires a command line).

#### Windows
- Show a small circle on the tray icon when there are new messages.


### Fixes

#### Windows
- **File** > **About** does not bring up version number dialog.

#### Linux
- **File** > **About** does not bring up version number dialog.
- Ubuntu: Notification is not showing up.
- The view crashes when freetype 2.6.3 is used in system.


### Known issues

#### All platforms
- Basic Authentication is not working.
- Some keyboard shortcuts are missing. (e.g. <kbd>Ctrl+W</kbd>, <kbd>Command+,</kbd>)
- Basic authentication requires a command line.

#### Windows
- Application does not appear properly in Windows volume mixer.
