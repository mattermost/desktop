// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    FilesystemPermissionRequest,
    IpcMainInvokeEvent,
    MediaAccessPermissionRequest,
    OpenExternalPermissionRequest,
    PermissionRequest,
    WebContents} from 'electron';
import {
    app,
    dialog,
    ipcMain,
    shell,
    systemPreferences,
} from 'electron';

import {
    GET_MEDIA_ACCESS_STATUS,
    OPEN_WINDOWS_CAMERA_PREFERENCES,
    OPEN_WINDOWS_MICROPHONE_PREFERENCES,
    UPDATE_PATHS,
} from 'common/communication';
import Config from 'common/config';
import JsonFileManager from 'common/JsonFileManager';
import {Logger} from 'common/log';
import type {MattermostServer} from 'common/servers/MattermostServer';
import {isTrustedURL, parseURL} from 'common/utils/url';
import {t} from 'common/utils/util';
import {permissionsJson} from 'main/constants';
import {localizeMessage} from 'main/i18nManager';
import ViewManager from 'main/views/viewManager';
import CallsWidgetWindow from 'main/windows/callsWidgetWindow';
import MainWindow from 'main/windows/mainWindow';

import type {Permissions} from 'types/permissions';

const log = new Logger('PermissionsManager');

// supported permission types
const supportedPermissionTypes = [
    'media',
    'geolocation',
    'notifications',
    'fullscreen',
    'openExternal',
    'clipboard-sanitized-write',
    'screenShare',
];

// permissions that require a dialog
const authorizablePermissionTypes = [
    'media',
    'geolocation',
    'notifications',
    'openExternal',
    'screenShare',
];

type PermissionsByOrigin = {
    [origin: string]: Permissions;
};

type PermissionRequestHandlerHandlerDetails = PermissionRequest & FilesystemPermissionRequest & MediaAccessPermissionRequest & OpenExternalPermissionRequest;

export class PermissionsManager extends JsonFileManager<PermissionsByOrigin> {
    private inflightPermissionChecks: Map<string, Promise<boolean>>;

    constructor(file: string) {
        super(file);

        this.inflightPermissionChecks = new Map();

        ipcMain.on(OPEN_WINDOWS_CAMERA_PREFERENCES, this.openWindowsCameraPreferences);
        ipcMain.on(OPEN_WINDOWS_MICROPHONE_PREFERENCES, this.openWindowsMicrophonePreferences);
        ipcMain.handle(GET_MEDIA_ACCESS_STATUS, this.handleGetMediaAccessStatus);
    }

    handlePermissionRequest = async (
        webContents: WebContents,
        permission: string,
        callback: (granted: boolean) => void,
        details: PermissionRequestHandlerHandlerDetails,
    ) => {
        callback(await this.doPermissionRequest(
            webContents.id,
            permission,
            details,
        ));
    };

    getForServer = (server: MattermostServer): Permissions | undefined => {
        return this.getValue(server.url.origin);
    };

    setForServer = (server: MattermostServer, permissions: Permissions) => {
        if (permissions.media?.allowed && (process.platform === 'win32' || process.platform === 'darwin')) {
            this.checkMediaAccess('microphone');
            this.checkMediaAccess('camera');
        }

        return this.setValue(server.url.origin, permissions);
    };

    private checkMediaAccess = (mediaType: 'microphone' | 'camera') => {
        if (systemPreferences.getMediaAccessStatus(mediaType) !== 'granted') {
            // For windows, the user needs to enable these manually
            if (process.platform === 'win32') {
                log.warn(`${mediaType} access disabled in Windows settings`);
            }

            systemPreferences.askForMediaAccess(mediaType);
        }
    };

    doPermissionRequest = async (
        webContentsId: number,
        permission: string,
        details: PermissionRequestHandlerHandlerDetails,
    ) => {
        log.debug('doPermissionRequest', permission, details);

        // is the requested permission type supported?
        if (!supportedPermissionTypes.includes(permission)) {
            return false;
        }

        // allow if the request is coming from the local renderer process instead of the remote one
        const mainWindow = MainWindow.get();
        if (mainWindow && webContentsId === mainWindow.webContents.id) {
            return true;
        }

        let url = details.requestingUrl;
        if (permission === 'media' && details.securityOrigin) {
            url = details.securityOrigin;
        }

        const parsedURL = parseURL(url);
        if (!parsedURL) {
            return false;
        }

        let serverURL: URL | undefined;
        if (CallsWidgetWindow.isCallsWidget(webContentsId)) {
            serverURL = CallsWidgetWindow.getViewURL();
        } else {
            serverURL = ViewManager.getViewByWebContentsId(webContentsId)?.view.server.url;
        }

        if (!serverURL) {
            return false;
        }

        // For GPO servers, we always allow permissions since they are trusted
        const serverHref = serverURL.href;
        if (Config.registryData?.servers?.some((s) => parseURL(s.url)?.href === serverHref)) {
            return true;
        }

        // Exception for embedded videos such as YouTube
        // We still want to ask permission to do this though
        const isExternalFullscreen = permission === 'fullscreen' && parsedURL.origin !== serverURL.origin;

        // is the requesting url trusted?
        if (!(isTrustedURL(parsedURL, serverURL) || (permission === 'media' && parsedURL.origin === serverURL.origin) || isExternalFullscreen)) {
            return false;
        }

        // For certain permission types, we need to confirm with the user
        if (authorizablePermissionTypes.includes(permission) || isExternalFullscreen) {
            const currentPermission = this.json[parsedURL.origin]?.[permission];

            // If previously allowed, just allow
            if (currentPermission?.allowed) {
                return true;
            }

            // If denied permanently, deny
            if (currentPermission?.alwaysDeny) {
                return false;
            }

            if (!mainWindow) {
                return false;
            }

            // Make sure we don't pop multiple dialogs for the same permission check
            const permissionKey = `${parsedURL.origin}:${permission}`;
            if (this.inflightPermissionChecks.has(permissionKey)) {
                return this.inflightPermissionChecks.get(permissionKey)!;
            }

            const promise = new Promise<boolean>((resolve) => {
                if (process.env.NODE_ENV === 'test') {
                    resolve(false);
                    return;
                }

                // Show the dialog to ask the user
                dialog.showMessageBox(mainWindow, {
                    title: localizeMessage('main.permissionsManager.checkPermission.dialog.title', 'Permission Requested'),
                    message: localizeMessage(`main.permissionsManager.checkPermission.dialog.message.${permission}`, '{appName} ({url}) is requesting the "{permission}" permission.', {appName: app.name, url: parsedURL.origin, permission, externalURL: details.externalURL}),
                    detail: localizeMessage(`main.permissionsManager.checkPermission.dialog.detail.${permission}`, 'Would you like to grant {appName} this permission?', {appName: app.name}),
                    type: 'question',
                    buttons: [
                        localizeMessage('label.deny', 'Deny'),
                        localizeMessage('label.denyPermanently', 'Deny Permanently'),
                        localizeMessage('label.allow', 'Allow'),
                    ],
                }).then(({response}) => {
                    // Save their response
                    const newPermission = {
                        allowed: response === 2,
                        alwaysDeny: (response === 1) ? true : undefined,
                    };
                    this.json[parsedURL.origin] = {
                        ...this.json[parsedURL.origin],
                        [permission]: newPermission,
                    };
                    this.writeToFile();

                    this.inflightPermissionChecks.delete(permissionKey);

                    if (response < 2) {
                        resolve(false);
                    }

                    resolve(true);
                });
            });

            this.inflightPermissionChecks.set(permissionKey, promise);
            return promise;
        }

        // We've checked everything so we're okay to grant the remaining cases
        return true;
    };

    private openWindowsCameraPreferences = () => shell.openExternal('ms-settings:privacy-webcam');
    private openWindowsMicrophonePreferences = () => shell.openExternal('ms-settings:privacy-microphone');
    private handleGetMediaAccessStatus = (event: IpcMainInvokeEvent, mediaType: 'microphone' | 'camera' | 'screen') => systemPreferences.getMediaAccessStatus(mediaType);
}

t('main.permissionsManager.checkPermission.dialog.message.media');
t('main.permissionsManager.checkPermission.dialog.message.geolocation');
t('main.permissionsManager.checkPermission.dialog.message.notifications');
t('main.permissionsManager.checkPermission.dialog.message.openExternal');
t('main.permissionsManager.checkPermission.dialog.message.screenShare');
t('main.permissionsManager.checkPermission.dialog.detail.media');
t('main.permissionsManager.checkPermission.dialog.detail.geolocation');
t('main.permissionsManager.checkPermission.dialog.detail.notifications');
t('main.permissionsManager.checkPermission.dialog.detail.openExternal');
t('main.permissionsManager.checkPermission.dialog.detail.screenShare');

let permissionsManager = new PermissionsManager(permissionsJson);

ipcMain.on(UPDATE_PATHS, () => {
    ipcMain.removeAllListeners(OPEN_WINDOWS_CAMERA_PREFERENCES);
    ipcMain.removeAllListeners(OPEN_WINDOWS_MICROPHONE_PREFERENCES);
    ipcMain.removeHandler(GET_MEDIA_ACCESS_STATUS);
    permissionsManager = new PermissionsManager(permissionsJson);
});

export default permissionsManager;
