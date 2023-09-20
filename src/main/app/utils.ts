// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import fs from 'fs-extra';

import {app, BrowserWindow, Menu, Rectangle, Session, session, dialog, nativeImage, screen} from 'electron';
import isDev from 'electron-is-dev';

import {MigrationInfo} from 'types/config';
import {RemoteInfo} from 'types/server';
import {Boundaries} from 'types/utils';

import Config from 'common/config';
import {Logger} from 'common/log';
import JsonFileManager from 'common/JsonFileManager';
import ServerManager from 'common/servers/serverManager';
import {MattermostServer} from 'common/servers/MattermostServer';
import {APP_MENU_WILL_CLOSE} from 'common/communication';
import {isValidURI} from 'common/utils/url';

import updateManager from 'main/autoUpdater';
import {migrationInfoPath, updatePaths} from 'main/constants';
import {localizeMessage} from 'main/i18nManager';
import {createMenu as createAppMenu} from 'main/menus/app';
import {createMenu as createTrayMenu} from 'main/menus/tray';
import {ServerInfo} from 'main/server/serverInfo';
import Tray from 'main/tray/tray';
import ViewManager from 'main/views/viewManager';
import MainWindow from 'main/windows/mainWindow';

import {mainProtocol} from './initialize';

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_with_spacing_32.png');
const appIcon = nativeImage.createFromPath(appIconURL);
const log = new Logger('App.Utils');

export function openDeepLink(deeplinkingUrl: string) {
    try {
        MainWindow.show();
        ViewManager.handleDeepLink(deeplinkingUrl);
    } catch (err) {
        log.error(`There was an error opening the deeplinking url: ${err}`);
    }
}

export function updateSpellCheckerLocales() {
    if (Config.spellCheckerLocales.length && app.isReady()) {
        session.defaultSession.setSpellCheckerLanguages(Config.spellCheckerLocales);
    }
}

export function handleUpdateMenuEvent() {
    log.debug('handleUpdateMenuEvent');

    const aMenu = createAppMenu(Config, updateManager);
    Menu.setApplicationMenu(aMenu);
    aMenu.addListener('menu-will-close', () => {
        ViewManager.focusCurrentView();
        MainWindow.sendToRenderer(APP_MENU_WILL_CLOSE);
    });

    // set up context menu for tray icon
    if (shouldShowTrayIcon()) {
        const tMenu = createTrayMenu();
        Tray.setMenu(tMenu);
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
                log.error('clearAppCache', err);
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

export function resizeScreen(browserWindow: BrowserWindow) {
    function handle() {
        log.debug('resizeScreen.handle');
        const position = browserWindow.getPosition();
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

    browserWindow.once('restore', handle);
    handle();
}

export function flushCookiesStore(session: Session) {
    log.debug('flushCookiesStore');
    session.cookies.flushStore().catch((err) => {
        log.error(`There was a problem flushing cookies:\n${err}`);
    });
}

export function initCookieManager(session: Session) {
    // Somehow cookies are not immediately saved to disk.
    // So manually flush cookie store to disk on closing the app.
    // https://github.com/electron/electron/issues/8416
    app.on('before-quit', () => {
        flushCookiesStore(session);
    });

    app.on('browser-window-blur', () => {
        flushCookiesStore(session);
    });
}

export function migrateMacAppStore() {
    const migrationPrefs = new JsonFileManager<MigrationInfo>(migrationInfoPath);
    const oldPath = path.join(app.getPath('userData'), '../../../../../../../Library/Application Support/Mattermost');

    // Check if we've already migrated
    if (migrationPrefs.getValue('masConfigs')) {
        return;
    }

    // Check if the files are there to migrate
    try {
        const exists = fs.existsSync(oldPath);
        if (!exists) {
            log.info('MAS: No files to migrate, skipping');
            return;
        }
    } catch (e) {
        log.error('MAS: Failed to check for existing Mattermost Desktop install, skipping', e);
        return;
    }

    const cancelImport = dialog.showMessageBoxSync({
        title: app.name,
        message: localizeMessage('main.app.utils.migrateMacAppStore.dialog.message', 'Import Existing Configuration'),
        detail: localizeMessage('main.app.utils.migrateMacAppStore.dialog.detail', 'It appears that an existing {appName} configuration exists, would you like to import it? You will be asked to pick the correct configuration directory.', {appName: app.name}),
        icon: appIcon,
        buttons: [
            localizeMessage('main.app.utils.migrateMacAppStore.button.selectAndImport', 'Select Directory and Import'),
            localizeMessage('main.app.utils.migrateMacAppStore.button.dontImport', 'Don\'t Import'),
        ],
        type: 'info',
        defaultId: 0,
        cancelId: 1,
    });

    if (cancelImport) {
        migrationPrefs.setValue('masConfigs', true);
        return;
    }

    const result = dialog.showOpenDialogSync({
        defaultPath: oldPath,
        properties: ['openDirectory'],
    });
    if (!(result && result[0])) {
        return;
    }

    try {
        fs.copySync(result[0], app.getPath('userData'));
        updatePaths(true);
        migrationPrefs.setValue('masConfigs', true);
    } catch (e) {
        log.error('MAS: An error occurred importing the existing configuration', e);
    }
}

export async function updateServerInfos(servers: MattermostServer[]) {
    const map: Map<string, RemoteInfo> = new Map();
    await Promise.all(servers.map((srv) => {
        const serverInfo = new ServerInfo(srv);
        return serverInfo.fetchRemoteInfo().
            then((data) => {
                map.set(srv.id, data);
            }).
            catch((error) => {
                log.warn('Could not get server info for', srv.name, error);
            });
    }));
    ServerManager.updateRemoteInfos(map);
}
