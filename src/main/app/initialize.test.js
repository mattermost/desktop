// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app, session} from 'electron';

import Config from 'common/config';
import parseArgs from 'main/ParseArgs';
import ViewManager from 'main/views/viewManager';

import {initialize} from './initialize';
import {clearAppCache, getDeeplinkingURL, wasUpdated} from './utils';

jest.mock('fs', () => ({
    accessSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(false),
    mkdirSync: jest.fn(),
    readFile: jest.fn(),
    readFileSync: jest.fn().mockImplementation((text) => text),
    unlinkSync: jest.fn(),
    writeFile: jest.fn(),
    writeFileSync: jest.fn(),
}));

jest.mock('path', () => {
    const original = jest.requireActual('path');
    return {
        ...original,
        dirname: jest.fn().mockImplementation((p) => p),
        resolve: jest.fn(),
    };
});

jest.mock('electron', () => ({
    app: {
        on: jest.fn(),
        handle: jest.fn(),
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
    nativeTheme: {
        on: jest.fn(),
    },
    screen: {
        on: jest.fn(),
    },
    session: {
        defaultSession: {
            webRequest: {
                onHeadersReceived: jest.fn(),
            },
            setSpellCheckerDictionaryDownloadURL: jest.fn(),
            setPermissionRequestHandler: jest.fn(),
            on: jest.fn(),
        },
    },
    protocol: {
        registerSchemesAsPrivileged: jest.fn(),
        handle: jest.fn(),
    },
}));
jest.mock('main/performanceMonitor', () => ({
    init: jest.fn(),
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

jest.mock('app/serverViewState', () => ({
    init: jest.fn(),
}));
jest.mock('common/config', () => ({
    once: jest.fn(),
    on: jest.fn(),
    init: jest.fn(),
    initRegistry: jest.fn(),
}));

jest.mock('main/allowProtocolDialog', () => ({
    init: jest.fn(),
}));
jest.mock('main/app/app', () => ({}));
jest.mock('main/app/config', () => ({
    handleConfigUpdate: jest.fn(),
    handleUpdateTheme: jest.fn(),
}));
jest.mock('main/app/intercom', () => ({
    handleMainWindowIsShown: jest.fn(),
}));
jest.mock('main/app/utils', () => ({
    clearAppCache: jest.fn(),
    getDeeplinkingURL: jest.fn(),
    handleUpdateMenuEvent: jest.fn(),
    shouldShowTrayIcon: jest.fn(),
    updateSpellCheckerLocales: jest.fn(),
    wasUpdated: jest.fn(),
    initCookieManager: jest.fn(),
    updateServerInfos: jest.fn(),
}));
jest.mock('common/appState', () => ({
    on: jest.fn(),
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
    init: jest.fn(),
}));
jest.mock('main/notifications', () => ({
    displayDownloadCompleted: jest.fn(),
    getDoNotDisturb: jest.fn(),
}));
jest.mock('main/ParseArgs', () => jest.fn());
jest.mock('common/servers/serverManager', () => ({
    reloadFromConfig: jest.fn(),
    getAllServers: jest.fn(),
    on: jest.fn(),
}));
jest.mock('main/tray/tray', () => ({
    refreshImages: jest.fn(),
    setup: jest.fn(),
}));
jest.mock('main/trustedOrigins', () => ({
    load: jest.fn(),
}));
jest.mock('main/UserActivityMonitor', () => ({
    on: jest.fn(),
    startMonitoring: jest.fn(),
}));
jest.mock('main/windows/callsWidgetWindow', () => ({}));
jest.mock('main/views/viewManager', () => ({
    getViewByWebContentsId: jest.fn(),
    handleDeepLink: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
    show: jest.fn(),
    sendToRenderer: jest.fn(),
}));
const originalProcess = process;
describe('main/app/initialize', () => {
    beforeAll(() => {
        global.process = {
            ...originalProcess,
            on: jest.fn(),
            chdir: jest.fn(),
            cwd: jest.fn().mockImplementation((text) => text),
        };
    });
    beforeEach(() => {
        parseArgs.mockReturnValue({});
        Config.once.mockImplementation((event, cb) => {
            if (event === 'update') {
                cb();
            }
        });
        Config.data = {};
        app.whenReady.mockResolvedValue();
        app.requestSingleInstanceLock.mockReturnValue(true);
        app.getPath.mockImplementation((p) => `/basedir/${p}`);
    });

    afterEach(() => {
        jest.resetAllMocks();
        delete Config.data;
    });

    afterAll(() => {
        global.process = originalProcess;
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

            expect(ViewManager.handleDeepLink).toHaveBeenCalledWith('mattermost://server-1.com');
        });
    });
});
