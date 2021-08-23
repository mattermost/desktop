// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {dialog, ipcMain, app, nativeImage} from 'electron';
import log from 'electron-log';
import {autoUpdater, UpdateCheckResult, UpdateInfo} from 'electron-updater';

import {displayUpgrade} from 'main/notifications';

import * as WindowManager from '../windows/windowManager';

import {CANCEL_UPGRADE, UPDATE_AVAILABLE} from 'common/communication';

const NEXT_NOTIFY = 86400000; // 24 hours
//const NEXT_CHECK = 3600000;
const NEXT_CHECK = 60000; // todo: remove me

log.transports.file.level = 'info';
autoUpdater.logger = log;

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_48.png');
const appIcon = nativeImage.createFromPath(appIconURL);

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
        log.info('[Mattermost] setting up hooks');
        autoUpdater.on('error', (err: Error) => {
            log.error(`[Mattermost] There was an error while trying to update: ${err}`);
        });

        autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
            this.versionAvailable = info.version;
            log.info(`[Mattermost] downloaded version ${info.version}`);
            this.notify();
        });

        ipcMain.on(CANCEL_UPGRADE, () => {
            log.info('[Mattermost] User Canceled upgrade');
        });

        // we only set this once.
        this.hooksSetup = true;
    }

    notify = (): void => {
        log.info('[Mattermost] notifying user');
        WindowManager.sendToRenderer(UPDATE_AVAILABLE, this.versionAvailable);

        if (this.lastNotification) {
            clearTimeout(this.lastNotification);
        }
        log.info('[Mattermost] setup next notification');
        this.lastNotification = setTimeout(this.notify, NEXT_NOTIFY);
        log.info('[Mattermost] notifying');
        displayUpgrade(this.versionAvailable || 'unknown', this.handleUpgrade);
    }

    handleUpgrade = (): void => {
        log.info('[Mattermost] Performing update');
        if (this.lastCheck) {
            clearTimeout(this.lastCheck);
        }
        dialog.showMessageBox({
            title: 'New desktop version available',
            message: `A new version of the Mattermost Desktop App (version ${this.versionAvailable}) is available to install`,
            buttons: ['Restart and Update', 'Remind me Later'],
            type: 'info',
            defaultId: 0,
            cancelId: 1,
            icon: appIcon,
        }).then(({response}) => {
            if (response === 1) {
                autoUpdater.quitAndInstall();
            }
        });
    }

    checkForUpdates = (manually: boolean): void => {
        this.setupHooks();
        if (this.lastCheck) {
            clearTimeout(this.lastCheck);
        }
        if (!this.lastNotification) {
            const version = app.getVersion();
            autoUpdater.checkForUpdates().catch((reason) => {
                log.error(`[Mattermost] Failed to check for updates: ${reason}`);
            }).then((result: void | UpdateCheckResult) => {
                if (!result && manually) {
                    dialog.showMessageBox({
                        title: 'You\'re up to date',
                        type: 'info',
                        buttons: ['OK'],
                        icon: appIcon,
                        message: `You are using the latest version of the Mattermost Desktop App (version ${version}). You'll be notified when a new version is available to install`,
                    });
                }
            });
            this.lastCheck = setTimeout(() => this.checkForUpdates(false), NEXT_CHECK);
        }
    }
}
