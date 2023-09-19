// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    PermissionRequestHandlerHandlerDetails,
    WebContents,
    app,
    dialog,
    ipcMain,
} from 'electron';

import {UPDATE_PATHS} from 'common/communication';
import JsonFileManager from 'common/JsonFileManager';
import {Logger} from 'common/log';
import {t} from 'common/utils/util';
import {isTrustedURL, parseURL} from 'common/utils/url';

import {permissionsJson} from 'main/constants';
import {localizeMessage} from 'main/i18nManager';
import ViewManager from 'main/views/viewManager';
import CallsWidgetWindow from 'main/windows/callsWidgetWindow';
import MainWindow from 'main/windows/mainWindow';

const log = new Logger('PermissionsManager');

// supported permission types
const supportedPermissionTypes = [
    'media',
    'geolocation',
    'notifications',
    'fullscreen',
    'openExternal',
    'clipboard-sanitized-write',
];

// permissions that require a dialog
const authorizablePermissionTypes = [
    'media',
    'geolocation',
    'notifications',
];

type Permissions = {
    [origin: string]: {
        [permission: string]: {
            allowed: boolean;
            alwaysDeny?: boolean;
        };
    };
};

export class PermissionsManager extends JsonFileManager<Permissions> {
    private inflightPermissionChecks: Set<string>;

    constructor(file: string) {
        super(file);

        this.inflightPermissionChecks = new Set();
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
            details.securityOrigin ?? details.requestingUrl,
        ));
    }

    doPermissionRequest = async (
        webContentsId: number,
        permission: string,
        requestingURL: string,
    ) => {
        log.debug('doPermissionRequest', requestingURL, permission);

        // is the requested permission type supported?
        if (!supportedPermissionTypes.includes(permission)) {
            return false;
        }

        // allow if the request is coming from the local renderer process instead of the remote one
        const mainWindow = MainWindow.get();
        if (mainWindow && webContentsId === mainWindow.webContents.id) {
            return true;
        }

        const parsedURL = parseURL(requestingURL);
        if (!parsedURL) {
            return false;
        }

        let serverURL;
        if (CallsWidgetWindow.isCallsWidget(webContentsId)) {
            serverURL = CallsWidgetWindow.getViewURL();
        } else {
            serverURL = ViewManager.getViewByWebContentsId(webContentsId)?.view.server.url;
        }

        if (!serverURL) {
            return false;
        }

        // is the requesting url trusted?
        if (!isTrustedURL(parsedURL, serverURL)) {
            return false;
        }

        // For certain permission types, we need to confirm with the user
        if (authorizablePermissionTypes.includes(permission)) {
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
                return false;
            }
            this.inflightPermissionChecks.add(permissionKey);

            // Show the dialog to ask the user
            const {response} = await dialog.showMessageBox(mainWindow, {
                title: localizeMessage('main.permissionsManager.checkPermission.dialog.title', 'Permission Requested'),
                message: localizeMessage(`main.permissionsManager.checkPermission.dialog.message.${permission}`, '{appName} ({url}) is requesting the "{permission}" permission.', {appName: app.name, url: parsedURL.origin, permission}),
                detail: localizeMessage(`main.permissionsManager.checkPermission.dialog.detail.${permission}`, 'Would you like to grant {appName} this permission?', {appName: app.name}),
                type: 'question',
                buttons: [
                    localizeMessage('label.allow', 'Allow'),
                    localizeMessage('label.deny', 'Deny'),
                    localizeMessage('label.denyPermanently', 'Deny Permanently'),
                ],
            });

            // Save their response
            const newPermission = {
                allowed: response === 0,
                alwaysDeny: (response === 2) ? true : undefined,
            };
            this.json[parsedURL.origin] = {
                ...this.json[parsedURL.origin],
                [permission]: newPermission,
            };
            this.writeToFile();

            this.inflightPermissionChecks.delete(permissionKey);

            if (response > 0) {
                return false;
            }
        }

        // We've checked everything so we're okay to grant the remaining cases
        return true;
    }
}

t('main.permissionsManager.checkPermission.dialog.message.media');
t('main.permissionsManager.checkPermission.dialog.message.geolocation');
t('main.permissionsManager.checkPermission.dialog.message.notifications');
t('main.permissionsManager.checkPermission.dialog.detail.media');
t('main.permissionsManager.checkPermission.dialog.detail.geolocation');
t('main.permissionsManager.checkPermission.dialog.detail.notifications');

let permissionsManager = new PermissionsManager(permissionsJson);

ipcMain.on(UPDATE_PATHS, () => {
    permissionsManager = new PermissionsManager(permissionsJson);
});

export default permissionsManager;
