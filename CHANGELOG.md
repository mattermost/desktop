# Mattermost Desktop Application Changelog


## Release v1.2.0 (Beta)

This release contains a security update and it is highly recommended that users upgrade to this version.

### Fixes
- Node.js environment is enabled in the new window.
- The link other than `http://` and `https://` is opened by clicking.

#### Linux
- Desktop notification is shown as a dialog on Ubuntu 16.04.

### Improvements
- Improve the style for tab badges.
- Add **Allow insecure contents** option to render images with `http://`.
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
