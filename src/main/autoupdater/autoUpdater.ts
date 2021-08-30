// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {dialog, ipcMain, app, nativeImage} from 'electron';
import log from 'electron-log';
import {autoUpdater, UpdateInfo} from 'electron-updater';

import {displayUpgrade, displayRestartToUpgrade} from 'main/notifications';

import * as WindowManager from '../windows/windowManager';

import {CANCEL_UPGRADE, UPDATE_AVAILABLE} from 'common/communication';

//const NEXT_NOTIFY = 86400000; // 24 hours
//const NEXT_CHECK = 3600000;
const NEXT_CHECK = 60000; // todo: remove me
const NEXT_NOTIFY = 60000;

log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = false;

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_48.png');
const appIcon = nativeImage.createFromPath(appIconURL);

/** to test this during development
 * add the following to electron-builder.json in the publish entry
    {
      "provider": "generic",
      "url": "http://localhost:8000"
    },
 * create a packaged build, copy that to a directory B (I usually do a third C copy to be able to go back without packaging again)
 * upgrade the package.json version
 * package a second copy of the app
 * on release dir setup an http server (using `python -m SimpleHTTPServer` should match the above entry)
 * start the app from directory B
 * if the app upgraded and you want to repeat, simply copy C into B if you did the C step, if not, package again.
 * yeah, it is a time consuming process :( improve this doc if you find a way to go faster.
**/

export default class UpdateManager {
    hooksSetup: boolean;
    lastNotification?: NodeJS.Timeout;
    lastCheck?: NodeJS.Timeout;
    versionAvailable?: string;

    constructor() {
        this.hooksSetup = false;
    }

    setupHooks = (): void => {
        if (this.hooksSetup) {
            return;
        }
        autoUpdater.on('error', (err: Error) => {
            log.error(`[Mattermost] There was an error while trying to update: ${err}`);
        });

        autoUpdater.on('update-available', (info: UpdateInfo) => {
            autoUpdater.removeListener('update-not-available', this.displayNoUpgrade);
            this.versionAvailable = info.version;
            log.info(`[Mattermost] available version ${info.version}`);
            this.notify();
        });

        autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
            this.versionAvailable = info.version;
            log.info(`[Mattermost] downloaded version ${info.version}`);
            this.handleUpgrade();
        });

        ipcMain.on(CANCEL_UPGRADE, () => {
            log.info('[Mattermost] User Canceled upgrade');
        });

        // we only set this once.
        this.hooksSetup = true;
    }

    notify = (): void => {
        WindowManager.sendToRenderer(UPDATE_AVAILABLE, this.versionAvailable);

        if (this.lastNotification) {
            clearTimeout(this.lastNotification);
        }
        this.lastNotification = setTimeout(this.notify, NEXT_NOTIFY);
        displayUpgrade(this.versionAvailable || 'unknown', this.handleUpdate);
    }

    handleUpdate = (): void => {
        if (this.lastCheck) {
            clearTimeout(this.lastCheck);
        }
        dialog.showMessageBox({
            title: 'New desktop version available',
            message: `A new version of the Mattermost Desktop App (version ${this.versionAvailable}) is available to download and install`,
            buttons: ['Download new version', 'Remind me Later'],
            type: 'info',
            defaultId: 0,
            cancelId: 1,
            icon: appIcon,
        }).then(({response}) => {
            if (response === 0) {
                autoUpdater.downloadUpdate();
            }
        });
    }

    handleUpgrade = (): void => {
        if (this.lastNotification) {
            clearTimeout(this.lastNotification);
        }
        displayRestartToUpgrade(this.versionAvailable || '', () => {
            autoUpdater.quitAndInstall();
        });
    }

    displayNoUpgrade = (): void => {
        const version = app.getVersion();
        dialog.showMessageBox({
            title: 'You\'re up to date',
            type: 'info',
            buttons: ['OK'],
            icon: appIcon,
            message: `You are using the latest version of the Mattermost Desktop App (version ${version}). You'll be notified when a new version is available to install`,
        });
    }

    checkForUpdates = (manually: boolean): void => {
        this.setupHooks();
        if (this.lastCheck) {
            clearTimeout(this.lastCheck);
        }
        if (!this.lastNotification || manually) {
            if (manually) {
                autoUpdater.once('update-not-available', this.displayNoUpgrade);
            }
            autoUpdater.checkForUpdates().catch((reason) => {
                log.error(`[Mattermost] Failed to check for updates: ${reason}`);
            });
            this.lastCheck = setTimeout(() => this.checkForUpdates(false), NEXT_CHECK);
        }
    }
}
