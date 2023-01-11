// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app, session} from 'electron';

import Config from 'common/config';
import urlUtils from 'common/utils/url';

import parseArgs from 'main/ParseArgs';
import WindowManager from 'main/windows/windowManager';

import {initialize} from './initialize';
import {clearAppCache, getDeeplinkingURL, wasUpdated} from './utils';

jest.mock('fs', () => ({
    unlinkSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(false),
    readFileSync: jest.fn().mockImplementation((text) => text),
    writeFile: jest.fn(),

}));

jest.mock('path', () => {
    const original = jest.requireActual('path');
    return {
        ...original,
        resolve: jest.fn(),
    };
});

jest.mock('electron', () => ({
    app: {
        on: jest.fn(),
        exit: jest.fn(),
        getPath: jest.fn(),
        setPath: jest.fn(),
        disableHardwareAcceleration: jest.fn(),
        enableSandbox: jest.fn(),
        requestSingleInstanceLock: jest.fn(),
        setAsDefaultProtocolClient: jest.fn(),
        setAppUserModelId: jest.fn(),
        getVersion: jest.fn(),
        whenReady: jest.fn(),
        getLocale: jest.fn(),
        getLocaleCountryCode: jest.fn(),
    },
    ipcMain: {
        on: jest.fn(),
        handle: jest.fn(),
        emit: jest.fn(),
        removeHandler: jest.fn(),
        removeListener: jest.fn(),
    },
    screen: {
        on: jest.fn(),
    },
    session: {
        defaultSession: {
            setSpellCheckerDictionaryDownloadURL: jest.fn(),
            setPermissionRequestHandler: jest.fn(),
            on: jest.fn(),
            protocol: {
                registerFileProtocol: jest.fn(),
            },
        },
    },
    protocol: {
        registerSchemesAsPrivileged: jest.fn(),
    },
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
    setLocale: jest.fn(),
}));

jest.mock('electron-devtools-installer', () => {
    return () => ({
        REACT_DEVELOPER_TOOLS: 'react-developer-tools',
    });
});

const isDev = false;
jest.mock('electron-is-dev', () => isDev);

jest.mock('../../../electron-builder.json', () => ([
    {
        name: 'Mattermost',
        schemes: [
            'mattermost',
        ],
    },
]));

jest.mock('common/config', () => ({
    once: jest.fn(),
    on: jest.fn(),
    init: jest.fn(),
}));

jest.mock('common/utils/url', () => ({
    isTrustedURL: jest.fn(),
}));

jest.mock('main/allowProtocolDialog', () => ({
    init: jest.fn(),
}));
jest.mock('main/app/app', () => ({}));
jest.mock('main/app/config', () => ({
    handleConfigUpdate: jest.fn(),
}));
jest.mock('main/app/intercom', () => ({
    handleMainWindowIsShown: jest.fn(),
}));
jest.mock('main/app/utils', () => ({
    clearAppCache: jest.fn(),
    getDeeplinkingURL: jest.fn(),
    handleUpdateMenuEvent: jest.fn(),
    shouldShowTrayIcon: jest.fn(),
    updateServerInfos: jest.fn(),
    updateSpellCheckerLocales: jest.fn(),
    wasUpdated: jest.fn(),
    initCookieManager: jest.fn(),
}));
jest.mock('main/AppVersionManager', () => ({}));
jest.mock('main/authManager', () => ({}));
jest.mock('main/AutoLauncher', () => ({
    upgradeAutoLaunch: jest.fn(),
}));
jest.mock('main/autoUpdater', () => ({}));
jest.mock('main/badge', () => ({
    setupBadge: jest.fn(),
}));
jest.mock('main/certificateManager', () => ({}));
jest.mock('main/CriticalErrorHandler', () => ({
    processUncaughtExceptionHandler: jest.fn(),
    setMainWindow: jest.fn(),
}));
jest.mock('main/notifications', () => ({
    displayDownloadCompleted: jest.fn(),
}));
jest.mock('main/ParseArgs', () => jest.fn());
jest.mock('main/tray/tray', () => ({
    refreshTrayImages: jest.fn(),
    setupTray: jest.fn(),
}));
jest.mock('main/trustedOrigins', () => ({
    load: jest.fn(),
}));
jest.mock('main/UserActivityMonitor', () => ({
    on: jest.fn(),
    startMonitoring: jest.fn(),
}));
jest.mock('main/webRequest/webRequestManager', () => ({
    initialize: jest.fn(),
}));
jest.mock('main/windows/windowManager', () => ({
    getMainWindow: jest.fn(),
    showMainWindow: jest.fn(),
    sendToMattermostViews: jest.fn(),
    sendToRenderer: jest.fn(),
    getServerNameByWebContentsId: jest.fn(),
}));
describe('main/app/initialize', () => {
    beforeEach(() => {
        parseArgs.mockReturnValue({});
        Config.once.mockImplementation((event, cb) => {
            if (event === 'update') {
                cb();
            }
        });
        Config.data = {};
        Config.teams = [];
        app.whenReady.mockResolvedValue();
        app.requestSingleInstanceLock.mockReturnValue(true);
        app.getPath.mockImplementation((p) => `/basedir/${p}`);
    });

    afterEach(() => {
        jest.resetAllMocks();
        delete Config.data;
    });

    it('should initialize without errors', async () => {
        await initialize();
    });

    describe('initializeArgs', () => {
        it('should set datadir when specified', async () => {
            path.resolve.mockImplementation((p) => `/basedir${p}`);
            parseArgs.mockReturnValue({
                dataDir: '/some/dir',
            });
            await initialize();
            expect(app.setPath).toHaveBeenCalledWith('userData', '/basedir/some/dir');
        });
    });

    describe('initializeConfig', () => {
        it('should disable hardware acceleration when specified', async () => {
            Config.enableHardwareAcceleration = false;
            await initialize();
            expect(app.disableHardwareAcceleration).toHaveBeenCalled();
        });
    });

    describe('initializeBeforeAppReady', () => {
        it('should exit the app when single instance lock fails', () => {
            app.requestSingleInstanceLock.mockReturnValue(false);
        });
    });

    describe('initializeAfterAppReady', () => {
        if (process.platform !== 'darwin') {
            it('should set spell checker URL if applicable', async () => {
                Config.spellCheckerURL = 'http://server-1.com';
                await initialize();
                expect(session.defaultSession.setSpellCheckerDictionaryDownloadURL).toHaveBeenCalledWith('http://server-1.com/');
            });
        }

        it('should clear app cache if last version opened was older', async () => {
            wasUpdated.mockReturnValue(true);
            await initialize();
            expect(clearAppCache).toHaveBeenCalled();
        });

        it('should perform deeplink on win32', async () => {
            getDeeplinkingURL.mockReturnValue('mattermost://server-1.com');
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'argv', {
                value: ['mattermost', 'mattermost://server-1.com'],
            });
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            await initialize();
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });

            expect(WindowManager.showMainWindow).toHaveBeenCalledWith('mattermost://server-1.com');
        });

        it('should allow permission requests for supported types from trusted URLs', async () => {
            let callback = jest.fn();
            session.defaultSession.setPermissionRequestHandler.mockImplementation((cb) => {
                cb({id: 1, getURL: () => 'http://server-1.com'}, 'bad-permission', callback);
            });
            await initialize();
            expect(callback).toHaveBeenCalledWith(false);

            callback = jest.fn();
            WindowManager.getMainWindow.mockReturnValue({webContents: {id: 1}});
            session.defaultSession.setPermissionRequestHandler.mockImplementation((cb) => {
                cb({id: 1, getURL: () => 'http://server-1.com'}, 'openExternal', callback);
            });
            await initialize();
            expect(callback).toHaveBeenCalledWith(true);

            urlUtils.isTrustedURL.mockImplementation((url) => url === 'http://server-1.com');

            callback = jest.fn();
            session.defaultSession.setPermissionRequestHandler.mockImplementation((cb) => {
                cb({id: 2, getURL: () => 'http://server-1.com'}, 'openExternal', callback);
            });
            await initialize();
            expect(callback).toHaveBeenCalledWith(true);

            callback = jest.fn();
            session.defaultSession.setPermissionRequestHandler.mockImplementation((cb) => {
                cb({id: 2, getURL: () => 'http://server-2.com'}, 'openExternal', callback);
            });
            await initialize();
            expect(callback).toHaveBeenCalledWith(false);
        });
    });
});
