// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {dialog, shell, systemPreferences} from 'electron';

import CallsWidgetWindow from 'app/callsWidgetWindow';
import MainWindow from 'app/mainWindow/mainWindow';
import WebContentsManager from 'app/views/webContentsManager';
import Config from 'common/config';
import {parseURL, isTrustedURL} from 'common/utils/url';

import {PermissionsManager} from './permissionsManager';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFile: jest.fn(),
}));

jest.mock('electron', () => ({
    app: {
        name: 'Mattermost',
    },
    ipcMain: {
        on: jest.fn(),
        handle: jest.fn(),
    },
    dialog: {
        showMessageBox: jest.fn(),
    },
    shell: {
        openExternal: jest.fn(),
    },
    systemPreferences: {
        getMediaAccessStatus: jest.fn(),
        askForMediaAccess: jest.fn(),
    },
}));

jest.mock('common/utils/url', () => ({
    parseURL: jest.fn(),
    isTrustedURL: jest.fn(),
}));

jest.mock('common/config', () => ({
    registryData: {
        servers: [
            {url: 'http://gposerver.com'},
        ],
    },
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));
jest.mock('common/views/viewManager', () => ({
    getViewByWebContentsId: jest.fn(),
    on: jest.fn(),
}));
jest.mock('app/callsWidgetWindow', () => ({
    isCallsWidget: jest.fn(),
    getViewURL: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
    on: jest.fn(),
}));

jest.mock('app/views/webContentsManager', () => ({
    getViewByWebContentsId: jest.fn(),
    getServerURLByViewId: jest.fn(),
}));

describe('main/PermissionsManager', () => {
    describe('setForServer', () => {
        beforeEach(() => {
            systemPreferences.getMediaAccessStatus.mockClear();
            systemPreferences.askForMediaAccess.mockClear();
        });

        if (process.platform !== 'linux') {
            it('should ask for media permission when is not granted but the user explicitly granted it', () => {
                systemPreferences.getMediaAccessStatus.mockReturnValue('denied');
                const permissionsManager = new PermissionsManager('anyfile.json');
                permissionsManager.setForServer({url: new URL('http://anyurl.com')}, {media: {allowed: true}});
                expect(systemPreferences.askForMediaAccess).toHaveBeenNthCalledWith(1, 'microphone');
                expect(systemPreferences.askForMediaAccess).toHaveBeenNthCalledWith(2, 'camera');
            });
        }

        if (process.platform !== 'linux') {
            it('PM-U06: should not call askForMediaAccess when OS has already granted access', () => {
                systemPreferences.getMediaAccessStatus.mockReturnValue('granted');
                const permissionsManager = new PermissionsManager('anyfile.json');
                permissionsManager.setForServer(
                    {url: new URL('http://anyurl.com')},
                    {media: {allowed: true}},
                );
                expect(systemPreferences.askForMediaAccess).not.toHaveBeenCalled();
            });
        }

        it('PM-U07: should skip all media access checks on Linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'linux', configurable: true});
            try {
                const permissionsManager = new PermissionsManager('anyfile.json');
                permissionsManager.setForServer(
                    {url: new URL('http://anyurl.com')},
                    {media: {allowed: true}},
                );
                expect(systemPreferences.getMediaAccessStatus).not.toHaveBeenCalled();
                expect(systemPreferences.askForMediaAccess).not.toHaveBeenCalled();
            } finally {
                Object.defineProperty(process, 'platform', {value: originalPlatform, configurable: true});
            }
        });
    });

    it('PM-U05: should open the correct ms-settings URLs for Windows camera and microphone', () => {
        const {ipcMain} = require('electron');
        // eslint-disable-next-line no-new
        new PermissionsManager('anyfile.json');

        const cameraHandler = ipcMain.on.mock.calls.find(([ch]) => ch === 'open-windows-camera-preferences')?.[1];
        const micHandler = ipcMain.on.mock.calls.find(([ch]) => ch === 'open-windows-microphone-preferences')?.[1];

        cameraHandler();
        expect(shell.openExternal).toHaveBeenCalledWith('ms-settings:privacy-webcam');

        micHandler();
        expect(shell.openExternal).toHaveBeenCalledWith('ms-settings:privacy-microphone');
    });

    describe('handlePermissionRequest', () => {
        const env = process.env;

        beforeEach(() => {
            process.env = {...env, NODE_ENV: 'jest'};
            MainWindow.get.mockReturnValue({webContents: {id: 1}});
            WebContentsManager.getViewByWebContentsId.mockImplementation((id) => {
                if (id === 2) {
                    return {id: 'view-2'};
                }
                if (id === 4) {
                    return {id: 'view-4'};
                }
                if (id === 5) {
                    return {id: 'view-5'};
                }

                return null;
            });
            WebContentsManager.getServerURLByViewId.mockImplementation((viewId) => {
                if (viewId === 'view-2') {
                    return new URL('http://anyurl.com');
                }
                if (viewId === 'view-4') {
                    return new URL('http://gposerver.com');
                }
                if (viewId === 'view-5') {
                    return new URL('http://wrongurl.com');
                }
                return null;
            });
            CallsWidgetWindow.isCallsWidget.mockReturnValue(false);
            parseURL.mockImplementation((url) => {
                try {
                    return new URL(url);
                } catch {
                    return null;
                }
            });
            isTrustedURL.mockImplementation((url, baseURL) => url.toString().startsWith(baseURL.toString()));
            Config.registryData.servers = [
                {
                    url: 'http://gposerver.com',
                },
            ];
        });

        afterEach(() => {
            jest.resetAllMocks();
            process.env = env;
        });

        it('should deny if the permission is not supported', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest({}, 'some-other-permission', cb, {securityOrigin: 'http://anyurl.com'});
            expect(cb).toHaveBeenCalledWith(false);
        });

        it('should allow if the request came from the main window', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest({id: 1}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
            expect(cb).toHaveBeenCalledWith(true);
        });

        it('should deny if the URL is malformed', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest({id: 2}, 'media', cb, {securityOrigin: 'abadurl!?'});
            expect(cb).toHaveBeenCalledWith(false);
        });

        it('should deny if the server URL can not be found', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest({id: 5}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
            expect(cb).toHaveBeenCalledWith(false);
        });

        it('should allow if the URL is a GPO configured server', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest({id: 4}, 'media', cb, {securityOrigin: 'http://gposerver.com'});
            expect(cb).toHaveBeenCalledWith(true);
        });

        it('should deny if the URL is not trusted', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest({id: 2}, 'media', cb, {securityOrigin: 'http://wrongurl.com'});
            expect(cb).toHaveBeenCalledWith(false);
        });

        it('should allow if dialog is not required', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest({id: 2}, 'fullscreen', cb, {requestingUrl: 'http://anyurl.com'});
            expect(cb).toHaveBeenCalledWith(true);
        });

        it('should allow if already confirmed by user', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            permissionsManager.json = {
                'http://anyurl.com': {
                    media: {
                        allowed: true,
                    },
                },
            };
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest({id: 2}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
            expect(cb).toHaveBeenCalledWith(true);
        });

        it('should deny if set to permanently deny', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            permissionsManager.json = {
                'http://anyurl.com': {
                    media: {
                        alwaysDeny: true,
                    },
                },
            };
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest({id: 2}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
            expect(cb).toHaveBeenCalledWith(false);
        });

        it('should pop dialog and allow if the user allows, should save to file', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            permissionsManager.writeToFile = jest.fn();
            const cb = jest.fn();
            dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 2}));
            await permissionsManager.handlePermissionRequest({id: 2}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
            expect(permissionsManager.json['http://anyurl.com'].media.allowed).toBe(true);
            expect(permissionsManager.writeToFile).toHaveBeenCalled();
            expect(cb).toHaveBeenCalledWith(true);
        });

        it('should pop dialog and deny if the user denies', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            permissionsManager.writeToFile = jest.fn();
            const cb = jest.fn();
            dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 0}));
            await permissionsManager.handlePermissionRequest({id: 2}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
            expect(permissionsManager.json['http://anyurl.com'].media.allowed).toBe(false);
            expect(permissionsManager.writeToFile).toHaveBeenCalled();
            expect(cb).toHaveBeenCalledWith(false);
        });

        it('should pop dialog and deny permanently if the user chooses', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            permissionsManager.writeToFile = jest.fn();
            const cb = jest.fn();
            dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 1}));
            await permissionsManager.handlePermissionRequest({id: 2}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
            expect(permissionsManager.json['http://anyurl.com'].media.allowed).toBe(false);
            expect(permissionsManager.json['http://anyurl.com'].media.alwaysDeny).toBe(true);
            expect(permissionsManager.writeToFile).toHaveBeenCalled();
            expect(cb).toHaveBeenCalledWith(false);
        });

        it('should only pop dialog once upon multiple permission checks', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            permissionsManager.writeToFile = jest.fn();
            const cb = jest.fn();
            dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 2}));
            await Promise.all([
                permissionsManager.handlePermissionRequest({id: 2}, 'notifications', cb, {requestingUrl: 'http://anyurl.com'}),
                permissionsManager.handlePermissionRequest({id: 2}, 'notifications', cb, {requestingUrl: 'http://anyurl.com'}),
                permissionsManager.handlePermissionRequest({id: 2}, 'notifications', cb, {requestingUrl: 'http://anyurl.com'}),
            ]);
            expect(dialog.showMessageBox).toHaveBeenCalledTimes(1);
        });

        it('should still pop dialog for media requests from the servers origin', async () => {
            WebContentsManager.getViewByWebContentsId.mockImplementation((id) => {
                if (id === 2) {
                    return {id: 'view-2'};
                }
                return null;
            });
            WebContentsManager.getServerURLByViewId.mockImplementation((viewId) => {
                if (viewId === 'view-2') {
                    return new URL('http://anyurl.com/subpath');
                }
                return null;
            });
            const permissionsManager = new PermissionsManager('anyfile.json');
            permissionsManager.writeToFile = jest.fn();
            const cb = jest.fn();
            dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 2}));
            await permissionsManager.handlePermissionRequest({id: 2}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
            expect(dialog.showMessageBox).toHaveBeenCalled();
        });

        it('should pop dialog for external applications', async () => {
            const permissionsManager = new PermissionsManager('anyfile.json');
            permissionsManager.writeToFile = jest.fn();
            const cb = jest.fn();
            dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 2}));
            await permissionsManager.handlePermissionRequest({id: 2}, 'openExternal', cb, {requestingUrl: 'http://anyurl.com', externalURL: 'ms-excel://differenturl.com'});
            expect(dialog.showMessageBox).toHaveBeenCalled();
        });

        it('PM-U01: should allow Calls widget request when pre-granted and not consult WebContentsManager', async () => {
            CallsWidgetWindow.isCallsWidget.mockReturnValue(true);
            CallsWidgetWindow.getViewURL.mockReturnValue(new URL('http://anyurl.com'));
            isTrustedURL.mockReturnValue(true);
            const permissionsManager = new PermissionsManager('anyfile.json');
            permissionsManager.json = {
                'http://anyurl.com': {screenShare: {allowed: true}},
            };
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest(
                {id: 2},
                'screenShare',
                cb,
                {requestingUrl: 'http://anyurl.com'},
            );
            expect(cb).toHaveBeenCalledWith(true);
            expect(WebContentsManager.getViewByWebContentsId).not.toHaveBeenCalled();
            expect(CallsWidgetWindow.getViewURL).toHaveBeenCalled();
        });

        it('PM-U02: should deny Calls widget request when getViewURL returns null', async () => {
            CallsWidgetWindow.isCallsWidget.mockReturnValue(true);
            CallsWidgetWindow.getViewURL.mockReturnValue(null);
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest(
                {id: 2},
                'screenShare',
                cb,
                {requestingUrl: 'http://anyurl.com'},
            );
            expect(cb).toHaveBeenCalledWith(false);
            expect(WebContentsManager.getViewByWebContentsId).not.toHaveBeenCalled();
        });

        it('PM-U03: should show dialog for fullscreen from an external origin', async () => {
            dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 2}));
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest(
                {id: 2},
                'fullscreen',
                cb,
                {requestingUrl: 'http://youtube.com'},
            );
            expect(dialog.showMessageBox).toHaveBeenCalled();
            expect(cb).toHaveBeenCalledWith(true);
        });

        it('PM-U04: should deny without crash when main window is null at dialog time', async () => {
            MainWindow.get.mockReturnValue(null);
            const permissionsManager = new PermissionsManager('anyfile.json');
            const cb = jest.fn();
            await permissionsManager.handlePermissionRequest(
                {id: 2},
                'notifications',
                cb,
                {requestingUrl: 'http://anyurl.com'},
            );
            expect(cb).toHaveBeenCalledWith(false);
            expect(dialog.showMessageBox).not.toHaveBeenCalled();
        });
    });
});
