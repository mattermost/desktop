# Electron-Mattermost Setup Guides

## Step-by-step Windows setup

To set up the Mattermost desktop application for Windows 7, 8 and 10: 

1. Download [the latest release](https://github.com/yuya-oc/electron-mattermost/releases) of electron-attermost  

   Find the file ending in `-win64.zip` if you're running a x64 version of Windows and `-win32.zip` if you're running an older 32-bit version.

2. From the `/Downloads` directory right-click on the file and select "Extract All..."

   A new directory should be created on your PC.

3. Go to `/electron-mattermost...` directory and find the file named `electron-mattermost` 

   - Right-click the file and select "Pin to Taskbar" to make the application available from your Windows task bar. 
   - Right-click the file and select "Pin to Start Menu" to make the application available from your Windows Start menu. 
   - Double-click the file to open the application. 

4. After opening the application, press `Alt` key to bring up the menu at the top of the window, then click `File -> Settings`

5. For each Mattermost team you'd like to use, enter its **Name** and **URL** then click **Add**

6. Click **Save** to save your setting

   You're now ready to use electron-mattermost to interact with multiple teams from one desktop application

   To quit, use `Ctrl+Q`

## Help 

See the Mattermost [help documention](http://docs.mattermost.com/help/getting-started/signing-in.html) for how to use the Mattermost team site. 

The Mattermost application works in place of a web browser to access your different Mattermost Team Sites, and is controled by a menu bar available from the top of the application. 

### Top Menu: 

Click the `Alt` key to toggle the menu on and off. 

Below lists menu options (shortcut keys are listed in brackets): 

- **File**
  - **About electron-mattermost** - Shows version information for Mattermost desktop application 
  - **Settings** - Opens setting menu to add new team sites and configure shortcut key options
  - **Quit** (Ctrl+Q) - Exits the application 
- **Edit**
  - **Undo** (Ctrl+Z) - Reverses previous action 
  - **Redo** (Ctrl+Shift+Z) - Replays most recent action
  - **Cut** (Ctrl+X) - Cuts selected text 
  - **Copy** (Ctrl+C) - Copies selected text
  - **Paste** (Ctrl+V) - Pastes text from clipboard
  - **Select All** (Ctrl+A) - Select all text in input box
- **View**
  - **Reload** (Ctrl+R) - Reload page from the server
  - **Clear Cache and Reload** (Ctrl+Shift+R) - Clear cached content in application and reload page
  - **Toggle Full Screen** (F11) - Toggle application from window to full screen and back
  - **Toggle Developer Tools** (Ctrl+Shift+I) - Turn on and off sidebar showing developer tools

## Step-by-step OS X setup
For OS X 10.11 El Capitan. An older version of OS X has similar way.

1. Download [the latest release](https://github.com/yuya-oc/electron-mattermost/releases) of electron-mattermost  

   Find the file ending in `-osx.tar.gz`.

2. From the `/Downloads` directory double-click on the file."

   A new directory should be created on your Mac.

3. Go to `/electron-mattermost...` directory and right-click on `electron-mattermost` package and select "Open"

   If you see a dialog to confirm the application, select "Open".

   You should see a new application called **electron-mattermost** open.

4. Click `electron-mattermost` from the menu at the top of the screen, then click `Settings`

5. For each Mattermost team you'd like to use, enter its **Name** and **URL** then click **Add**

6. Click **Save** to save your setting

   You're now ready to use electron-mattermost to interact with multiple teams from one desktop application

   To quit, use `Command+Q`
