# Mattermost Desktop
[Mattermost](https://mattermost.com) is an open source platform for secure collaboration across the entire software development lifecycle. This repo is for the native desktop application that's built on [Electron](http://electron.atom.io/); it runs on Windows, Mac, and Linux.

Originally contributed as "electron-mattermost" by Yuya Ochiai.

![screenshot_20](https://user-images.githubusercontent.com/7205829/136107976-7a894c9e-290a-490d-8501-e5fdbfc3785a.png)

[![Circle CI](https://circleci.com/gh/mattermost/desktop.svg?style=shield)](https://circleci.com/gh/mattermost/desktop)

## Features

### Desktop integration
* Tabs for multiple teams across multiple servers
* Desktop Notifications
  * Windows 10: Toast
  * Windows 7-8.1: Popup like Toast
  * OS X: Notification Center
  * Linux: [libnotify](http://electron.atom.io/docs/v0.36.0/tutorial/desktop-environment-integration/#linux)
* Badges for unread channels and mentions
* Installs as a native application

### Pre-packaged
You don't have to install any other software.
Packages are available on the [releases page](http://github.com/mattermost/desktop/releases).

## Usage

### Installation
Detailed guides are available at [docs.mattermost.com](https://docs.mattermost.com/install/desktop-app-install.html).

1. Download a file from the [downloads page](https://mattermost.com/download).
2. Launch `Mattermost` in the unarchived folder.
3. On the first launch, please input name and URL for your Mattermost server. For example, `myserver : https://mattermost.example.com`.

### Quit
Ctrl or Command + Q to quit.

### Configuration
You can show the dialog from menu bar.

Configuration will be saved into Electron's userData directory:

* `%APPDATA%\Mattermost` on Windows
* `~/Library/Application Support/Mattermost` on OS X
* `~/.config/Mattermost` on Linux

A custom data directory location can be specified with:

* `Mattermost.exe --args --data-dir C:\my-mattermost-data` on Windows
* `open /Applications/Mattermost.app/ --args --data-dir ~/my-mattermost-data/` on macOS 
* `./mattermost-desktop --args --data-dir ~/my-mattermost-data/` on Linux

*When you upgrade from electron-mattermost, please copy `config.json` from `electron-mattermost`.
Otherwise, you have to configure again.*

### Proxy
Normally, the application will follow your system settings to use a proxy, or you can set up a proxy by the following command line options.

* `--proxy-server=<SERVER>:<PORT>`
* `--proxy-pac-url=<URL>`

On Windows, please make sure to add `--` before options. For example, `Mattermost.exe -- --proxy-server=...`.

## Custom App Deployments
Our [docs provide a guide](https://docs.mattermost.com/deployment/desktop-app-deployment.html) on how to customize and distribute your own Mattermost Desktop App, including how to distribute the official Windows Desktop App silently to end users, pre-configured with the server URL and other app settings.

## Contributing
Please see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Development
Please see [docs/development.md](./docs/development.md).


