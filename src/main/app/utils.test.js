// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import {dialog} from 'electron';

import Config from 'common/config';
import JsonFileManager from 'common/JsonFileManager';
import {TAB_MESSAGING, TAB_FOCALBOARD, TAB_PLAYBOOKS} from 'common/tabs/TabView';
import Utils from 'common/utils/util';

import {updatePaths} from 'main/constants';
import {ServerInfo} from 'main/server/serverInfo';

import {getDeeplinkingURL, updateServerInfos, resizeScreen, migrateMacAppStore} from './utils';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(),
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
}));

jest.mock('electron-log', () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

jest.mock('common/config', () => ({
    set: jest.fn(),
}));
jest.mock('common/JsonFileManager');
jest.mock('common/utils/util', () => ({
    isVersionGreaterThanOrEqualTo: jest.fn(),
    getDisplayBoundaries: jest.fn(),
}));

jest.mock('main/autoUpdater', () => ({}));
jest.mock('main/constants', () => ({
    updatePaths: jest.fn(),
}));
jest.mock('main/menus/app', () => ({}));
jest.mock('main/menus/tray', () => ({}));
jest.mock('main/server/serverInfo', () => ({
    ServerInfo: jest.fn(),
}));
jest.mock('main/tray/tray', () => ({}));
jest.mock('main/windows/windowManager', () => ({}));

jest.mock('./initialize', () => ({
    mainProtocol: 'mattermost',
}));

describe('main/app/utils', () => {
    describe('updateServerInfos', () => {
        const tabs = [
            {
                name: TAB_MESSAGING,
                order: 0,
                isOpen: true,
            },
            {
                name: TAB_FOCALBOARD,
                order: 2,
            },
            {
                name: TAB_PLAYBOOKS,
                order: 1,
            },
        ];
        const teams = [
            {
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            },
        ];

        beforeEach(() => {
            Utils.isVersionGreaterThanOrEqualTo.mockImplementation((version) => version === '6.0.0');
            Config.set.mockImplementation((name, value) => {
                Config[name] = value;
            });
            const teamsCopy = JSON.parse(JSON.stringify(teams));
            Config.teams = teamsCopy;
        });

        afterEach(() => {
            delete Config.teams;
        });

        it('should open all tabs', async () => {
            ServerInfo.mockReturnValue({promise: {
                name: 'server-1',
                serverVersion: '6.0.0',
                hasPlaybooks: true,
                hasFocalboard: true,
            }});

            updateServerInfos(Config.teams);
            await new Promise(setImmediate); // workaround since Promise.all seems to not let me wait here

            expect(Config.teams.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_PLAYBOOKS).isOpen).toBe(true);
            expect(Config.teams.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_FOCALBOARD).isOpen).toBe(true);
        });

        it('should open only playbooks', async () => {
            ServerInfo.mockReturnValue({promise: {
                name: 'server-1',
                serverVersion: '6.0.0',
                hasPlaybooks: true,
                hasFocalboard: false,
            }});

            updateServerInfos(Config.teams);
            await new Promise(setImmediate); // workaround since Promise.all seems to not let me wait here

            expect(Config.teams.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_PLAYBOOKS).isOpen).toBe(true);
            expect(Config.teams.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_FOCALBOARD).isOpen).toBeUndefined();
        });

        it('should open none when server version is too old', async () => {
            ServerInfo.mockReturnValue({promise: {
                name: 'server-1',
                serverVersion: '5.0.0',
                hasPlaybooks: true,
                hasFocalboard: true,
            }});

            updateServerInfos(Config.teams);
            await new Promise(setImmediate); // workaround since Promise.all seems to not let me wait here

            expect(Config.teams.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_PLAYBOOKS).isOpen).toBeUndefined();
            expect(Config.teams.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_FOCALBOARD).isOpen).toBeUndefined();
        });
    });

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
            Utils.getDisplayBoundaries.mockReturnValue([{
                minX: 400,
                minY: 300,
                maxX: 2320,
                maxY: 1380,
                width: 1920,
                height: 1080,
            }]);
        });
        it('should keep the same position if it is within a display', () => {
            const browserWindow = {
                getPosition: () => [500, 400],
                getSize: () => [1280, 720],
                setPosition: jest.fn(),
                center: jest.fn(),
                on: jest.fn(),
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
                on: jest.fn(),
            };
            resizeScreen(browserWindow);
            expect(browserWindow.setPosition).toHaveBeenCalledWith(1680, 400);

            browserWindow = {
                getPosition: () => [500, 1020],
                getSize: () => [1280, 720],
                setPosition: jest.fn(),
                center: jest.fn(),
                on: jest.fn(),
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
                on: jest.fn(),
            };
            resizeScreen(browserWindow);
            expect(browserWindow.setPosition).not.toHaveBeenCalled();
            expect(browserWindow.center).toHaveBeenCalled();
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

        it('should copy all of the configs when they exist to the new directory', () => {
            const migrationPrefs = {
                getValue: () => false,
                setValue: jest.fn(),
            };
            JsonFileManager.mockImplementation(() => migrationPrefs);
            fs.readFileSync.mockReturnValue('config-data');
            fs.existsSync.mockImplementation((path) => {
                if (path === '/Library/Application Support/Mattermost') {
                    return true;
                }
                return ['config', 'app-state', 'bounds-info', 'migration-info'].some((filename) => path.endsWith(`${filename}.json`));
            });
            dialog.showMessageBoxSync.mockReturnValue(0);
            dialog.showOpenDialogSync.mockReturnValue(['/old/data/path']);
            migrateMacAppStore();
            expect(fs.readFileSync).toHaveBeenCalledWith('/old/data/path/config.json');
            expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/data/config.json', 'config-data');
            expect(fs.readFileSync).not.toHaveBeenCalledWith('/old/data/path/allowedProtocols.json');
            expect(fs.writeFileSync).not.toHaveBeenCalledWith('/path/to/data/allowedProtocols.json', 'config-data');
            expect(updatePaths).toHaveBeenCalled();
            expect(migrationPrefs.setValue).toHaveBeenCalledWith('masConfigs', true);
        });
    });
});
