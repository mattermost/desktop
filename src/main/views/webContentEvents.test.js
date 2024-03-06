// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {shell, BrowserWindow} from 'electron';

import {getLevel} from 'common/log';

import ContextMenu from 'main/contextMenu';
import ViewManager from 'main/views/viewManager';

import allowProtocolDialog from '../allowProtocolDialog';

import {WebContentsEventManager} from './webContentEvents';

jest.mock('electron', () => ({
    app: {},
    shell: {
        openExternal: jest.fn(),
    },
    BrowserWindow: jest.fn(),
    session: {},
}));
jest.mock('main/contextMenu', () => jest.fn());
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
}));
jest.mock('../allowProtocolDialog', () => ({}));
jest.mock('main/windows/callsWidgetWindow', () => ({}));
jest.mock('main/views/viewManager', () => ({
    getViewByWebContentsId: jest.fn(),
    handleDeepLink: jest.fn(),
}));
jest.mock('../utils', () => ({
    composeUserAgent: jest.fn(),
}));

jest.mock('common/config', () => ({
    spellcheck: true,
}));

jest.mock('main/app/utils', () => ({
    flushCookiesStore: jest.fn(),
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
    const event = {preventDefault: jest.fn()};

    describe('willNavigate', () => {
        const webContentsEventManager = new WebContentsEventManager();
        webContentsEventManager.getServerURLFromWebContentsId = () => new URL('http://server-1.com');
        const willNavigate = webContentsEventManager.generateWillNavigate(1);
        const popupWindowSpy = jest.spyOn(webContentsEventManager, 'isTrustedPopupWindow');

        afterEach(() => {
            event.preventDefault.mockClear();
            popupWindowSpy.mockReset();
            webContentsEventManager.customLogins = {};
            webContentsEventManager.popupWindow = undefined;
        });

        it('should allow navigation when url isTeamURL', () => {
            willNavigate(event, 'http://server-1.com/subpath');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when url isAdminURL', () => {
            willNavigate(event, 'http://server-1.com/admin_console/subpath');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when isTrustedPopup', () => {
            popupWindowSpy.mockReturnValue(true);
            willNavigate(event, 'http://externalurl.com/popup/subpath');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when isCustomLoginURL', () => {
            willNavigate(event, 'http://server-1.com/oauth/authorize');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should not allow navigation when isCustomLoginURL is external', () => {
            willNavigate(event, 'http://loginurl.com/oauth/authorize');
            expect(event.preventDefault).toBeCalled();
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
        const didStartNavigation = webContentsEventManager.generateDidStartNavigation(1);

        beforeEach(() => {
            webContentsEventManager.getServerURLFromWebContentsId = jest.fn().mockImplementation(() => new URL('http://server-1.com'));
        });

        afterEach(() => {
            jest.clearAllMocks();
            webContentsEventManager.customLogins = {};
        });

        it('should add custom login entry on custom login URL', () => {
            webContentsEventManager.customLogins[1] = {inProgress: false};
            didStartNavigation(event, 'http://server-1.com/oauth/authorize');
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
        const newWindow = webContentsEventManager.generateNewWindowListener(1, true);

        beforeEach(() => {
            webContentsEventManager.getServerURLFromWebContentsId = jest.fn().mockImplementation(() => new URL('http://server-1.com'));

            BrowserWindow.mockImplementation(() => ({
                once: jest.fn(),
                show: jest.fn(),
                loadURL: jest.fn(),
                webContents: {
                    on: jest.fn(),
                    setWindowOpenHandler: jest.fn(),
                },
            }));
            ContextMenu.mockImplementation(() => ({
                reload: jest.fn(),
            }));
        });

        afterEach(() => {
            webContentsEventManager.popupWindow = undefined;
            jest.clearAllMocks();
        });
        it('should deny on bad URL', () => {
            expect(newWindow({url: 'a-bad<url'})).toStrictEqual({action: 'deny'});
        });

        it('should allow dev tools to open', () => {
            expect(newWindow({url: 'devtools://aaaaaa.com'})).toStrictEqual({action: 'allow'});
        });

        it('should open invalid URIs in browser', () => {
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
            ViewManager.getViewByWebContentsId.mockReturnValue(undefined);
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
            expect(ViewManager.handleDeepLink).toBeCalledWith(new URL('http://server-1.com/myteam/channels/mychannel'));
        });

        it('should prevent admin links from opening in a new window', () => {
            expect(newWindow({url: 'http://server-1.com/admin_console/somepage'})).toStrictEqual({action: 'deny'});
        });

        it('should prevent from opening a new window if popup already exists', () => {
            webContentsEventManager.popupWindow = {win: {webContents: {getURL: () => 'http://server-1.com/myplugin/login'}}};
            expect(newWindow({url: 'http://server-1.com/myplugin/login'})).toStrictEqual({action: 'deny'});
        });

        it('should open popup window for plugins', () => {
            expect(newWindow({url: 'http://server-1.com/plugins/myplugin/login'})).toStrictEqual({action: 'deny'});
            expect(webContentsEventManager.popupWindow).toBeTruthy();
        });

        it('should open popup window for managed resources', () => {
            expect(newWindow({url: 'http://server-1.com/trusted/login'})).toStrictEqual({action: 'deny'});
            expect(webContentsEventManager.popupWindow).toBeTruthy();
        });

        it('should open external URIs in browser', () => {
            expect(newWindow({url: 'https://google.com'})).toStrictEqual({action: 'deny'});
            expect(shell.openExternal).toBeCalledWith('https://google.com');
        });
    });

    describe('consoleMessage', () => {
        const webContentsEventManager = new WebContentsEventManager();
        const logObject = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            verbose: jest.fn(),
            withPrefix: jest.fn().mockReturnThis(),
        };
        webContentsEventManager.log = jest.fn().mockReturnValue(logObject);
        const consoleMessage = webContentsEventManager.generateHandleConsoleMessage();

        afterEach(() => {
            getLevel.mockReset();
        });

        it('should respect logging levels', () => {
            consoleMessage({}, 0, 'test0', 0, '');
            expect(logObject.verbose).toHaveBeenCalledWith('test0');

            consoleMessage({}, 1, 'test1', 0, '');
            expect(logObject.info).toHaveBeenCalledWith('test1');

            consoleMessage({}, 2, 'test2', 0, '');
            expect(logObject.warn).toHaveBeenCalledWith('test2');

            consoleMessage({}, 3, 'test3', 0, '');
            expect(logObject.error).toHaveBeenCalledWith('test3');
        });

        it('should only add line numbers for debug and silly', () => {
            getLevel.mockReturnValue('debug');
            consoleMessage({}, 0, 'test1', 42, 'meaning_of_life.js');
            expect(logObject.verbose).toHaveBeenCalledWith('test1', '(meaning_of_life.js:42)');

            getLevel.mockReturnValue('info');
            consoleMessage({}, 0, 'test2', 42, 'meaning_of_life.js');
            expect(logObject.verbose).not.toHaveBeenCalledWith('test2', '(meaning_of_life.js:42)');
        });
    });
});
