// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import type {
    BrowserWindow,
    Event,
    WebContentsWillNavigateEventParams,
    WebContentsWillRedirectEventParams,
    WebContentsDidStartNavigationEventParams,
} from 'electron';

import {Logger} from 'common/log';
import ContextMenu from 'main/contextMenu';
import ViewManager from 'main/views/viewManager';
import {generateHandleConsoleMessage} from 'main/views/webContentEventsCommon';

const log = new Logger('PluginsPopUpsManager');

type PluginPopUp = {
    win: BrowserWindow;
}

export class PluginsPopUpsManager {
    popups: Record<number, PluginPopUp>;

    constructor() {
        this.popups = {};
    }

    handleCreateWindow = (win: BrowserWindow, details: Electron.DidCreateWindowDetails) => {
        const webContentsId = win.webContents.id;

        log.debug('created popup window', details.url, webContentsId);
        this.popups[webContentsId] = {
            win,
        };

        // We take a conservative approach for the time being and disallow most events coming from popups:
        // - Redirects
        // - Navigation
        // - Opening new windows
        win.webContents.on('will-redirect', (ev: Event<WebContentsWillRedirectEventParams>) => {
            log.warn(`prevented popup window from redirecting to: ${ev.url}`);
            ev.preventDefault();
        });
        win.webContents.on('will-navigate', (ev: Event<WebContentsWillNavigateEventParams>) => {
            if (ev.url === details.url) {
                return;
            }

            log.warn(`prevented popup window from navigating to: ${ev.url}`);
            ev.preventDefault();
        });
        win.webContents.on('did-start-navigation', (ev: Event<WebContentsDidStartNavigationEventParams>) => {
            if (ev.url === details.url) {
                return;
            }

            log.warn(`prevented popup window from navigating to: ${ev.url}`);
            ev.preventDefault();
        });
        win.webContents.setWindowOpenHandler(({url}): {action: 'deny' | 'allow'} => {
            log.warn(`prevented popup window from opening window to ${url}`);
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
                log.error('Renderer process for a webcontent is no longer available:', details.reason);
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
            log.warn(`prevented new window creation: ${details.url}`);
            return {action: 'deny'};
        }

        // Make sure the parent view exists.
        const parentView = ViewManager.getViewByWebContentsId(parentId);
        if (!parentView) {
            log.warn('handleNewWindow: parent view not found');
            return {action: 'deny'};
        }

        return {action: 'allow'};
    }
}

const pluginsPopUpsManager = new PluginsPopUpsManager();
export default pluginsPopUpsManager;
