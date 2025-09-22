// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import type {
    BrowserWindow,
    Event,
    WebContentsWillNavigateEventParams,
    WebContentsWillRedirectEventParams,
    WebContentsDidStartNavigationEventParams,
} from 'electron';
import {shell} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import NavigationManager from 'app/navigationManager';
import {generateHandleConsoleMessage, isCustomProtocol} from 'app/views/webContentEventsCommon';
import WebContentsManager from 'app/views/webContentsManager';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {
    isTeamUrl,
    parseURL,
} from 'common/utils/url';
import ContextMenu from 'main/contextMenu';

import allowProtocolDialog from '../../main/security/allowProtocolDialog';

const log = new Logger('PluginsPopUpsManager');

type PluginPopUp = {
    parentId: number;
    win: BrowserWindow;
}

export class PluginsPopUpsManager {
    popups: Record<number, PluginPopUp>;

    constructor() {
        this.popups = {};
    }

    generateHandleCreateWindow = (parentId: number) => (win: BrowserWindow, details: Electron.DidCreateWindowDetails) => {
        const webContentsId = win.webContents.id;

        log.debug('created popup window', {webContentsId});
        this.popups[webContentsId] = {
            parentId,
            win,
        };

        // We take a conservative approach for the time being and disallow most events coming from popups:
        // - Redirects
        // - Navigation
        // - Opening new windows
        win.webContents.on('will-redirect', (ev: Event<WebContentsWillRedirectEventParams>) => {
            log.warn('prevented popup window from redirecting');
            ev.preventDefault();
        });
        win.webContents.on('will-navigate', (ev: Event<WebContentsWillNavigateEventParams>) => {
            if (ev.url === details.url) {
                return;
            }

            log.warn('prevented popup window from navigating');
            ev.preventDefault();
        });
        win.webContents.on('did-start-navigation', (ev: Event<WebContentsDidStartNavigationEventParams>) => {
            if (ev.url === details.url) {
                return;
            }

            log.warn('prevented popup window from navigating');
            ev.preventDefault();
        });
        win.webContents.setWindowOpenHandler(({url}): {action: 'deny'} => {
            const parsedURL = parseURL(url);
            if (!parsedURL) {
                log.warn('Ignoring non-url');
                return {action: 'deny'};
            }

            // Check for custom protocol
            if (isCustomProtocol(parsedURL)) {
                allowProtocolDialog.handleDialogEvent(parsedURL.protocol, url);
                return {action: 'deny'};
            }

            const serverView = WebContentsManager.getViewByWebContentsId(parentId);
            const server = serverView && ServerManager.getServer(serverView.serverId);

            // We allow internal (i.e., same server) links to be routed as expected.
            if (server && isTeamUrl(server.url, parsedURL, true)) {
                ServerManager.updateCurrentServer(server.id);
                MainWindow.get()?.focus();
                NavigationManager.openLinkInNewTab(parsedURL);
            } else {
                // We allow to open external links through browser.
                shell.openExternal(url);
            }

            log.warn('prevented popup window from opening window');

            return {action: 'deny'};
        });

        win.webContents.on('console-message', generateHandleConsoleMessage(log));

        const contextMenu = new ContextMenu({}, win);
        contextMenu.reload();

        win.once('closed', () => {
            log.debug('removing popup window', details.url, webContentsId);
            Reflect.deleteProperty(this.popups, webContentsId);
            contextMenu.dispose();
        });

        win.webContents.once('render-process-gone', (_, details) => {
            if (details.reason !== 'clean-exit') {
                log.error('Renderer process for a webcontent is no longer available:', {reason: details.reason});
            }
            try {
                win.webContents.removeAllListeners();
            } catch (e) {
                log.error(`Error while trying to detach listeners, this might be ok if the process crashed: ${e}`);
            }
        });
    };

    public handleNewWindow(parentId: number, details: Electron.HandlerDetails): {action: 'deny' | 'allow'} {
        // Making extra explicit what we allow. This should already be enforced on
        // the calling side.
        if (details.url !== 'about:blank') {
            log.warn('prevented new window creation');
            return {action: 'deny'};
        }

        // Make sure the parent view exists.
        const parentView = WebContentsManager.getViewByWebContentsId(parentId);
        if (!parentView) {
            log.warn('handleNewWindow: parent view not found');
            return {action: 'deny'};
        }

        return {action: 'allow'};
    }
}

const pluginsPopUpsManager = new PluginsPopUpsManager();
export default pluginsPopUpsManager;
