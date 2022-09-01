// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {shell} from 'electron';

import urlUtils from 'common/utils/url';

import * as WindowManager from '../windows/windowManager';
import allowProtocolDialog from '../allowProtocolDialog';

import {WebContentsEventManager} from './webContentEvents';

jest.mock('electron', () => ({
    app: {},
    shell: {
        openExternal: jest.fn(),
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
        once: jest.fn(),
        show: jest.fn(),
        loadURL: jest.fn(),
        webContents: {
            setWindowOpenHandler: jest.fn(),
        },
    })),
}));

jest.mock('../allowProtocolDialog', () => ({}));
jest.mock('../windows/windowManager', () => ({
    showMainWindow: jest.fn(),
}));

jest.mock('common/config', () => ({
    spellcheck: true,
}));

jest.mock('common/utils/url', () => ({
    parseURL: (url) => {
        try {
            return new URL(url);
        } catch (e) {
            return null;
        }
    },
    getView: jest.fn(),
    isTeamUrl: jest.fn(),
    isAdminUrl: jest.fn(),
    isTrustedPopupWindow: jest.fn(),
    isTrustedURL: jest.fn(),
    isCustomLoginURL: jest.fn(),
    isInternalURL: jest.fn(),
    isValidURI: jest.fn(),
    isPluginUrl: jest.fn(),
    isManagedResource: jest.fn(),
    isChannelExportUrl: jest.fn(),
}));

jest.mock('../../../electron-builder.json', () => ({
    protocols: [
        {
            name: 'Mattermost',
            schemes: ['mattermost'],
        },
    ],
}));

jest.mock('../allowProtocolDialog', () => ({
    handleDialogEvent: jest.fn(),
}));

describe('main/views/webContentsEvents', () => {
    const event = {preventDefault: jest.fn(), sender: {id: 1}};

    describe('willNavigate', () => {
        const webContentsEventManager = new WebContentsEventManager();
        const willNavigate = webContentsEventManager.generateWillNavigate(jest.fn());

        beforeEach(() => {
            urlUtils.getView.mockImplementation(() => ({name: 'server_name', url: 'http://server-1.com'}));
        });

        afterEach(() => {
            jest.resetAllMocks();
            jest.restoreAllMocks();
            webContentsEventManager.customLogins = {};
            webContentsEventManager.popupWindow = undefined;
        });

        it('should allow navigation when url isTeamURL', () => {
            urlUtils.isTeamUrl.mockImplementation((serverURL, parsedURL) => parsedURL.toString().startsWith(serverURL));
            willNavigate(event, 'http://server-1.com/subpath');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when url isAdminURL', () => {
            urlUtils.isAdminUrl.mockImplementation((serverURL, parsedURL) => parsedURL.toString().startsWith(`${serverURL}/admin_console`));
            willNavigate(event, 'http://server-1.com/admin_console/subpath');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when isTrustedPopup', () => {
            const spy = jest.spyOn(webContentsEventManager, 'isTrustedPopupWindow');
            spy.mockReturnValue(true);
            willNavigate(event, 'http://externalurl.com/popup/subpath');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when isCustomLoginURL', () => {
            urlUtils.isCustomLoginURL.mockImplementation((parsedURL) => parsedURL.toString().startsWith('http://loginurl.com/login'));
            willNavigate(event, 'http://loginurl.com/login/oauth');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when protocol is mailto', () => {
            willNavigate(event, 'mailto:test@mattermost.com');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when a custom login is in progress', () => {
            webContentsEventManager.customLogins[1] = {inProgress: true};
            willNavigate(event, 'http://anyoldurl.com');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when it isChannelExportUrl', () => {
            urlUtils.isChannelExportUrl.mockImplementation((serverURL, parsedURL) => parsedURL.toString().includes('/plugins/com.mattermost.plugin-channel-export/api/v1/export'));
            willNavigate(event, 'http://server-1.com/plugins/com.mattermost.plugin-channel-export/api/v1/export');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should not allow navigation under any other circumstances', () => {
            willNavigate(event, 'http://someotherurl.com');
            expect(event.preventDefault).toBeCalled();
        });
    });

    describe('didStartNavigation', () => {
        const webContentsEventManager = new WebContentsEventManager();
        const didStartNavigation = webContentsEventManager.generateDidStartNavigation(jest.fn());

        beforeEach(() => {
            urlUtils.getView.mockImplementation(() => ({name: 'server_name', url: 'http://server-1.com'}));
            urlUtils.isTrustedURL.mockReturnValue(true);
            urlUtils.isInternalURL.mockImplementation((serverURL, parsedURL) => parsedURL.toString().startsWith(serverURL));
            urlUtils.isCustomLoginURL.mockImplementation((parsedURL) => parsedURL.toString().startsWith('http://loginurl.com/login'));
        });

        afterEach(() => {
            jest.resetAllMocks();
            webContentsEventManager.customLogins = {};
        });

        it('should add custom login entry on custom login URL', () => {
            webContentsEventManager.customLogins[1] = {inProgress: false};
            didStartNavigation(event, 'http://loginurl.com/login/oauth');
            expect(webContentsEventManager.customLogins[1]).toStrictEqual({inProgress: true});
        });

        it('should remove custom login entry once navigating back to internal URL', () => {
            webContentsEventManager.customLogins[1] = {inProgress: true};
            didStartNavigation(event, 'http://server-1.com/subpath');
            expect(webContentsEventManager.customLogins[1]).toStrictEqual({inProgress: false});
        });
    });

    describe('newWindow', () => {
        const webContentsEventManager = new WebContentsEventManager();
        const newWindow = webContentsEventManager.generateNewWindowListener(jest.fn());

        beforeEach(() => {
            urlUtils.isValidURI.mockReturnValue(true);
            urlUtils.getView.mockReturnValue({name: 'server_name', url: 'http://server-1.com'});
            urlUtils.isTeamUrl.mockImplementation((serverURL, parsedURL) => parsedURL.toString().startsWith(`${serverURL}/myteam`));
            urlUtils.isAdminUrl.mockImplementation((serverURL, parsedURL) => parsedURL.toString().startsWith(`${serverURL}/admin_console`));
            urlUtils.isPluginUrl.mockImplementation((serverURL, parsedURL) => parsedURL.toString().startsWith(`${serverURL}/myplugin`));
            urlUtils.isManagedResource.mockImplementation((serverURL, parsedURL) => parsedURL.toString().startsWith(`${serverURL}/myplugin`));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });
        it('should deny on bad URL', () => {
            expect(newWindow({url: 'a-bad<url'})).toStrictEqual({action: 'deny'});
        });

        it('should allow dev tools to open', () => {
            expect(newWindow({url: 'devtools://aaaaaa.com'})).toStrictEqual({action: 'allow'});
        });

        it('should open invalid URIs in browser', () => {
            urlUtils.isValidURI.mockReturnValue(false);
            expect(newWindow({url: 'https://google.com/?^'})).toStrictEqual({action: 'deny'});
            expect(shell.openExternal).toBeCalledWith('https://google.com/?^');
        });

        it('should divert to allowProtocolDialog for custom protocols that are not mattermost or http', () => {
            expect(newWindow({url: 'spotify:album:2OZbaW9tgO62ndm375lFZr'})).toStrictEqual({action: 'deny'});
            expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith('spotify:', 'spotify:album:2OZbaW9tgO62ndm375lFZr');
        });

        it('should divert to allowProtocolDialog for invalid URIs with custom protocols', () => {
            expect(newWindow({url: 'customproto:test\\data'})).toStrictEqual({action: 'deny'});
            expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith('customproto:', 'customproto:test\\data');
        });

        it('should open in the browser when there is no server matching', () => {
            urlUtils.getView.mockReturnValue(null);
            expect(newWindow({url: 'http://server-2.com/subpath'})).toStrictEqual({action: 'deny'});
            expect(shell.openExternal).toBeCalledWith('http://server-2.com/subpath');
        });

        it('should open public file links in browser', () => {
            expect(newWindow({url: 'http://server-1.com/api/v4/public/files/myfile.img'})).toStrictEqual({action: 'deny'});
            expect(shell.openExternal).toBeCalledWith('http://server-1.com/api/v4/public/files/myfile.img');
        });

        it('should open help links in the browser', () => {
            expect(newWindow({url: 'http://server-1.com/help/helplink'})).toStrictEqual({action: 'deny'});
            expect(shell.openExternal).toBeCalledWith('http://server-1.com/help/helplink');
        });

        it('should open team links in the app', () => {
            expect(newWindow({url: 'http://server-1.com/myteam/channels/mychannel'})).toStrictEqual({action: 'deny'});
            expect(WindowManager.showMainWindow).toBeCalledWith(new URL('http://server-1.com/myteam/channels/mychannel'));
        });

        it('should prevent admin links from opening in a new window', () => {
            expect(newWindow({url: 'http://server-1.com/admin_console/somepage'})).toStrictEqual({action: 'deny'});
        });

        it('should prevent from opening a new window if popup already exists', () => {
            webContentsEventManager.popupWindow = {webContents: {getURL: () => 'http://server-1.com/myplugin/login'}};
            expect(newWindow({url: 'http://server-1.com/myplugin/login'})).toStrictEqual({action: 'deny'});
        });

        it('should open popup window for plugins', () => {
            expect(newWindow({url: 'http://server-1.com/myplugin/login'})).toStrictEqual({action: 'deny'});
            expect(webContentsEventManager.popupWindow).toBeTruthy();
        });

        it('should open popup window for managed resources', () => {
            expect(newWindow({url: 'http://server-1.com/trusted/login'})).toStrictEqual({action: 'deny'});
            expect(webContentsEventManager.popupWindow).toBeTruthy();
        });
    });
});
