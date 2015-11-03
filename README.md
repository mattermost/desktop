# electron-mattermost
Desktop app for [Mattermost](http://www.mattermost.org/) that runs on [Electron](http://electron.atom.io/)

## Features
* Badges for unread channels
* Desktop notification
* Stay in taskbar (Windows)

## Usage
1. Download and unarchive a file from [release page](http://github.com/yuya-oc/electron-mattermost/releases).
2. Launch electron-mattermost.exe or electron-mattermost.app
3. After first launching, please input URL for your Mattermost team. For exmaple, `http://mattermost.example.com/team`.
4. Ctrl or Command + Q to exit.

Configuration will be saved into Electron's userData directory:
* `%APPDATA%\electron-mattermost` on Windows
* `~/Library/Application Support/electron-mattermost` on OS X
* `~/.config/electron-mattermost` on Linux

## Testing
Node.js is required to test this app.

1. Clone or download the source code.
2. Run `npm install`.
3. Run `npm start`. (If you have gulp, `gulp serve` has live-reload.)
