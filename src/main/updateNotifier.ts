// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';
import path from 'path';

import {dialog, ipcMain, app, nativeImage, net, shell} from 'electron';
import electronIsDev from 'electron-is-dev';
import semver from 'semver';

import {
    UPDATE_AVAILABLE,
    CHECK_FOR_UPDATES,
    UPDATE_SHORTCUT_MENU,
    NO_UPDATE_AVAILABLE,
    OPEN_WINDOWS_STORE,
    DOWNLOAD_UPDATE_MANUALLY,
    OPEN_UPDATE_GUIDE,
    GET_IS_MAC_APP_STORE,
    OPEN_MAC_APP_STORE,
    SKIP_VERSION,
} from 'common/communication';
import Config from 'common/config';
import buildConfig from 'common/config/buildConfig';
import {Logger} from 'common/log';
import downloadsManager from 'main/downloadsManager';
import {localizeMessage} from 'main/i18nManager';
import NotificationManager from 'main/notifications';

const NEXT_NOTIFY = 86400000; // 24 hours
const NEXT_CHECK = 3600000; // 1 hour

const log = new Logger('UpdateNotifier');

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_with_spacing_32.png');
const appIcon = nativeImage.createFromPath(appIconURL);

interface UpdateInfo {
    version: string;
}

export class UpdateNotifier {
    lastNotification?: NodeJS.Timeout;
    lastCheck?: NodeJS.Timeout;
    versionAvailable?: string;

    constructor() {
        ipcMain.on(CHECK_FOR_UPDATES, () => this.checkForUpdates(true));
        ipcMain.on(OPEN_WINDOWS_STORE, this.openWindowsStore);
        ipcMain.on(DOWNLOAD_UPDATE_MANUALLY, this.downloadUpdateManually);
        ipcMain.on(OPEN_UPDATE_GUIDE, this.openUpdateGuide);
        ipcMain.handle(GET_IS_MAC_APP_STORE, () => this.isMacAppStore());
        ipcMain.on(OPEN_MAC_APP_STORE, this.openMacAppStore);
        ipcMain.on(SKIP_VERSION, this.skipVersion);
    }

    onUpdateAvailable = (info: UpdateInfo): void => {
        this.versionAvailable = info.version;
        ipcMain.emit(UPDATE_SHORTCUT_MENU);
        log.info('New version available:', info.version);
        this.notify();
    };

    notify = (): void => {
        if (this.lastNotification) {
            clearTimeout(this.lastNotification);
        }
        this.lastNotification = setTimeout(this.notify, NEXT_NOTIFY);
        if (this.versionAvailable) {
            this.notifyUpgrade();
        }
    };

    notifyUpgrade = (): void => {
        ipcMain.emit(UPDATE_AVAILABLE, null, this.versionAvailable);
        NotificationManager.displayUpgrade(this.versionAvailable || 'unknown', this.handleDownloadLink);
    };

    handleDownloadLink = (): void => {
        log.info('User clicked update notification');
    };

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
    };

    checkForUpdates = (manually: boolean): void => {
        if (!Config.canUpgrade) {
            log.info('update checks are disabled');
            return;
        }
        if (this.lastCheck) {
            clearTimeout(this.lastCheck);
        }
        if (!this.lastNotification || manually) {
            this.performUpdateCheck(manually).then((updateInfo) => {
                if (updateInfo) {
                    const skippedVersions = Config.data?.skippedVersions || [];
                    if (!manually && skippedVersions.includes(updateInfo.version)) {
                        log.info('Version is skipped, not notifying', {version: updateInfo.version});
                        return;
                    }
                    this.onUpdateAvailable(updateInfo);
                } else {
                    ipcMain.emit(NO_UPDATE_AVAILABLE);
                    if (manually) {
                        this.displayNoUpgrade();
                    }
                }
            }).catch((reason) => {
                ipcMain.emit(NO_UPDATE_AVAILABLE);
                log.error('Failed to check for updates:', {reason});
            });
            this.lastCheck = setTimeout(() => this.checkForUpdates(false), NEXT_CHECK);
        }
    };

    performUpdateCheck = async (manually: boolean): Promise<UpdateInfo | null> => {
        log.info('Checking for updates', {manually});

        if (electronIsDev) {
            log.info('In development mode, skipping update check');
            return null;
        }

        const currentVersion = app.getVersion();
        const baseURL = buildConfig.updateNotificationURL;

        let filename = 'latest.txt';
        const versionMatch = currentVersion.match(/^[0-9]+\.[0-9]+\.[0-9]+-([^.]+)/);
        if (versionMatch) {
            filename = `${versionMatch[1]}.txt`;
        }

        const url = `${baseURL}/${filename}`;
        log.info('Fetching update info from', {url});

        try {
            const response = await net.fetch(url);

            if (!response.ok) {
                log.warn('Update check returned non-200 status', {statusCode: response.status});
                return null;
            }

            const remoteVersion = (await response.text()).trim();
            if (!remoteVersion) {
                log.warn('Empty version response');
                return null;
            }

            log.info('Remote version found', {remoteVersion, currentVersion});

            if (semver.gt(remoteVersion, currentVersion)) {
                log.info('New version available', {remoteVersion, currentVersion});
                return {version: remoteVersion};
            }

            log.info('No update available', {remoteVersion, currentVersion});
            return null;
        } catch (error) {
            log.error('Request error during update check', {error, url});
            return null;
        }
    };

    private openWindowsStore = (): void => {
        if (process.platform === 'win32' && buildConfig.windowsStoreUpdateURL) {
            shell.openExternal(buildConfig.windowsStoreUpdateURL);
        }
    };

    private openMacAppStore = (): void => {
        if (process.platform === 'darwin' && buildConfig.macAppStoreUpdateURL) {
            shell.openExternal(buildConfig.macAppStoreUpdateURL);
        }
    };

    private downloadUpdateManually = (): void => {
        if (!this.versionAvailable) {
            log.warn('No version available for download');
            return;
        }

        const version = this.versionAvailable;
        const baseURL = buildConfig.updateNotificationURL;
        const platform = process.platform;
        const arch = os.arch();

        switch (platform) {
        case 'win32':
            shell.openExternal(`${baseURL}/${version}/${this.getDownloadURL(version, 'win', 'msi', arch)}`);
            break;
        case 'darwin':
            shell.openExternal(`${baseURL}/${version}/${this.getDownloadURL(version, 'mac', 'dmg', arch)}`);
            break;
        default:
            log.error('Unsupported platform for manual download', {platform});
        }
    };

    private openUpdateGuide = (): void => {
        if (process.platform === 'linux') {
            shell.openExternal(buildConfig.linuxUpdateURL);
        }
    };

    private isMacAppStore = (): boolean => {
        // eslint-disable-next-line no-undef
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return Boolean(__IS_MAC_APP_STORE__);
    };

    private getDownloadURL = (version: string, platformName: string, fileExt: string, archName: string): string => {
        return `mattermost-desktop-${version}-${platformName}-${archName}.${fileExt}`;
    };

    private skipVersion = (): void => {
        if (!this.versionAvailable) {
            log.warn('No version available to skip');
            return;
        }

        const versionToSkip = this.versionAvailable;
        const skippedVersions = Config.data?.skippedVersions || [];

        if (skippedVersions.includes(versionToSkip)) {
            log.info('Version already skipped', {version: versionToSkip});
        } else {
            const updatedSkippedVersions = [...skippedVersions, versionToSkip];
            Config.set('skippedVersions', updatedSkippedVersions);
        }

        this.versionAvailable = undefined;
        if (this.lastNotification) {
            clearTimeout(this.lastNotification);
            this.lastNotification = undefined;
        }

        downloadsManager.removeUpdateBeforeRestart();
        ipcMain.emit(NO_UPDATE_AVAILABLE);
        log.info('Version skipped', {version: versionToSkip});
    };
}

const updateNotifier = new UpdateNotifier();
export default updateNotifier;
