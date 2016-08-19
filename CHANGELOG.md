# Mattermost Desktop Application Changelog

## UNDER DEVELOPMENT v1.4.0

The "UNDER DEVELOPMENT" section of the Mattermost Desktop changelog appears in the product's `master` branch to note key changes committed to `master` and are on their way to the next stable release. When a stable release is pushed, "UNDER DEVELOPMENT" heading is removed from the final changelog of the release.

Release date: TBD

### Improvements

#### All platforms
- Changed display of unread messages on the team tabbar, they are now shown as bold text
- Reload only the selected tab and keep its URL on "Reload" and "Clear Cache and Reload".
- Disabled `eval()` function for security improvements.
- Invalidate cache before load, to make server upgrades easy

#### Windows
- Update Mattermost icon for desktop notifications in Windows 10.
- An existing application instance will be reused instead of starting another instance.

#### Linux (Beta)
- Added an option to make the taskbar icon flash on new messages
- Added the badge to count mentions for Unity.
- An existing application instance will be reused instead of starting another instance.

#### OS X
- Added an option to toggle the red dot icon for unread messages (default is on).

#### Windows
- Added an option to toogle the red dot icon for unread messages (default is on).


### Bug Fixes

## Release v1.3.0

Release date: 2016-07-18

[Download the latest version here](https://about.mattermost.com/downloads/).

### Improvements

#### Windows
- Added an installer for better install experience.
- The app now minimizes to the system tray when closed.
- Added an option to launch application on login.
- Added an option to blink the taskbar icon when a new message has arrived.
- Added tooltip text for the system tray icon in order to show count of unread channels/mentions.
- Added an option to toggle the app to minimize/restore when clicking on the system tray icon.
- Added auto-reloading when tab fails to load the team.
- Added the ability to access all of your teams by right clicking the system tray icon.

#### OS X
- Added colored badges to the menu icon when there are unread channels/mentions.
- Added an option to minimize the app to the system tray when closed.
- Added auto-reloading when tab fails to load the team.
- Added the ability to access all of your teams by right clicking the system tray icon.

#### Linux (Beta)
- Added an option to show the icon on menu bar (requires libappindicator1 on Ubuntu).
- Added an option to launch application on login.
- Added an option to minimize the app to the system tray when closed.
- Added auto-reloading when tab fails to load the team.
- Added the ability to access all of your teams by right clicking the system tray icon.

#### Menu Bar
- New Keyboard Shortcuts
  - Adjust text size
    - Ctrl+0 (Menu Bar -> View -> Actual Size): Reset the zoom level.
    - Ctrl+Plus (Menu Bar -> View -> Zoom In): Increase text size
    - Ctrl+Minus (Menu Bar -> View -> Zoom Out): Decrease text size
  - Control window
    - Ctrl+W (Menu Bar -> Window -> Close): On Linux, this minimizes the main window.
    - Ctrl+M (Menu Bar -> Window -> Minimize)
  - Switch teams (these shotcuts also reopen the main window)
    - Ctrl+{1-9} (Menu Bar -> Window -> *Team name*): Open the *n*-th tab.
    - Ctrl+Tab or Alt+Command+Right (Menu Bar -> Window -> Select Next Team): Switch to the next window.
    - Ctrl+Shift+Tab or Alt+Command+Left (Menu Bar -> Window -> Select Previous Team): Switch to the previous window.
    - Right click on the tray item, to see an overview of all your teams. You can also select one and jump right into it.
- Added **Help** to the Menu Bar, which includes
    - Link to [**Mattermost Docs**](docs.mattermost.com)
    - Field to indicate the application version number.

#### Settings Page
- Added a "+" button next to the **Teams** label, which allows you to add more teams.
- Added the ability to edit team information by clicking on the pencil icon to the right of the team name.

### Other Changes
- Application license changed from MIT License to Apache License, Version 2.0.

### Bug Fixes

#### All platforms
- Fixed authentication dialog not working for proxy.

#### Windows
- Fixed the blurred system tray icon.
- Fixed a redundant description appearing in the pinned start menu on Windows 7.

#### OS X
- Fixed two icons appearing on a notification.

### Known Issues

#### Linux
- [Ubuntu - 64 bit] Right clicking taskbar icon and choosing **Quit** only minimizes the app
- [Ubuntu - 64 bit] [Direct message notification comes as a streak of line instead of a pop up](https://github.com/mattermost/platform/issues/3589)

### Contributors

Many thanks to all our contributors. In alphabetical order:

- [CarmDam](https://github.com/CarmDam), [it33](https://github.com/it33), [jasonblais](https://github.com/jasonblais), [jnugh](https://github.com/jnugh), [magicmonty](https://github.com/magicmonty), [MetalCar](https://github.com/MetalCar), [Razzeee](https://github.com/Razzeee), [yuya-oc](https://github.com/yuya-oc)

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

### Contributors

Many thanks to all our contributors. In alphabetical order:

- [asaadmahmoodspin](https://github.com/asaadmahmoodspin), [jeremycook](https://github.com/jeremycook), [jnugh](https://github.com/jnugh), [jwilander](https://github.com/jwilander), [mgielda](https://github.com/mgielda), [lloeki](https://github.com/lloeki), [yuya-oc](https://github.com/yuya-oc)

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
