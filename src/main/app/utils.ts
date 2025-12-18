// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindow, Rectangle} from 'electron';
import {app, session, dialog, screen} from 'electron';
import isDev from 'electron-is-dev';

import MainWindow from 'app/mainWindow/mainWindow';
import MenuManager from 'app/menus';
import NavigationManager from 'app/navigationManager';
import {MAIN_WINDOW_CREATED} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {isValidURI} from 'common/utils/url';
import {localizeMessage} from 'main/i18nManager';
import {ServerInfo} from 'main/server/serverInfo';

import type {RemoteInfo} from 'types/server';
import type {Boundaries} from 'types/utils';

import {mainProtocol} from './initialize';

const log = new Logger('App.Utils');

export function openDeepLink(deeplinkingUrl: string) {
    try {
        if (MainWindow.get()) {
            MainWindow.show();
            NavigationManager.openLinkInPrimaryTab(deeplinkingUrl);
        } else {
            MainWindow.on(MAIN_WINDOW_CREATED, () => NavigationManager.openLinkInPrimaryTab(deeplinkingUrl));
        }
    } catch (err) {
        log.error(`There was an error opening the deeplinking url: ${err}`);
    }
}

export function updateSpellCheckerLocales() {
    if (Config.spellCheckerLocales.length && app.isReady()) {
        session.defaultSession.setSpellCheckerLanguages(Config.spellCheckerLocales);
    }
}

export function getDeeplinkingURL(args: string[]) {
    if (Array.isArray(args) && args.length) {
    // deeplink urls should always be the last argument, but may not be the first (i.e. Windows with the app already running)
        const url = args[args.length - 1];
        const protocol = isDev ? 'mattermost-dev' : mainProtocol;
        if (url && protocol && url.startsWith(protocol) && isValidURI(url)) {
            return url;
        }
    }
    return undefined;
}

export function shouldShowTrayIcon() {
    return Config.showTrayIcon || process.platform === 'win32';
}

export function wasUpdated(lastAppVersion?: string) {
    return lastAppVersion !== app.getVersion();
}

export function clearAppCache() {
    // TODO: clear cache on browserviews, not in the renderer.
    const mainWindow = MainWindow.get();
    if (mainWindow) {
        mainWindow.webContents.session.clearCache().
            then(mainWindow.webContents.reload).
            catch((err) => {
                log.error('clearAppCache', {err});
            });
    } else {
    //Wait for mainWindow
        setTimeout(clearAppCache, 100);
    }
}

function isWithinDisplay(state: Rectangle, display: Boundaries) {
    const startsWithinDisplay = !(state.x > display.maxX || state.y > display.maxY || state.x < display.minX || state.y < display.minY);
    if (!startsWithinDisplay) {
        return false;
    }

    // is half the screen within the display?
    const midX = state.x + (state.width / 2);
    const midY = state.y + (state.height / 2);
    return !(midX > display.maxX || midY > display.maxY);
}

function getDisplayBoundaries() {
    const displays = screen.getAllDisplays();

    return displays.map((display) => {
        return {
            maxX: display.workArea.x + display.workArea.width,
            maxY: display.workArea.y + display.workArea.height,
            minX: display.workArea.x,
            minY: display.workArea.y,
            maxWidth: display.workArea.width,
            maxHeight: display.workArea.height,
        };
    });
}

function getValidWindowPosition(state: Rectangle) {
    // Check if the previous position is out of the viewable area
    // (e.g. because the screen has been plugged off)
    const boundaries = getDisplayBoundaries();
    const display = boundaries.find((boundary) => {
        return isWithinDisplay(state, boundary);
    });

    if (typeof display === 'undefined') {
        return {};
    }
    return {x: state.x, y: state.y};
}

function getNewWindowPosition(browserWindow: BrowserWindow) {
    const mainWindow = MainWindow.get();
    if (!mainWindow) {
        return browserWindow.getPosition();
    }

    const newWindowSize = browserWindow.getSize();
    const mainWindowSize = mainWindow.getSize();
    const mainWindowPosition = mainWindow.getPosition();

    return [
        Math.floor(mainWindowPosition[0] + ((mainWindowSize[0] - newWindowSize[0]) / 2)),
        Math.floor(mainWindowPosition[1] + ((mainWindowSize[1] - newWindowSize[1]) / 2)),
    ];
}

export function resizeScreen(browserWindow: BrowserWindow) {
    const position = getNewWindowPosition(browserWindow);
    const size = browserWindow.getSize();
    const validPosition = getValidWindowPosition({
        x: position[0],
        y: position[1],
        width: size[0],
        height: size[1],
    });
    if (typeof validPosition.x !== 'undefined' || typeof validPosition.y !== 'undefined') {
        browserWindow.setPosition(validPosition.x || 0, validPosition.y || 0);
    } else {
        browserWindow.center();
    }
}

export function flushCookiesStore() {
    log.debug('flushCookiesStore');
    session.defaultSession.cookies.flushStore().catch((err) => {
        log.error(`There was a problem flushing cookies:\n${err}`);
    });
}

export async function updateServerInfos(servers: MattermostServer[]) {
    await Promise.all(servers.map(async (srv) => {
        const serverInfo = new ServerInfo(srv);
        let data: RemoteInfo;
        try {
            data = await serverInfo.fetchRemoteInfo();
        } catch (error) {
            log.error('updateServerInfos: Failed to fetch remote info', {error});
            return;
        }

        if (data.siteURL) {
            // We need to validate the site URL is reachable by pinging the server
            const tempServer = new MattermostServer({name: 'temp', url: data.siteURL}, false);
            const tempServerInfo = new ServerInfo(tempServer);
            try {
                const tempRemoteInfo = await tempServerInfo.fetchConfigData();
                if (tempRemoteInfo.siteURL === data.siteURL) {
                    ServerManager.updateRemoteInfo(srv.id, data, true);
                    return;
                }
            } catch (error) {
                log.error('updateServerInfos: Failed to fetch temp remote info', {error});
                ServerManager.updateRemoteInfo(srv.id, data, false);
                return;
            }
        }

        ServerManager.updateRemoteInfo(srv.id, data, false);
    }));

    // TODO: Would be better encapsulated in the MenuManager
    MenuManager.refreshMenu();
}

export async function clearDataForServer(server: MattermostServer) {
    const mainWindow = MainWindow.get();
    if (!mainWindow) {
        return;
    }

    const response = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: [
            localizeMessage('main.app.utils.clearDataForServer.confirm', 'Clear Data'),
            localizeMessage('main.app.utils.clearDataForServer.cancel', 'Cancel'),
        ],
        defaultId: 1,
        message: localizeMessage('main.app.utils.clearDataForServer.message', 'This action will erase all session, cache, cookie and storage data for the server "{serverName}". Are you sure you want to clear data for this server?', {serverName: server.name}),
    });

    if (response.response === 0) {
        await session.defaultSession.clearData({
            origins: [server.url.origin],
        });

        ServerManager.reloadServer(server.id);
    }
}

export async function clearAllData() {
    const mainWindow = MainWindow.get();
    if (!mainWindow) {
        return;
    }

    const response = await dialog.showMessageBox(mainWindow, {
        title: app.name,
        type: 'warning',
        buttons: [
            localizeMessage('main.app.utils.clearAllData.confirm', 'Clear All Data'),
            localizeMessage('main.app.utils.clearAllData.cancel', 'Cancel'),
        ],
        defaultId: 1,
        message: localizeMessage('main.app.utils.clearAllData.message', 'This action will erase all session, cache, cookie and storage data for all server. Performing this action will restart the application. Are you sure you want to clear all data?'),
    });

    if (response.response === 0) {
        await session.defaultSession.clearAuthCache();
        await session.defaultSession.clearCodeCaches({});
        await session.defaultSession.clearHostResolverCache();
        await session.defaultSession.clearData();

        // These are here to suppress an unnecessary exception thrown when the app is force exited
        // The app will restart anyways so we don't need to handle the exception
        process.removeAllListeners('uncaughtException');
        process.removeAllListeners('unhandledRejection');

        app.relaunch();
        app.exit();
    }
}
