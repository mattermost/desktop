# electron-mattermost
Desktop app for [Mattermost](http://www.mattermost.org/) that runs on [Electron](http://electron.atom.io/)


## Features

### Desktop integration
* Badges for unread channels
* Notification
  * Windows 10: Toast
  * Windows 7-8.1: Balloon
  * OS X: Notification Center
  * Linux: libnotify ([Electron's notification spec](http://electron.atom.io/docs/v0.35.0/tutorial/desktop-environment-integration/#linux))
* Tabs for multiple teams
* Resident application

### Pre-packaged
You don't have to install any other software.


## Usage

### Installation
1. Download and unarchive a file from [release page](http://github.com/yuya-oc/electron-mattermost/releases).
2. Launch `electron-mattermost` in the unarchived folder.
3. After first launching, please input URL for your Mattermost team. For exmaple, `http://mattermost.example.com/team`.

### Quit
Ctrl or Command + Q to quit.

### Configuration
Configuration will be saved into Electron's userData directory:
* `%APPDATA%\electron-mattermost` on Windows
* `~/Library/Application Support/electron-mattermost` on OS X
* `~/.config/electron-mattermost` on Linux


## Testing and Development
Node.js is required to test this app.

### Simple testing
1. Clone or download the source code.
2. Run `npm install`.
3. Run `npm start`.

When you edit **.jsx** files, please execute `npm run build` before `npm start`.

### Development
#### `npm run serve`
Reload the app automatically when you have saved source codes.

#### `npm test`
Run tests with Mocha.

## Packaging
You can package this app with following commands. Packages will be created in `release` directory.

```
$ npm run package (for your platform)
$ npm run package:windows (Requires Windows or Wine)
$ npm run package:osx (Requires OS X or Linux)
$ npm run package:linux
$ npm run package:all (Packages for all platform)
```
