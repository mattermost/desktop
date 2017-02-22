# Mattermost Desktop Application Changelog

## Release v3.6.0

Release date: February 28, 2017

Upgrading to Mattermost server 3.6 or later is recommended, as new features for the desktop app have been added following the release of the team sidebar.

### Improvements
 - Added support for unread indicators following the release of team sidebar in Mattermost server 3.6
 - Removed a confusing `CTRL/CMD+S` shortcut for searching within a Mattermost team
 - Added support for SAML OneLogin and Google authentication for Enterprise users
 - Streamlined desktop server management:
   - "Team Management" changed to "Server Management" following the release of team sidebar in Mattermost server 3.6
   - Added a "+" icon to the desktop server tab bar to more easily sign into a new Mattermost server
   - Added an option to sign into another Mattermost server from **File > Sign in to Another Server**
   - Clicking "Add new server" on the Settings page opens a dialog instead of a new row
   - Clicking "Remove" next to a server now requires a confirmation to prevent a user from removing the server by accident
   - Clicking "Edit" next to a server on the Settings page opens a dialog
   - Clicking on a server on the Settings page opens the corresponding server tab
 - Simplified desktop app options:
   - App options now auto-save when changed
   - Added supporting help text for each option
   - Removed "Leave app running in menu bar when application window is closed" setting for Mac, which is not applicable for that platform
   - Removed "Toggle window visibility when clicking on the tray icon" setting for Windows, given the behavior is inconsistent with typical Windows app behavior
   - Removed "Hide menu bar" setting to avoid users not being able to use the menu bar and the Settings page.

### Bug Fixes

#### All Platforms
- Mattermost window no longer opens on a display screen that has been disconnected
- Mention badges no longer persist after logging out of a Mattermost server
- Fixed an issue where selecting a server from the system tray icon while viewing the Settings page didn't work
- After right-clicking an image or a link, the "Copy Link" option no longer moves around when clicking different places afterwards
- Fixed an issue where minimum window size is not set
- Changed target resolution size to 1000x700 to prevent unintended issues on the user interface
- Fixed an issue where the application menu is not updated when the config file is saved in the Settings page
- Fixed login issues with local development environment
- Removed a white screen which was momentarily displayed on startup

#### Windows
- Fixed an issue where an unexpected window appears while installing or uninstalling
- Fixed an issue where the maximized state of the application window was not restored on re-launch if "Start app on Login" setting is enabled

#### Linux (Beta)
- Fixed an issue where tray icon wasn't shown by default even when "Show icon in the notification area" setting is enabled
- Fixed an issue where the maximized state of the application window was not restored on re-launch if "Start app on login" setting is enabled

### Known Issues

#### All Platforms
 - [If you click twice on the tab bar, and then attempt to use the "Zoom in/out" to change font size, the app window doesn't render properly](https://github.com/mattermost/desktop/issues/334)
 - [After using CTRL+K, an added row appears in the message box](https://github.com/mattermost/desktop/issues/426)
 - [Holding down CTRL, SHIFT or ALT buttons and clicking a channel opens a new application window](https://github.com/mattermost/desktop/issues/406)

#### Windows
 - [Windows 7] [Sometimes the app tries to render the page inside the app instead of in a new browser tab when clicking links](https://github.com/mattermost/desktop/issues/369)

#### Mac
 - [After uploading a file with a keyboard shortcut, focus isn't set back to the message box](https://github.com/mattermost/desktop/issues/341)

#### Linux (Beta)
 - [Ubuntu - 64 bit] [Right clicking taskbar icon and choosing **Quit** only minimizes the app](https://github.com/mattermost/desktop/issues/90#issuecomment-233712183)
 - [Ubuntu - 64 bit] [Direct message notification comes as a streak of line instead of a pop up](https://github.com/mattermost/platform/issues/3589)

### Contributors

Many thanks to all our contributors. In alphabetical order:

 - [asaadmahmood](https://github.com/asaadmahmood), [jasonblais](https://github.com/jasonblais), [jnugh](https://github.com/jnugh), [yuya-oc](https://github.com/yuya-oc)

----

## Release v3.5.0

Release date: December 14, 2016

### Improvements

#### All Platforms
 - URL address is shown when hovering over links with a mouse
 - Added `CTRL+SHIFT+MINUS` as a shortcut for decreasing font size (zooming out)
 - Reduce upgrade issues by properly clearing cache when updating the desktop app to a new version (the application cache will be purged whenever the desktop app version changes)
 - When disconnected from Mattermost, the "Cannot connect to Mattermost" page is now properly aligned at the top of the window
 - Suppressed error messages when launching the app from the command line and `certificate.json` is missing in the user data directory

#### Windows
 - Link addresses can now be copied and pasted inside the app

### Bug Fixes

#### All Platforms
 - YouTube previews now work, even if mixed content is allowed
 - Fixed an incorrect cursor mode for "Edit" and "Remove" buttons on the Settings page
 - Fixed an issue where "Zoom in/out" settings did not properly work

#### Windows
 - The menu bar option for "Redo" is now properly shown as `CTRL+Y`

#### Mac
 - Fixed an issue where the default download folder was `Macintosh HD`
 - Removed an unexpected "Show Tab Bar" menu item on macOS 10.12

#### Linux (Beta)
 - Fixed an issue where the option "Leave app running in notification area when the window is closed" was never enabled.

### Known Issues

#### All Platforms
 - [If you click twice on the tab bar, and then attempt to use the "Zoom in/out" to change font size, the app window doesn't render properly](https://github.com/mattermost/desktop/issues/334)
 - [Direct messages cause notification icons to appear on each team on the tab bar, which don't clear until you click on each team](https://github.com/mattermost/desktop/issues/160)
 - [After right-clicking an image or a link, the "Copy Link" option sometimes moves around when clicking different places afterwards](https://github.com/mattermost/desktop/issues/340)

#### Windows
 - [Windows 7] [Sometimes the app tries to render the page inside the app instead of in a new browser tab when clicking links](https://github.com/mattermost/desktop/issues/369)

#### Mac
 - [After uploading a file with a keyboard shortcut, focus isn't set back to the message box](https://github.com/mattermost/desktop/issues/341)

#### Linux (Beta)
 - [Ubuntu - 64 bit] [Right clicking taskbar icon and choosing **Quit** only minimizes the app](https://github.com/mattermost/desktop/issues/90#issuecomment-233712183)
 - [Ubuntu - 64 bit] [Direct message notification comes as a streak of line instead of a pop up](https://github.com/mattermost/platform/issues/3589)

### Contributors

Many thanks to all our contributors. In alphabetical order:

- [itsmartin](https://github.com/itsmartin), [jasonblais](https://github.com/jasonblais), [jcomack](https://github.com/jcomack), [jnugh](https://github.com/jnugh), [kytwb](https://github.com/kytwb), [magicmonty](https://github.com/magicmonty), [Razzeee](https://github.com/Razzeee), [yuya-oc](https://github.com/yuya-oc)

Thanks also to those who reported bugs that benefited the release, in alphabetical order:

- ellisd ([#383](https://github.com/mattermost/desktop/issues/383)), [it33](https://github.com/it33) ([#384](https://github.com/mattermost/desktop/issues/384)), [jnugh](https://github.com/jnugh) ([#392](https://github.com/mattermost/desktop/issues/392)), [lfbrock](https://github.com/lfbrock) ([#382](https://github.com/mattermost/desktop/issues/382)), [yuya-oc](https://github.com/yuya-oc) ([#391](https://github.com/mattermost/desktop/issues/391))

----

## Release v3.4.1

Release date: September 30, 2016

### Bug Fixes

#### Mac
 - Fixed an issue where the app window pops up second to foreground when a new message is received

----

## Release v3.4.0

Release date: September 22, 2016

This release contains a security update and it is highly recommended that users upgrade to this version.

Version number updated to 3.4 to make numbering consistent with Mattermost server and mobile app releases. This change will not imply monthly releases.

### Improvements

#### All Platforms
 - Current team and channel name shown in window title bar
 - Team tab is bolded for unread messages and has a red dot with a count of unread mentions
 - Added new shortcuts:
     - `CTRL+S`; `CMD+S` on Mac: sets focus on the Mattermost search box
     - `ALT+Left Arrow`; `CMD+[` on Mac: go to previous page in history
     - `ALT+Right Arrow`; `CMD+]` on Mac: go to next page in history
 - Upgraded the Settings page user interface
 - The app now tries to reconnect periodically if a page fails to load
 - Added validation for name and URL when adding a new team on the Settings page

#### Windows
 - Added access to the settings menu from the system tray icon
 - Only one instance of the desktop application will now load at a time
 - Added an option to configure whether a red badge is shown on taskbar icon for unread messages

#### Mac
 - Added an option to configure whether a red badge is shown on taskbar icon for unread messages

#### Linux (Beta)
 - Added an option to flash taskbar icon when a new message is received
 - Added a badge to count mentions on the taskbar icon (for Unity)
 - Added a script, `create_desktop_file.sh` to create `Mattermost.desktop` desktop entry to help [integrate the application into a desktop environment](https://wiki.archlinux.org/index.php/Desktop_entries) more easily
 - Added access to the settings menu from the system tray icon
 - Only one instance of the desktop application will now load at a time

### Bug Fixes

#### All Platforms
 - Cut, copy and paste are shown in the user interface only when the commands are available
 - Copying link addresses now work properly
 - Saving images by right-clicking the image preview now works
 - Refreshing the app page no longer takes you to the team selection page, but keeps you on the current channel
 - Fixed an issue where the maximized state of the app window was lost in some cases
 - Fixed an issue where shortcuts didn't work when switching applications or tabs in some cases

#### Windows
 - Removed misleading shortcuts from the system tray menu
 - Removed unclear desktop notifications when the application page fails to load
 - Fixed the Mattermost icon for desktop notifications in Windows 10
 - Fixed an issue where application icon at the top left of the window was pixelated
 - Fixed an issue where the application kept focus after closing the app window

#### Linux (Beta)
 - Removed misleading shortcuts from the system tray menu
 - Removed unclear desktop notifications when the application page fails to load

### Known Issues

#### All Platforms
 - YouTube videos do not work if mixed content is enabled from app settings

#### Windows
 - Copying a link address and pasting it inside the app doesn't work

#### Linux
 - [Ubuntu - 64 bit] Right clicking taskbar icon and choosing **Quit** only minimizes the app
 - [Ubuntu - 64 bit] [Direct message notification comes as a streak of line instead of a pop up](https://github.com/mattermost/platform/issues/3589)

### Contributors

Many thanks to all our contributors. In alphabetical order:

- [akashnimare](https://github.com/akashnimare), [asaadmahmood](https://github.com/asaadmahmood), [jasonblais](https://github.com/jasonblais), [jgis](https://github.com/jgis), [jnugh](https://github.com/jnugh), [Razzeee](https://github.com/Razzeee), [St-Ex](https://github.com/St-Ex), [timroes](https://github.com/timroes), [yuya-oc](https://github.com/yuya-oc)

----

## Release v1.3.0

Release date: 2016-07-18

[Download the latest version here](https://about.mattermost.com/downloads/).

### Improvements

#### All Platforms
- Added auto-reloading when tab fails to load the team.
- Added the ability to access all of your teams by right clicking the system tray icon.

##### Menu Bar
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

##### Settings Page
- Added a "+" button next to the **Teams** label, which allows you to add more teams.
- Added the ability to edit team information by clicking on the pencil icon to the right of the team name.

#### Windows
- Added an installer for better install experience.
- The app now minimizes to the system tray when application window is closed.
- Added an option to launch application on login.
- Added an option to blink the taskbar icon when a new message has arrived.
- Added tooltip text for the system tray icon in order to show count of unread channels/mentions.
- Added an option to toggle the app to minimize/restore when clicking on the system tray icon.

#### Mac
- Added colored badges to the menu icon when there are unread channels/mentions.
- Added an option to minimize the app to the system tray when application window is closed.

#### Linux (Beta)
- Added an option to show the icon on menu bar (requires libappindicator1 on Ubuntu).
- Added an option to launch application on login.
- Added an option to minimize the app to the system tray when application window is closed.

### Other Changes
- Application license changed from MIT License to Apache License, Version 2.0.

### Bug Fixes

#### All platforms
- Fixed authentication dialog not working for proxy.

#### Windows
- Fixed the blurred system tray icon.
- Fixed a redundant description appearing in the pinned start menu on Windows 7.

#### Mac
- Fixed two icons appearing on a notification.

### Known Issues

#### Linux
- [Ubuntu - 64 bit] Right clicking taskbar icon and choosing **Quit** only minimizes the app
- [Ubuntu - 64 bit] [Direct message notification comes as a streak of line instead of a pop up](https://github.com/mattermost/platform/issues/3589)

### Contributors

Many thanks to all our contributors. In alphabetical order:

- [CarmDam](https://github.com/CarmDam), [it33](https://github.com/it33), [jasonblais](https://github.com/jasonblais), [jnugh](https://github.com/jnugh), [magicmonty](https://github.com/magicmonty), [MetalCar](https://github.com/MetalCar), [Razzeee](https://github.com/Razzeee), [yuya-oc](https://github.com/yuya-oc)

----

## Release v1.2.1 (Beta)

### Fixes
- Fixed issue to remove "Electron" from appearing in the title bar on startup.

### Improvements
- Added a dialog to confirm use of non-http(s) protocols prior to opening links. For example, clicking on a link to `file://test` will open a dialog to confirm the user intended to open a file.

#### Windows and Mac
- Added a right-click menu option for tray icon to open the Desktop application on Windows and OS X.

### Known issues
- The shortcuts can't switch teams twice in a raw.
- The team pages are not correctly rendered until the window is resized when the zoom level is changed.

----

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

#### Mac
- Add the option to show the icon on menu bar.

#### Linux
- Add **.deb** packages to support installation.

### Contributors

Many thanks to all our contributors. In alphabetical order:

- [asaadmahmoodspin](https://github.com/asaadmahmoodspin), [jeremycook](https://github.com/jeremycook), [jnugh](https://github.com/jnugh), [jwilander](https://github.com/jwilander), [mgielda](https://github.com/mgielda), [lloeki](https://github.com/lloeki), [yuya-oc](https://github.com/yuya-oc)

----

## Release v1.1.1 (Beta)

- **Released:** 2016-04-13

### Fixes

#### All platforms
- **Settings** page doesn't return to the main page when the located path contains a blank.

#### Linux
- Alt+Shift opens menu on Cinnamon desktop environment.

----

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
