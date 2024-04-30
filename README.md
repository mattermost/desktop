# Mattermost Desktop

[Mattermost](https://mattermost.com) is an open source platform for secure collaboration across the entire software development lifecycle. This repo is for the native desktop application that's built on [Electron](http://electron.atom.io/); it runs on Windows, Mac, and Linux.

Originally created as "electron-mattermost" by Yuya Ochiai.

![mm-desktop-screenshot](https://user-images.githubusercontent.com/52460000/146078917-e1ba8c1f-24e5-4613-8b4b-f3507422f4f2.png)

[![nightly-builds](https://github.com/mattermost/desktop/actions/workflows/nightly-builds.yaml/badge.svg)](https://github.com/mattermost/desktop/actions/workflows/nightly-builds.yaml)

## Features

### Desktop integration
* Server dropdown for access to multiple servers
* Dedicated tabs for Channels, Boards and Playbooks
* Desktop Notifications
* Badges for unread channels and mentions
* Deep Linking to open Mattermost links directly in the app
* Runs in background to reduce number of open windows

## Usage

### Installation
Detailed guides are available at [docs.mattermost.com](https://docs.mattermost.com/install/desktop-app-install.html).

1. Download a file from the [downloads page](https://mattermost.com/download/#mattermostApps) or from the [releases page](https://github.com/mattermost/desktop/releases).
2. Run the installer or unzip the archive.
3. Launch Mattermost from your Applications folder, menu, or the unarchived folder.
3. On the first launch, please enter a name and URL for your Mattermost server. For example, `https://mattermost.example.com`.

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

## Custom App Deployments
Our [docs provide a guide](https://docs.mattermost.com/deployment/desktop-app-deployment.html) on how to customize and distribute your own Mattermost Desktop App, including how to distribute the official Windows Desktop App silently to end users, pre-configured with the server URL and other app settings.

## Development and Making Contributions
Our [developer guide](https://developers.mattermost.com/contribute/desktop/) has detailed information on how to set up your development environment, develop, and test changes to the Desktop App.
