# Mattermost Desktop Application Changelog

## UNDER DEVELOPMENT

The "UNDER DEVELOPMENT" section of the Mattermost Desktop changelog appears
in the product's `master` branch to note key changes committed to `master`
and are on their way to the next stable release.
When a stable release is pushed, "UNDER DEVELOPMENT" heading is removed
from the final changelog of the release.

Release date: TBD

### Improvements

#### All Platforms
 - Improved the wording of the bad certificate dialog to make it scarier and harder to just allow.
 [#900](https://github.com/mattermost/desktop/pull/900)
 - Improved the styling of the mention badge in tab bar.
 [#924](https://github.com/mattermost/desktop/pull/924)
 - Updated spellchecker dictionaries for English.
 [#938](https://github.com/mattermost/desktop/pull/938)

#### Mac
 - Added auto-updater.
 [#582](https://github.com/mattermost/desktop/pull/582)

### Architectural Changes
 - Major version upgrade of Electron to v3.0.10. Electron is the underlying technology used to build the Desktop apps.
 [#892](https://github.com/mattermost/desktop/pull/892)

### Bug Fixes

#### All Platforms
 - Prevented the bug where the app would navigate to a random page.
 [#900](https://github.com/mattermost/desktop/pull/900)
 - Fixed several typos.
 [#905](https://github.com/mattermost/desktop/pull/905)

----

## Release v4.2.1

Release date: March 20, 2019

- Mattermost v4.2.1 contains a bug fix for all platforms.

### Bug Fixes

#### All Platforms
- Fixed an issue where the links to the same subdomain opened in a smaller window in the Mattermost app.
[#946](https://github.com/mattermost/desktop/pull/946)

### Contributors

Many thanks to all our contributors. In alphabetical order:

[lieut-data](https://github.com/lieut-data)

----

## Release v4.2.0

Release date: Nov 27, 2018

- Mattermost v4.2.0 contains a high level security fix. [Upgrading](http://docs.mattermost.com/administration/upgrade.html) is highly recommended. Details will be posted on our [security updates page](https://about.mattermost.com/security-updates/) 30 days after release as per the [Mattermost Responsible Disclosure Policy](https://www.mattermost.org/responsible-disclosure-policy/).

### Improvements

#### All Platforms
 - Added English (UK), Portuguese (BR), Spanish (ES) and Spanish (MX) to the spell checker.
 [#843](https://github.com/mattermost/desktop/pull/843)
 [#875](https://github.com/mattermost/desktop/pull/875)
 - Added `Ctrl/Cmd+F` shortcut to work as browser-like search.
 [#399](https://github.com/mattermost/desktop/issues/399)
 - Preserved case of first letter in spellcheck.
 [#869](https://github.com/mattermost/desktop/pull/869)
 - Added support for session expiry notification.
 [#866](https://github.com/mattermost/desktop/pull/866)

#### Windows
 - Set "app start on login" preference as enabled by default and synchronized its state with config.json.
 [#846](https://github.com/mattermost/desktop/pull/846)

#### Mac
 - Added **.dmg** package to support installation.
 [#588](https://github.com/mattermost/desktop/pull/588)
 - Added "Hide" option to Login Items in Preferences.
 [#853](https://github.com/mattermost/desktop/pull/853)

#### Linux
 - [tar.gz] Added support for using SVG icons for Linux application menus in place of PNG icons.
 [#815](https://github.com/mattermost/desktop/pull/815)
 - Updated categories in order to be listed under the appropriate submenu of the application starter.
 [#816](https://github.com/mattermost/desktop/pull/816)
 [#818](https://github.com/mattermost/desktop/pull/818)
 - Set "app start on login" preference as enabled by default and synchronized its state with config.json.
 [#846](https://github.com/mattermost/desktop/pull/846)
 - Added AppImage packages as an unofficial build.
 [#864](https://github.com/mattermost/desktop/pull/864)

### Architectural Changes
 - Major version upgrade of Electron to v2.0.12. Electron is the underlying technology used to build the Desktop apps.
 [#820](https://github.com/mattermost/desktop/pull/820)
 [#847](https://github.com/mattermost/desktop/pull/847)
 [#882](https://github.com/mattermost/desktop/pull/882)
 - Artifact names are now configured via `electron-builder.json`.
 [#825](https://github.com/mattermost/desktop/pull/825)

### Contributors

Many thanks to all our contributors. In alphabetical order:

 - [danmaas](https://github.com/danmaas), [hmhealey](https://github.com/hmhealey), [j1mc](https://github.com/j1mc),[jasonblais](https://github.com/jasonblais), [lieut-data](https://github.com/lieut-data), [rodcorsi](https://github.com/rodcorsi), [scherno2](https://github.com/scherno2), [sudheerDev](https://github.com/sudheerDev), [svelle](https://github.com/svelle), [torlenor](https://github.com/torlenor), [yuya-oc](https://github.com/yuya-oc)

----

## Release v4.1.2

Release date: May 25, 2018

### Bug Fixes

#### All Platforms
 - Fixed an issue where the popup dialog to authenticate a user to their proxy or server didn't work.
 [#809](https://github.com/mattermost/desktop/issues/809)

---

## Release v4.1.1

Release date: May 17, 2018

This release contains multiple bug fixes for Mac due to an incorrect build for v4.1.0. Windows and Linux apps are not affected.

### Bug Fixes

Each of the issues listed below are already fixed for Windows and Linux v4.1.0.

#### Mac
 - Fixed an issue where right-clicking an image, then choosing "Save Image", did nothing.
[#774](https://github.com/mattermost/desktop/issues/707)
 - Fixed an issue that prevented typing in the form fields on the add server dialog when launched from the server tab bar.
[#780](https://github.com/mattermost/desktop/issues/780)
 - Fixed an issue that could cause an error message on the add new server dialog to be misleading.
[#438](https://github.com/mattermost/desktop/issues/438)
 - Fixed an issue where timestamps in message view showed no URL on hover. [#777](https://github.com/mattermost/desktop/pull/777)
 - Fixed an issue where quitting and reopening the app required the user to log back in to Mattermost. [#789](https://github.com/mattermost/desktop/pull/789)
 - Fixed an issue where adding a new server sometimes caused a blank page. [#787](https://github.com/mattermost/desktop/pull/787)
 - Fixed deep linking via ``mattermost://`` protocol spawning a new copy of the Desktop App on the taskbar. [#771](https://github.com/mattermost/desktop/issues/771)

----

## Release v4.1.0

Release date: May 16, 2018

### Improvements

#### All Platforms
 - Improved stability and performance
   - Reduced memory usage by periodically clearing cache. [#746](https://github.com/mattermost/desktop/issues/710)
   - Fixed app crashing when a server tab was drag-and-dropped to the message view.
[#667](https://github.com/mattermost/desktop/issues/667)
   - Added an option to disable GPU hardware acceleration in App Settings to improve stability in some systems. [#734](https://github.com/mattermost/desktop/pull/734)
   - Fixed Windows crash issues during installation. [#728](https://github.com/mattermost/desktop/issues/728)
   - Fixed Mac and Linux crashing after toggling "Show Mattermost icon in menu bar" app setting.
- Updated design for loading animation icon.
[#748](https://github.com/mattermost/desktop/issues/748)
 - Improved appearance of server tabs.
[#518](https://github.com/mattermost/desktop/issues/518)
[#717](https://github.com/mattermost/desktop/issues/717)
 - Enabled [Certificate Transparency](https://www.certificate-transparency.org/what-is-ct) verification in HTTPS.
[#741](https://github.com/mattermost/desktop/pull/741)

#### Windows
 - [Windows 7/8] Desktop notifications now respect the duration setting set in the Control Panel.
[#601](https://github.com/mattermost/desktop/issues/601)

### Architectural Changes
 - Major version upgrade of Electron from v1.7.13 to v1.8.4. Electron is the underlying technology used to build the Desktop apps.
[#711](https://github.com/mattermost/desktop/pull/711)
[#741](https://github.com/mattermost/desktop/pull/741)
 - Mac download files now use Zip packages rather than tar.gz files. [#749](https://github.com/mattermost/desktop/pull/749)
 - ES6 `import` and `export` now replace the `require` and `modul.export` modules for better development.
[#756](https://github.com/mattermost/desktop/pull/756)
 - Storybook added to more easily develop React componets without executing the desktop app. [#757](https://github.com/mattermost/desktop/pull/757)

### Bug Fixes

#### All Platforms

 - Fixed an issue where an incorrect spellchecker language was used for non `en-US` locales on initial installation.
[#632](https://github.com/mattermost/desktop/issues/632)
 - Fixed an issue where error page appeared when U2F device was used for multi-factor authentication through single sign-on.
[#708](https://github.com/mattermost/desktop/issues/708)
 - Fixed an issue where right-clicking an image, then choosing "Save Image", did nothing.
[#774](https://github.com/mattermost/desktop/issues/707)
 - Fixed an issue that prevented typing in the form fields on the add server dialog when launched from the server tab bar.
[#780](https://github.com/mattermost/desktop/issues/780)
 - Fixed an issue that could cause an error message on the add new server dialog to be misleading.
[#438](https://github.com/mattermost/desktop/issues/438)

#### Windows
 - Fixed an issue where `file://` protocol was not working. Note that localhost URLs are not yet supported.
[#579](https://github.com/mattermost/desktop/issues/579)

### Known Issues

#### All Platforms
 - [Clicking on a video preview opens another Mattermost window in addition to downloading the file](https://github.com/mattermost/desktop/issues/792).
 - [Insecure connection produces hundreds of log messages](https://github.com/mattermost/desktop/issues/569).

#### Windows
 - [App window doesn't save "floating" app position](https://github.com/mattermost/desktop/issues/617).
 - [Windows 7] [Sometimes app tries to render a page inside the app instead of in a new browser tab when clicking links](https://github.com/mattermost/desktop/issues/369).
 - [Windows 10] [Incorrect task name in Windows 10 startup list](https://github.com/mattermost/desktop/issues/559).
 - [Mattermost UI sometimes bleeds over a file explorer](https://github.com/mattermost/desktop/issues/753).
 - [When auto-starting the desktop app, the application window is included in Windows tab list](https://github.com/mattermost/desktop/issues/738).

#### Mac
 - The application crashes when a file upload dialog is canceled without closing Quick Look.
 - [When the app auto-starts, app page opens on screen instead of being minimized to Dock](https://github.com/mattermost/desktop/issues/583).

#### Linux (Beta)
 - [Ubuntu - 64 bit] [Right clicking taskbar icon and choosing **Quit** only minimizes the app](https://github.com/mattermost/desktop/issues/90#issuecomment-233712183)
 - [Ubuntu - 64 bit] [Direct message notification sometimes comes as a streak of line instead of a pop up](https://github.com/mattermost/platform/issues/3589)

### Contributors

Many thanks to all our contributors. In alphabetical order:

 - [Autre31415](https://github.com/Autre31415), [dmeza](https://github.com/dmeza), [hmhealey](https://github.com/hmhealey), [jasonblais](https://github.com/jasonblais), [kethinov](https://github.com/kethinov), [lieut-data](https://github.com/lieut-data), [lip-d](https://github.com/lip-d), [mkraft](https://github.com/mkraft), [yuya-oc](https://github.com/yuya-oc)

----

## Release v4.0.1

Release date: March 28, 2018

This release contains multiple security updates for Windows, Mac and Linux, and it is highly recommended that users upgrade to this version.

### Architectural Changes
 - Minor version upgrade of Electron from v1.7.11 to v1.7.13. Electron is the underlying technology used to build the Desktop apps.

### Bug Fixes

#### All Platforms
 - Disabled Certificate Transparency verification that produced unnecessary certificate errors.
 [#743](https://github.com/mattermost/desktop/pull/743)

----

## Release v4.0.0

Release date: January 29, 2018

This release contains multiple security updates for Windows, Mac and Linux, and it is highly recommended that users upgrade to this version.

### Improvements

#### All Platforms
 - Added a dialog to allow the user to reopen the desktop app if it quits unexpectedly.
 [#626](https://github.com/mattermost/desktop/pull/626)
 - Mattermost animation icon is now displayed when loading a page, instead of a blank screen.
 [#490](https://github.com/mattermost/desktop/issues/490)
 - Added a dialog to request permissions to show desktop notifications or to use microphone and video for [video calls](https://docs.mattermost.com/deployment/webrtc.html) from untrusted origins.
 [#609](https://github.com/mattermost/desktop/pull/609)
 - The "Saved" indicator now appears for both Server Management and App Options on the Settings page.
 [#500](https://github.com/mattermost/desktop/issues/500)
 - Close button on the Settings page now has a hover effect.
[#439](https://github.com/mattermost/desktop/issues/439)
 - Added new admin configuration settings ([#586](https://github.com/mattermost/desktop/pull/586) & [#633](https://github.com/mattermost/desktop/pull/633)) for
   - Disabling server management where the user cannot add or edit the server URL.
   [#600](https://github.com/mattermost/desktop/pull/600)
   - Setting one or more pre-configured server URLs for the end user.
   [#594](https://github.com/mattermost/desktop/pull/594)
   - Customizing the link in **Help > Learn More..**.
   [#593](https://github.com/mattermost/desktop/pull/593)

#### Windows
 - Added support for protocol deep linking where the desktop app opens via `mattermost://` link if app is already installed.
 [#616](https://github.com/mattermost/desktop/pull/616)
 - Added the ability to more easily whitelabel the Mattermost taskbar icon on custom builds.
 [#592](https://github.com/mattermost/desktop/pull/592)

#### Mac
 - Added support for protocol deep linking where the desktop app opens via `mattermost://` link if app is already installed.
 [#616](https://github.com/mattermost/desktop/pull/616)
 - Added `Ctrl+Tab` and `Ctrl+Shift+Tab` shortcuts to switch between server tabs,
 [#512](https://github.com/mattermost/desktop/issues/512)
 - Added the option to bounce the Dock icon when receiving a notification.
 [#514](https://github.com/mattermost/desktop/issues/514)

### Architectural Changes
 - Major version upgrade of Electron from v1.6.11 to v1.7.11. Electron is the underlying technology used to build the Desktop apps.
 [#602](https://github.com/mattermost/desktop/pull/602)
 - The app now uses CSS to style the user interface. Styles are also divided to React's inline `style` and CSS.
 [#540](https://github.com/mattermost/desktop/pull/540)
 - Yarn is now used to manage dependencies across Windows, Mac and Linux builds.
 [#485](https://github.com/mattermost/desktop/issues/485)
 - Build is now run automatically before packaging the apps with `npm run package`.
 [#590](https://github.com/mattermost/desktop/pull/590)
 - Removed hardcoded product name references.
 [#599](https://github.com/mattermost/desktop/pull/599)
 - Added an `rm` command to `npm`, which removes all dynamically generated files to make it easy to reset the app between builds and branches.
 [#597](https://github.com/mattermost/desktop/pull/597)

### Bug Fixes

#### All Platforms
 - Fixed the close button of the Settings page not working on first installation.
 [#552](https://github.com/mattermost/desktop/issues/552)
 - Fixed the app publisher referring to Yuya Ochiai instead of Mattermost, Inc.
 [#542](https://github.com/mattermost/desktop/issues/542)
 - Fixed font size not always persisting across app restarts.
 [#564](https://github.com/mattermost/desktop/issues/564)
 - Fixed an automatic reloading of the app when a DNS or network error page is manually reloaded with CTRL/CMD+R.
 [#573](https://github.com/mattermost/desktop/issues/573)
 - Fixed an issue where changing font size caused rendering issues on next restart.
 [#334](https://github.com/mattermost/desktop/issues/334)
 - Fixed an issue where after adding a server on the Settings page, focus remained on the "Add new server" link.
 [#446](https://github.com/mattermost/desktop/issues/446)
 - Fixed an issue where SAML certificate file couldn't be uploaded from the file upload dialog.
 [#497](https://github.com/mattermost/desktop/issues/497)

#### Windows
 - Fixed desktop notifications not working when the window was minimized from an inactive state.
 [#522](https://github.com/mattermost/desktop/issues/522)
 - Fixed the uninstaller not removing all files correctly.
 [#551](https://github.com/mattermost/desktop/issues/551)

#### Mac
 - Fixed an issue where after uploading a file, focus wasn't put back to the text box.
 [#341](https://github.com/mattermost/desktop/issues/341)
 - Fixed a mis-aligned `+` button in the server tab bar.
 [#541](https://github.com/mattermost/desktop/issues/541)

#### Linux
 - Fixed the main window not being minimized when the app is launched via "Start app on Login" option.
 [#570](https://github.com/mattermost/desktop/issues/570)

### Known Issues

#### All Platforms
 - [Insecure connection produces hundreds of log messages](https://github.com/mattermost/desktop/issues/569)

#### Windows
 - [App window doesn't save "floating" app position](https://github.com/mattermost/desktop/issues/617)
 - [Windows 7] [Sometimes the app tries to render the page inside the app instead of in a new browser tab when clicking links](https://github.com/mattermost/desktop/issues/369)
 - [Windows 10] [Incorrect task name in Windows 10 startup list](https://github.com/mattermost/desktop/issues/559)

#### Mac
 - The application crashes when a file upload dialog is canceled without closing Quick Look
 - [When the app auto-starts, app page opens on screen instead of being minimized to Dock](https://github.com/mattermost/desktop/issues/583)
 - [You have to click twice when a window is out of focus to have actions performed](https://github.com/mattermost/desktop/issues/534)

#### Linux (Beta)
 - [Ubuntu - 64 bit] [Right clicking taskbar icon and choosing **Quit** only minimizes the app](https://github.com/mattermost/desktop/issues/90#issuecomment-233712183)
 - [Ubuntu - 64 bit] [Direct message notification sometimes comes as a streak of line instead of a pop up](https://github.com/mattermost/platform/issues/3589)

### Contributors

Many thanks to all our contributors. In alphabetical order:

 - [csduarte](https://github.com/csduarte), [dmeza](https://github.com/dmeza), [jasonblais](https://github.com/jasonblais), [jarredwitt](https://github.com/jarredwitt), [wvds](https://github.com/wvds), [yuya-oc](https://github.com/yuya-oc)

----

## Release v3.7.1

Release date: August 30, 2017

This release contains a security update for Windows, Mac and Linux, and it is highly recommended that users upgrade to this version.

### Improvements and Bug Fixes

#### Windows

 - Client no longer freezes intermittently, such as when receiving desktop notifications. [#494](https://github.com/mattermost/desktop/issues/494), [#520](https://github.com/mattermost/desktop/issues/520)
 - [Windows 8.1/10] Added support for running the desktop app across monitors of different DPI. [#357](https://github.com/mattermost/desktop/issues/357)
 - [Windows 7/8] Clicking on a desktop notification now opens the message. [#67](https://github.com/mattermost/desktop/issues/67)

----

## Release v3.7.0

Release date: May 9, 2017

### Improvements

#### All Platforms
 - Added an inline spell checker for English, French, German, Spanish, and Dutch. [#225](https://github.com/mattermost/desktop/issues/225)
 - Removed an obsolete "Display secure content only" option, following an [upgrade of the Electron app to Chrome v56](https://github.com/electron/electron/commit/2e0780308c7ef2258422efd34c968091d7cd5b65). [#469](https://github.com/mattermost/desktop/pull/469)
 - Reset app window position when restoring it off-screen from a minimized state. [#471](https://github.com/mattermost/desktop/issues/471)
 - Improved page loading and app view rendering. [#515](https://github.com/mattermost/desktop/pull/515)

#### Windows
 - [Windows 7/8] Added support for sound when a desktop notification is received. [#467](https://github.com/mattermost/desktop/issues/467)
 - Removed obsolete support for Japanese fonts.
 - The application window now respects 125% display resolution. [#489](https://github.com/mattermost/desktop/pull/489)

### Bug Fixes

#### All Platforms
 - An extra row is no longer added after switching channels with CTRL/CMD+K shortcut. [#426](https://github.com/mattermost/desktop/issues/426)
 - Fixed an issue where an unexpected extra app window opened after clicking a public link of an uploaded file. [#390](https://github.com/mattermost/desktop/issues/390)
 - Fixed JavaScript errors when refreshing the page. [#440](https://github.com/mattermost/desktop/issues/440), [#448](https://github.com/mattermost/desktop/issues/448)
 - Fixed vertical alignment of the Add Server "+" button in the server tab bar. [#460](https://github.com/mattermost/desktop/issues/460)

#### Windows
 - Focus is now set to the next top-level window after closing the main app window. [#430](https://github.com/mattermost/desktop/issues/430)
 - Fixed an issue where the app remained in the ["classic" ALT+TAB window switcher](http://www.askvg.com/how-to-get-windows-xp-styled-classic-alttab-screen-in-windows-vista-and-7/) after closing the main app window. [#431](https://github.com/mattermost/desktop/issues/431)

#### Mac
 - Fixed an issue where the application was not available on the Dock after a computer reboot. [#411](https://github.com/mattermost/desktop/issues/411)
 - Fixed an issue where Quick Look couldn't be closed after opening the file upload dialog. [#498](https://github.com/mattermost/desktop/issues/498)

#### Linux (Beta)
 - Fixed an issue where the setting was not saved after changing the tray icon theme. [#456](https://github.com/mattermost/desktop/issues/456)

### Known Issues

#### All Platforms
 - [If you click twice on the tab bar, and then attempt to use the "Zoom in/out" to change font size, the app window doesn't render properly](https://github.com/mattermost/desktop/issues/334)
 - [Holding down CTRL, SHIFT or ALT buttons and clicking a channel opens a new application window](https://github.com/mattermost/desktop/issues/406)
 - [Unable to upload a SAML certificate file from the file upload dialog](https://github.com/mattermost/desktop/issues/497)

#### Windows
 - [Windows 7] [Sometimes the app tries to render the page inside the app instead of in a new browser tab when clicking links](https://github.com/mattermost/desktop/issues/369)

#### Mac
 - [After uploading a file with a keyboard shortcut, focus isn't set back to the message box](https://github.com/mattermost/desktop/issues/341)
 - The application crashes when a file upload dialog is canceled without closing Quick Look.

#### Linux (Beta)
 - [Ubuntu - 64 bit] [Right clicking taskbar icon and choosing **Quit** only minimizes the app](https://github.com/mattermost/desktop/issues/90#issuecomment-233712183)
 - [Ubuntu - 64 bit] [Direct message notification comes as a streak of line instead of a pop up](https://github.com/mattermost/platform/issues/3589)

### Contributors

Many thanks to all our contributors. In alphabetical order:

 - [jasonblais](https://github.com/jasonblais), [jnugh](https://github.com/jnugh), [yuya-oc](https://github.com/yuya-oc)

Thanks also to those who reported bugs that benefited the release, in alphabetical order:

- [esethna](https://github.com/esethna) ([#524](https://github.com/mattermost/desktop/issues/524)), [hanzei](https://github.com/hanzei) ([#523](https://github.com/mattermost/desktop/issues/523))

----

## Release v3.6.0

Release date: February 28, 2017

Upgrading to Mattermost server 3.6 or later is recommended, as new features for the desktop app have been added following the release of the team sidebar.

### Improvements
 - Added support for unread indicators following the release of team sidebar in Mattermost server 3.6
 - Removed a confusing `CTRL/CMD+S` shortcut for searching within a Mattermost team
 - Added support for SAML OneLogin and Google authentication for Enterprise users
 - Switching to a server from the system tray icon, from "Window" menu bar item, or through `CTRL/CMD+{n}` shortcut now works while viewing the Settings page
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
