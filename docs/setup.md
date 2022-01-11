# Mattermost Desktop Setup Guides

## Installation

### Windows

To set up the Mattermost desktop application for Windows 7, 8, and 10:

1. Download [the latest release](https://github.com/mattermost/desktop/releases) of Mattermost Desktop

   Find the file ending in `-win64.zip` if you're running a x64 version of Windows and `-win32.zip` if you're running an older 32-bit version.

2. From the `\Downloads` directory right-click on the file and select "Extract All..."

   - Change the extract folder from `C:\Users\(currentuser)\Downloads\mattermost-desktop-1.1.1-win64` to `C:\Users\(currentuser)\AppData\Local` where `(currentuser)` will be the name of your user account.
   - Check the "Show extracted files when complete" checkbox.
   - Click the "Extract" button.
   - Look for the new application directory at `C:\Users\(currentuser)\AppData\Local\mattermost-desktop...`.
   - Remove the version number by renaming the `mattermost-desktop...` application directory to `mattermost-desktop`.
   - If a `mattermost-desktop` directory already exists then you are upgrading Mattermost, and need to quit Mattermost if it is running and then delete the `mattermost-desktop` directory. After that you can rename the `mattermost-desktop...` directory to `mattermost-desktop`. Don't worry, no settings will be lost, they are stored elsewhere.

3. Go to the `\mattermost-desktop` application directory and find the file named `Mattermost`.

   - Right-click the file and select "Pin to Taskbar" to make the application available from your Windows task bar.
   - Right-click the file and select "Pin to Start Menu" to make the application available from your Windows Start menu.
   - Double-click the file to open the application.

### macOS

For OS X 10.11 El Capitan. For older versions of OS X the instruction are similar.

1. Download [the latest release](https://github.com/mattermost/desktop/releases) of Mattermost Desktop

   Find the file ending in `-osx.tar.gz`.

2. From the `/Downloads` directory double-click on the file."

   A new directory should be created on your Mac.

3. Go to `/mattermost-desktop...` directory and right-click on `Mattermost` package and select "Open"

   If you see a dialog to confirm the application, select "Open".

   You should see a new application called **Mattermost Desktop** open.

### Linux

#### Ubuntu

For Ubuntu 16.04.

1. Download [the latest release](https://github.com/mattermost/desktop/releases) of Mattermost Desktop

   Find the file ending in `-linux-*.deb`.

2. Open a terminal and execute the command

   `sudo dpkg -i mattermost-desktop-<VERSION>-<ARCH>.deb`

3. Open Dash (located at top left corner) and input `mattermost`, then click `Mattermost` icon

   You should see a new application called **Mattermost Desktop** open.

#### Other distributions

1. Download [the latest release](https://github.com/mattermost/desktop/releases) of Mattermost Desktop

   Find the file ending in `-linux-*.tar.gz`

2. Extract the archive, then execute `Mattermost` which is located inside the extracted directory

3. If you need the Desktop Entry, please execute `create_desktop_file.sh`. It creates `Mattermost.desktop`.

    Please refer to https://wiki.archlinux.org/index.php/Desktop_entries

## Configuration

You have to configure the application to interact with your teams.

1. Open **Settings Page**. If you use the application for the first time, **Settings Page** should appear automatically.
   You can also access the **Settings Page** by the following methods:

   - Windows: Press `Alt` key to bring up the menu at the top of the window, then click `File -> Settings`.
   - OS X: Click `Mattermost` from the menu at the top of the screen, then click `Preferences...`.
   - Linux: Click `File -> Settings` on the menu.
   - All : right-click on tray icon and click `Settings` or `Preferences...`.

2. Press `+` button next to the "Teams" label.

3. For each Mattermost team you'd like to use, enter its **Name** and **URL** then click **Add**

4. Click **Save** to save your setting

You're now ready to use **Mattermost Desktop** to interact with multiple teams from one desktop application.

## Quit

- Windows, Linux: `CTRL+Q`
- macOS: `CMD+Q`

## Help

The Mattermost desktop application offers:

- Connectivity to one or more Mattermost team sites and multiple Mattermost servers
- Shortcuts from Start Menu and Windows Task Bar
- Icon notifications from Windows Task Bar
- Desktop notifications

See the Mattermost [help documentation](http://docs.mattermost.com/help/getting-started/signing-in.html) for how to use the Mattermost team site.

## Settings Page

The Settings Page is available from the **File** menu under **Settings** (Click `Alt` to show the menu if it's not visible). This page manages connections to team sites and other settings.

- **Add a Team Site**:
   1. Under **Teams** section, enter **Name** for team name to show in top tab
   2. Enter **URL** for the team site location. For example: `https://example.com/teamname` then click **Add**.
- **Delete a Team Site**:
   - Delete a Team Site by clicking the "x" next to the URL of the team site you wish to delete.
- **Options**
   - **Hide Menu Bar** (Windows, Linux)
      - This option hides the menu bar. Press "Alt" to show it.
   - **Show Icon on Menu Bar** (macOS)
      - The icon appears on the menu bar to indicate whether there are new messages or mentions.
   - **Allow insecure contents**
      - If your team is hosted on `https://`, images with `http://` are not rendered by default.
        This option allows such images to be rendered, but please be careful for security.
   - **Start app on login** (Windows, Linux)
      - This option starts the application when you login.
   - **Leave app running in notification area when the window is closed** (macOS, Linux)
      - This option hides the window from the dock, if the window is closed
   - **Toggle window visibility when clicking on the tray icon** (Windows)
      - If checked, then a click on the system tray icon leads to a toggling of the minimized/maximized state of the window
   - **Show the red badge for unread messages.** (Windows, macOS)
      - If this is checked it will show the red dot on your task bar when you have unread messages.

## Menu Bar

If **Hide Menu Bar** option is enabled, use the `ALT` key to toggle the menu on and off.

Menu options are listed below (shortcut keys are listed in brackets, `CTRL` becomes `CMD` on macOS):

- **File**
  - **About Mattermost** - Show version information for Mattermost desktop application
  - **Settings** (CTRL+,) - Open setting menu to add new team sites and configure shortcut key options
  - **Quit** (CTRL+Q) - Exit the application
- **Edit**
  - **Undo** (CTRL+Z) - Reverse previous action
  - **Redo** (CTRL+SHIFT+Z, CTRL+Y on Windows) - Replay most recent action
  - **Cut** (CTRL+X) - Cut selected text
  - **Copy** (CTRL+C) - Copy selected text
  - **Paste** (CTRL+V) - Paste text from clipboard
  - **Select All** (CTRL+A) - Select all text in input box
  - **Search in Team** (CTRL+S) - Put cursor in search box to search in the current team
- **View**
  - **Find..** (CTRL+F)- Find in page
  - **Reload** (CTRL+R) - Reload page from the server
  - **Clear Cache and Reload** (CTRL+SHIFT+R) - Clear cached content in application and reload page
  - **Toggle Full Screen** (F11) - Toggle application from window to full screen and back
  - **Toggle Developer Tools** (CTRL+SHIFT+I) - Turn on and off sidebar showing developer tools
  - **Actual Size** (Ctrl+0) - Reset zoom level
  - **Zoom In** (CTRL++) - Enlarge the rendered contents size
  - **Zoom In** (CTRL+-) - Shrink the rendered contents size
- **History**
  - **Back** (ALT+LEFT, CMD+`[` on macOS) - Go back to previous web page in the current tab
  - **Forward** (ALT+RIGHT, CMD+] on macOS) - Go forward to next web page in the current tab
- **Window**
  - **Close** (CTRL+W) - Close the window (On Window and Linux, the main window is minimized)
  - **Minimize** (CTRL+M) - Minimize the window
  - ***Team Name*** (CTRL+{1-9}) - Open the *n*-th tab
  - **Select Next Team** (CTRL+TAB, ALT+CMD+RIGHT) - Open the right tab
  - **Select Previous Team** (CTRL+SHIFT+TAB, ALT+CMD+LEFT) - Open the left tab
- **Help**
  - ***Learn More*** Links to the official mattermost documentation
  - ***Version*** Indicate the application version

## Notifications

Mattermost lets users configure [desktop notifications](http://docs.mattermost.com/help/getting-started/configuring-notifications.html#desktop-notifications) to alert users to new events in a team site.

For the Mattermost Windows application, these appear as balloon notifications from the task bar on Windows 7 and Windows 8.1, and as a "toast" pop-up on Windows 10.

## Start Menu and Task Bar shortcuts (Windows)

If pinned to the Windows Start Menu in the setup procedure, a shortcut to the Mattermost desktop application should be available from the Start Menu by pressing the Windows Key.

If pinned to the Windows Task Bar in the setup procedure, a shortcut to the Mattermost desktop application should be available from the Windows Task Bar.
