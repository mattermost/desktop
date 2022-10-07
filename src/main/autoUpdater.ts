// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {dialog, ipcMain, app, nativeImage} from 'electron';
import log from 'electron-log';

import {autoUpdater, CancellationToken, ProgressInfo, UpdateInfo} from 'electron-updater';

import {localizeMessage} from 'main/i18nManager';
import {displayUpgrade, displayRestartToUpgrade} from 'main/notifications';

import {
    CANCEL_UPGRADE,
    UPDATE_AVAILABLE,
    UPDATE_DOWNLOADED,
    CHECK_FOR_UPDATES,
    UPDATE_SHORTCUT_MENU,
    UPDATE_PROGRESS,
    NO_UPDATE_AVAILABLE,
    CANCEL_UPDATE_DOWNLOAD,
    UPDATE_REMIND_LATER,
} from 'common/communication';
import Config from 'common/config';

const NEXT_NOTIFY = 86400000; // 24 hours
const NEXT_CHECK = 3600000; // 1 hour

log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.disableWebInstaller = true;

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_with_spacing_32.png');
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

export class UpdateManager {
    cancellationToken?: CancellationToken;
    lastNotification?: NodeJS.Timeout;
    lastCheck?: NodeJS.Timeout;
    versionAvailable?: string;
    versionDownloaded?: string;

    constructor() {
        this.cancellationToken = new CancellationToken();

        autoUpdater.on('error', (err: Error) => {
            log.error(`[Mattermost] There was an error while trying to update: ${err}`);
        });

        autoUpdater.on('update-available', (info: UpdateInfo) => {
            autoUpdater.removeListener('update-not-available', this.displayNoUpgrade);
            this.versionAvailable = info.version;
            ipcMain.emit(UPDATE_SHORTCUT_MENU);
            log.info(`[Mattermost] available version ${info.version}`);
            this.notify();
        });

        autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
            this.versionDownloaded = info.version;
            ipcMain.emit(UPDATE_SHORTCUT_MENU);
            log.info(`[Mattermost] downloaded version ${info.version}`);
            this.notifyDownloaded();
        });

        autoUpdater.on('download-progress', (progress: ProgressInfo) => {
            ipcMain.emit(UPDATE_PROGRESS, null, progress);
        });

        ipcMain.on(CANCEL_UPGRADE, () => {
            log.info('[Mattermost] User Canceled upgrade');
        });

        ipcMain.on(CHECK_FOR_UPDATES, () => {
            this.checkForUpdates(true);
        });

        ipcMain.on(CANCEL_UPDATE_DOWNLOAD, this.handleCancelDownload);
        ipcMain.on(UPDATE_REMIND_LATER, this.handleRemindLater);
    }

    notify = (): void => {
        if (this.lastNotification) {
            clearTimeout(this.lastNotification);
        }
        this.lastNotification = setTimeout(this.notify, NEXT_NOTIFY);
        if (this.versionDownloaded) {
            this.notifyDownloaded();
        } else if (this.versionAvailable) {
            this.notifyUpgrade();
        }
    }

    notifyUpgrade = (): void => {
        ipcMain.emit(UPDATE_AVAILABLE, null, this.versionAvailable);
        displayUpgrade(this.versionAvailable || 'unknown', this.handleDownload);
    }

    notifyDownloaded = (): void => {
        ipcMain.emit(UPDATE_DOWNLOADED, null, this.versionDownloaded);
        displayRestartToUpgrade(this.versionDownloaded || 'unknown', this.handleUpdate);
    }

    handleDownload = (): void => {
        if (this.lastCheck) {
            clearTimeout(this.lastCheck);
        }
        autoUpdater.downloadUpdate(this.cancellationToken);
    }

    handleCancelDownload = (): void => {
        this.cancellationToken?.cancel();
        this.cancellationToken = new CancellationToken();
    }

    handleRemindLater = (): void => {
        // TODO
    }

    handleOnQuit = (): void => {
        if (this.versionDownloaded) {
            autoUpdater.quitAndInstall(true, false);
        }
    }

    handleUpdate = (): void => {
        autoUpdater.quitAndInstall();
    }

    displayNoUpgrade = (): void => {
        const version = app.getVersion();
        ipcMain.emit(NO_UPDATE_AVAILABLE);
        dialog.showMessageBox({
            title: app.name,
            icon: appIcon,
            message: localizeMessage('main.autoUpdater.noUpdate.message', 'You\'re up to date'),
            type: 'info',
            buttons: [localizeMessage('label.ok', 'OK')],
            detail: localizeMessage('main.autoUpdater.noUpdate.detail', 'You are using the latest version of the {appName} Desktop App (version {version}). You\'ll be notified when a new version is available to install.', {appName: app.name, version}),
        });
    }

    checkForUpdates = (manually: boolean): void => {
        if (!Config.canUpgrade) {
            log.info('auto updates are disabled');
            return;
        }
        if (this.lastCheck) {
            clearTimeout(this.lastCheck);
        }
        if (!this.lastNotification || manually) {
            if (manually) {
                autoUpdater.once('update-not-available', this.displayNoUpgrade);
            }
            autoUpdater.checkForUpdates().then((result) => {
                if (!result?.updateInfo) {
                    ipcMain.emit(NO_UPDATE_AVAILABLE);
                }
            }).catch((reason) => {
                ipcMain.emit(NO_UPDATE_AVAILABLE);
                log.error(`[Mattermost] Failed to check for updates: ${reason}`);
            });
            this.lastCheck = setTimeout(() => this.checkForUpdates(false), NEXT_CHECK);
        }
    }
}

const updateManager = new UpdateManager();
export default updateManager;
