// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {dialog, systemPreferences} from 'electron';

import Config from 'common/config';
import {parseURL, isTrustedURL} from 'common/utils/url';
import ViewManager from 'main/views/viewManager';
import CallsWidgetWindow from 'main/windows/callsWidgetWindow';
import MainWindow from 'main/windows/mainWindow';

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
        servers: [],
    },
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));
jest.mock('main/views/viewManager', () => ({
    getViewByWebContentsId: jest.fn(),
}));
jest.mock('main/windows/callsWidgetWindow', () => ({
    isCallsWidget: jest.fn(),
    getViewURL: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
}));

describe('main/PermissionsManager', () => {
    describe('setForServer', () => {
        if (process.platform !== 'linux') {
            it('should ask for media permission when is not granted but the user explicitly granted it', () => {
                systemPreferences.getMediaAccessStatus.mockReturnValue('denied');
                const permissionsManager = new PermissionsManager('anyfile.json');
                permissionsManager.setForServer({url: new URL('http://anyurl.com')}, {media: {allowed: true}});
                expect(systemPreferences.askForMediaAccess).toHaveBeenNthCalledWith(1, 'microphone');
                expect(systemPreferences.askForMediaAccess).toHaveBeenNthCalledWith(2, 'camera');
            });
        }
    });

    describe('handlePermissionRequest', () => {
        const env = process.env;

        beforeEach(() => {
            process.env = {...env, NODE_ENV: 'jest'};
            MainWindow.get.mockReturnValue({webContents: {id: 1}});
            ViewManager.getViewByWebContentsId.mockImplementation((id) => {
                if (id === 2) {
                    return {view: {server: {url: new URL('http://anyurl.com')}}};
                }
                if (id === 4) {
                    return {view: {server: {url: new URL('http://gposerver.com')}}};
                }

                return null;
            });
            CallsWidgetWindow.isCallsWidget.mockImplementation((id) => id === 3);
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
            ViewManager.getViewByWebContentsId.mockImplementation((id) => {
                if (id === 2) {
                    return {view: {server: {url: new URL('http://anyurl.com/subpath')}}};
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
    });
});
