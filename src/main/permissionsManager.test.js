// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {dialog} from 'electron';

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
    },
    dialog: {
        showMessageBox: jest.fn(),
    },
}));

jest.mock('common/utils/url', () => ({
    parseURL: jest.fn(),
    isTrustedURL: jest.fn(),
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
    beforeEach(() => {
        MainWindow.get.mockReturnValue({webContents: {id: 1}});
        ViewManager.getViewByWebContentsId.mockImplementation((id) => {
            if (id === 2) {
                return {view: {server: {url: new URL('http://anyurl.com')}}};
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
    });

    afterEach(() => {
        jest.resetAllMocks();
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
        await permissionsManager.handlePermissionRequest({id: 4}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
        expect(cb).toHaveBeenCalledWith(false);
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
        await permissionsManager.handlePermissionRequest({id: 2}, 'fullscreen', cb, {securityOrigin: 'http://anyurl.com'});
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
        dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 0}));
        await permissionsManager.handlePermissionRequest({id: 2}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
        expect(permissionsManager.json['http://anyurl.com'].media.allowed).toBe(true);
        expect(permissionsManager.writeToFile).toHaveBeenCalled();
        expect(cb).toHaveBeenCalledWith(true);
    });

    it('should pop dialog and deny if the user denies', async () => {
        const permissionsManager = new PermissionsManager('anyfile.json');
        permissionsManager.writeToFile = jest.fn();
        const cb = jest.fn();
        dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 1}));
        await permissionsManager.handlePermissionRequest({id: 2}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
        expect(permissionsManager.json['http://anyurl.com'].media.allowed).toBe(false);
        expect(permissionsManager.writeToFile).toHaveBeenCalled();
        expect(cb).toHaveBeenCalledWith(false);
    });

    it('should pop dialog and deny permanently if the user chooses', async () => {
        const permissionsManager = new PermissionsManager('anyfile.json');
        permissionsManager.writeToFile = jest.fn();
        const cb = jest.fn();
        dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 2}));
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
        dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 0}));
        await Promise.all([
            permissionsManager.handlePermissionRequest({id: 2}, 'notifications', cb, {securityOrigin: 'http://anyurl.com'}),
            permissionsManager.handlePermissionRequest({id: 2}, 'notifications', cb, {securityOrigin: 'http://anyurl.com'}),
            permissionsManager.handlePermissionRequest({id: 2}, 'notifications', cb, {securityOrigin: 'http://anyurl.com'}),
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
        dialog.showMessageBox.mockReturnValue(Promise.resolve({response: 0}));
        await permissionsManager.handlePermissionRequest({id: 2}, 'media', cb, {securityOrigin: 'http://anyurl.com'});
        expect(dialog.showMessageBox).toHaveBeenCalled();
    });
});
