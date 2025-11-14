// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import {dialog, screen} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import JsonFileManager from 'common/JsonFileManager';
import {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {updatePaths} from 'main/constants';
import {ServerInfo} from 'main/server/serverInfo';

import {getDeeplinkingURL, resizeScreen, migrateMacAppStore, updateServerInfos} from './utils';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(),
    cpSync: jest.fn(),
}));

jest.mock('electron', () => ({
    app: {
        getPath: () => '/path/to/data',
        getAppPath: () => '/path/to/app',
    },
    nativeImage: {
        createFromPath: jest.fn(),
    },
    dialog: {
        showOpenDialogSync: jest.fn(),
        showMessageBoxSync: jest.fn(),
    },
    screen: {
        getAllDisplays: jest.fn(),
    },
}));

jest.mock('electron-is-dev', () => false);

jest.mock('common/config', () => ({
    setServers: jest.fn(),
}));
jest.mock('common/JsonFileManager');

jest.mock('main/autoUpdater', () => ({}));
jest.mock('main/constants', () => ({
    updatePaths: jest.fn(),
    secureStoragePath: '/path/to/secure',
}));
jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));
jest.mock('app/menus', () => ({
    refreshMenu: jest.fn(),
}));
jest.mock('app/views/webContentsManager', () => ({
    on: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
    getSize: jest.fn(),
    on: jest.fn(),
}));

jest.mock('app/tabs/tabManager', () => ({
    focusCurrentTab: jest.fn(),
}));

jest.mock('app/navigationManager', () => ({
    openLinkInPrimaryTab: jest.fn(),
}));

jest.mock('./initialize', () => ({
    mainProtocol: 'mattermost',
}));

jest.mock('common/servers/MattermostServer', () => ({
    MattermostServer: jest.fn().mockImplementation((config) => ({
        id: config.id || 'server-1',
        name: config.name || 'Test Server',
        url: config.url || 'http://localhost:8065',
    })),
}));

jest.mock('common/servers/serverManager', () => ({
    updateRemoteInfo: jest.fn(),
}));

jest.mock('main/server/serverInfo', () => ({
    ServerInfo: jest.fn(),
}));

describe('main/app/utils', () => {
    describe('getDeeplinkingURL', () => {
        it('should return undefined if deeplinking URL is not last argument', () => {
            expect(getDeeplinkingURL(['mattermost', 'mattermost://server-1.com', '--oops'])).toBeUndefined();
        });

        it('should return undefined if deeplinking URL is not valid', () => {
            expect(getDeeplinkingURL(['mattermost', 'mattermost://,a<lolbad'])).toBeUndefined();
        });

        it('should return url if deeplinking URL is valid', () => {
            expect(getDeeplinkingURL(['mattermost', 'mattermost://server-1.com'])).toBe('mattermost://server-1.com');
        });
    });

    describe('resizeScreen', () => {
        beforeEach(() => {
            screen.getAllDisplays.mockReturnValue([{
                workArea: {
                    x: 400,
                    y: 300,
                    width: 1920,
                    height: 1080,
                },
            }]);
        });
        it('should keep the same position if it is within a display', () => {
            const browserWindow = {
                getPosition: () => [500, 400],
                getSize: () => [1280, 720],
                setPosition: jest.fn(),
                center: jest.fn(),
                once: jest.fn(),
            };
            resizeScreen(browserWindow);
            expect(browserWindow.setPosition).toHaveBeenCalledWith(500, 400);
        });

        it('should keep the same position if it is halfway within a display', () => {
            let browserWindow = {
                getPosition: () => [1680, 400],
                getSize: () => [1280, 720],
                setPosition: jest.fn(),
                center: jest.fn(),
                once: jest.fn(),
            };
            resizeScreen(browserWindow);
            expect(browserWindow.setPosition).toHaveBeenCalledWith(1680, 400);

            browserWindow = {
                getPosition: () => [500, 1020],
                getSize: () => [1280, 720],
                setPosition: jest.fn(),
                center: jest.fn(),
                once: jest.fn(),
            };
            resizeScreen(browserWindow);
            expect(browserWindow.setPosition).toHaveBeenCalledWith(500, 1020);
        });

        it('should center if it is outside a display', () => {
            const browserWindow = {
                getPosition: () => [2400, 2000],
                getSize: () => [1280, 720],
                setPosition: jest.fn(),
                center: jest.fn(),
                once: jest.fn(),
            };
            resizeScreen(browserWindow);
            expect(browserWindow.setPosition).not.toHaveBeenCalled();
            expect(browserWindow.center).toHaveBeenCalled();
        });

        it('should snap to main window if it exists', () => {
            MainWindow.get.mockReturnValue({
                getPosition: () => [450, 350],
                getSize: () => [1280, 720],
            });
            const browserWindow = {
                getPosition: () => [500, 400],
                getSize: () => [1280, 720],
                setPosition: jest.fn(),
                center: jest.fn(),
                once: jest.fn(),
            };
            resizeScreen(browserWindow);
            expect(browserWindow.setPosition).toHaveBeenCalledWith(450, 350);
        });

        it('should snap to the middle of the main window', () => {
            MainWindow.get.mockReturnValue({
                getPosition: () => [450, 350],
                getSize: () => [1280, 720],
            });
            const browserWindow = {
                getPosition: () => [500, 400],
                getSize: () => [800, 600],
                setPosition: jest.fn(),
                center: jest.fn(),
                once: jest.fn(),
            };
            resizeScreen(browserWindow);
            expect(browserWindow.setPosition).toHaveBeenCalledWith(690, 410);
        });

        it('should never return non-integer value', () => {
            MainWindow.get.mockReturnValue({
                getPosition: () => [450, 350],
                getSize: () => [1280, 720],
            });
            const browserWindow = {
                getPosition: () => [450, 350],
                getSize: () => [1281, 721],
                setPosition: jest.fn(),
                center: jest.fn(),
                once: jest.fn(),
            };
            resizeScreen(browserWindow);
            expect(browserWindow.setPosition).toHaveBeenCalledWith(449, 349);
        });
    });

    describe('migrateMacAppStore', () => {
        it('should skip migration if already migrated', () => {
            JsonFileManager.mockImplementation(() => ({
                getValue: () => true,
            }));
            migrateMacAppStore();
            expect(dialog.showMessageBoxSync).not.toHaveBeenCalled();
        });

        it('should skip migration if folder does not exist', () => {
            JsonFileManager.mockImplementation(() => ({
                getValue: () => false,
            }));
            fs.existsSync.mockReturnValue(false);
            migrateMacAppStore();
            expect(fs.existsSync).toHaveBeenCalled();
            expect(dialog.showMessageBoxSync).not.toHaveBeenCalled();
        });

        it('should skip migration and set value if the user rejects import', () => {
            const migrationPrefs = {
                getValue: () => false,
                setValue: jest.fn(),
            };
            JsonFileManager.mockImplementation(() => migrationPrefs);
            fs.existsSync.mockReturnValue(true);
            dialog.showMessageBoxSync.mockReturnValue(1);
            migrateMacAppStore();
            expect(migrationPrefs.setValue).toHaveBeenCalledWith('masConfigs', true);
            expect(dialog.showOpenDialogSync).not.toHaveBeenCalled();
        });

        it('should do nothing if no directory is chosen, or if the dialog is closed', () => {
            JsonFileManager.mockImplementation(() => ({
                getValue: () => false,
            }));
            fs.existsSync.mockReturnValue(true);
            dialog.showMessageBoxSync.mockReturnValue(0);
            dialog.showOpenDialogSync.mockReturnValue([]);
            migrateMacAppStore();
            expect(dialog.showOpenDialogSync).toHaveBeenCalled();
            expect(updatePaths).not.toHaveBeenCalled();
        });

        // this doesn't run on windows because of path resolution
        if (process.platform !== 'win32') {
            it('should copy all of the configs when they exist to the new directory', () => {
                const migrationPrefs = {
                    getValue: () => false,
                    setValue: jest.fn(),
                };
                JsonFileManager.mockImplementation(() => migrationPrefs);
                fs.readFileSync.mockReturnValue('config-data');
                fs.existsSync.mockReturnValue(true);
                dialog.showMessageBoxSync.mockReturnValue(0);
                dialog.showOpenDialogSync.mockReturnValue(['/old/data/path']);
                migrateMacAppStore();
                expect(fs.cpSync).toHaveBeenCalledWith('/old/data/path', '/path/to/data', {recursive: true});
                expect(updatePaths).toHaveBeenCalled();
                expect(migrationPrefs.setValue).toHaveBeenCalledWith('masConfigs', true);
            });
        }
    });

    describe('updateServerInfos', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should catch error when ServerInfo.fetchRemoteInfo throws', async () => {
            const mockServer = new MattermostServer({id: 'server-1', name: 'Test Server', url: 'http://localhost:8065'});
            const mockError = new Error('Network error');
            const mockServerInfoInstance = {
                fetchRemoteInfo: jest.fn().mockRejectedValue(mockError),
            };
            ServerInfo.mockImplementation(() => mockServerInfoInstance);

            await updateServerInfos([mockServer]);

            expect(mockServerInfoInstance.fetchRemoteInfo).toHaveBeenCalled();
            expect(ServerManager.updateRemoteInfo).not.toHaveBeenCalled();
        });
    });
});
