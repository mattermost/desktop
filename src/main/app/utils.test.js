// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs-extra';

import {dialog, screen} from 'electron';

import JsonFileManager from 'common/JsonFileManager';

import {updatePaths} from 'main/constants';

import {getDeeplinkingURL, resizeScreen, migrateMacAppStore} from './utils';

jest.mock('fs-extra', () => ({
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(),
    copySync: jest.fn(),
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
}));
jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));
jest.mock('main/menus/app', () => ({}));
jest.mock('main/menus/tray', () => ({}));
jest.mock('main/tray/tray', () => ({}));
jest.mock('main/views/viewManager', () => ({}));
jest.mock('main/windows/mainWindow', () => ({}));

jest.mock('./initialize', () => ({
    mainProtocol: 'mattermost',
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
                expect(fs.copySync).toHaveBeenCalledWith('/old/data/path', '/path/to/data');
                expect(updatePaths).toHaveBeenCalled();
                expect(migrationPrefs.setValue).toHaveBeenCalledWith('masConfigs', true);
            });
        }
    });
});
