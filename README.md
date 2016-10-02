# <a href="http://www.mattermost.org/" target="_blank"><img width="50" src="https://raw.githubusercontent.com/mattermost/desktop/master/resources/icon.png"></a>Mattermost Desktop (beta)

Native desktop application for [Mattermost](http://www.mattermost.org/) running on Windows, Mac and Linux.

Originally created as "electron-mattermost" by Yuya Ochiai. Developed using [Electron](http://electron.atom.io/).

![Mattermost Desktop Screenshot](docs/20160309_mattermost-desktop.gif)


[![Circle CI](https://circleci.com/gh/mattermost/desktop.svg?style=svg)](https://circleci.com/gh/mattermost/desktop)

## Features

### Desktop integration
* Tabs for multiple teams across multiple servers
* Desktop Notifications
  * Windows 10: Toast
  * Windows 7-8.1: Balloon (fallback behavior, so lesser support)
  * OS X: Notification Center
  * Linux: [libnotify](http://electron.atom.io/docs/v0.36.0/tutorial/desktop-environment-integration/#linux)
* Badges for unread channels and mentions
* Installs as native application

### Pre-packaged
You don't have to install any other software.
Packages are available on the [releases page](http://github.com/mattermost/desktop/releases).

## Usage

### Installation
Detailed guides are available at [docs/setup.md](docs/setup.md).

1. Download and unarchive a file from [release page](http://github.com/mattermost/desktop/releases).
2. Launch `Mattermost` in the unarchived folder.
3. After first launching, please input name and URL for your Mattermost team. For example, `myteam : https://mattermost.example.com/team`.

### Quit
Ctrl or Command + Q to quit.

### Configuration
You can show the dialog from menu bar.
(Please press Alt key to show the menu bar if it disappers.)

Configuration will be saved into Electron's userData directory:

* `%APPDATA%\Mattermost` on Windows
* `~/Library/Application Support/Mattermost` on OS X
* `~/.config/Mattermost` on Linux

*When you upgrade from electron-mattermost, please copy `config.json` from `electron-mattermost`.
Otherwise, you have to configure again.*

### Proxy
Normally, the application will follow your system settings to use proxy.
Or you can set proxy by following command line options.

* `--proxy-server=<SERVER>:<PORT>`
* `--proxy-pac-url=<URL>`

## Contributing
Please see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Development
Please see [docs/development.md](./docs/development.md).
