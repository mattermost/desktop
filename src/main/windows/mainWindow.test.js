// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';
import path from 'path';

import {BrowserWindow, screen, app, globalShortcut, dialog} from 'electron';

import {SELECT_NEXT_TAB, SELECT_PREVIOUS_TAB} from 'common/communication';
import Config from 'common/config';
import {DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH} from 'common/utils/constants';
import * as Validator from 'common/Validator';

import {MainWindow} from './mainWindow';

import ContextMenu from '../contextMenu';
import {isInsideRectangle} from '../utils';

jest.mock('path', () => ({
    join: jest.fn(),
    resolve: jest.fn(),
}));

jest.mock('electron', () => ({
    app: {
        getAppPath: jest.fn(),
        getPath: jest.fn(),
        hide: jest.fn(),
        quit: jest.fn(),
        relaunch: jest.fn(),
    },
    dialog: {
        showMessageBox: jest.fn(),
    },
    BrowserWindow: jest.fn(),
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn(),
    },
    screen: {
        getDisplayMatching: jest.fn(),
        getPrimaryDisplay: jest.fn(),
    },
    globalShortcut: {
        register: jest.fn(),
        registerAll: jest.fn(),
    },
}));

jest.mock('common/config', () => ({
    set: jest.fn(),
}));
jest.mock('common/utils/util', () => ({
    isVersionGreaterThanOrEqualTo: jest.fn(),
}));

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
}));

jest.mock('common/Validator', () => ({
    validateBoundsInfo: jest.fn(),
}));

jest.mock('../contextMenu', () => jest.fn());

jest.mock('../utils', () => ({
    isInsideRectangle: jest.fn(),
    getLocalPreload: jest.fn(),
    isKDE: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));

describe('main/windows/mainWindow', () => {
    describe('init', () => {
        const baseWindow = {
            setMenuBarVisibility: jest.fn(),
            setAutoHideMenuBar: jest.fn(),
            loadURL: jest.fn(),
            once: jest.fn(),
            on: jest.fn(),
            maximize: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            blur: jest.fn(),
            minimize: jest.fn(),
            webContents: {
                on: jest.fn(),
                send: jest.fn(),
                setWindowOpenHandler: jest.fn(),
            },
            contentView: {
                on: jest.fn(),
            },
            isMaximized: jest.fn(),
            isFullScreen: jest.fn(),
            getBounds: jest.fn(),
            isMinimized: jest.fn().mockReturnValue(false),
        };

        beforeEach(() => {
            baseWindow.loadURL.mockImplementation(() => ({
                catch: jest.fn(),
            }));
            BrowserWindow.mockImplementation(() => baseWindow);
            fs.readFileSync.mockImplementation(() => '{"x":400,"y":300,"width":1280,"height":700,"maximized":false,"fullscreen":false}');
            path.join.mockImplementation(() => 'anyfile.txt');
            const primaryDisplay = {id: 1, scaleFactor: 1, bounds: {x: 0, y: 0, width: 1920, height: 1080}};
            screen.getDisplayMatching.mockReturnValue(primaryDisplay);
            screen.getPrimaryDisplay.mockReturnValue(primaryDisplay);
            isInsideRectangle.mockReturnValue(true);
            Validator.validateBoundsInfo.mockImplementation((data) => data);
            ContextMenu.mockImplementation(() => ({
                reload: jest.fn(),
            }));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should set window size using bounds read from file', () => {
            const mainWindow = new MainWindow();
            mainWindow.init();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                x: 400,
                y: 300,
                width: 1280,
                height: 700,
                maximized: false,
                fullscreen: false,
            }));
        });

        it('should set scaled window size on Windows using bounds read from file for non-primary monitor', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            screen.getDisplayMatching.mockImplementation(() => ({id: 2, scaleFactor: 2, bounds: {x: 0, y: 0, width: 1920, height: 1080}}));
            const mainWindow = new MainWindow();
            mainWindow.init();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                x: 400,
                y: 300,
                width: 640,
                height: 350,
                maximized: false,
                fullscreen: false,
            }));

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should NOT set scaled window size on Windows using bounds read from file for primary monitor', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            screen.getDisplayMatching.mockImplementation(() => ({id: 1, scaleFactor: 2, bounds: {x: 0, y: 0, width: 1920, height: 1080}}));
            const mainWindow = new MainWindow();
            mainWindow.init();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                x: 400,
                y: 300,
                width: 1280,
                height: 700,
                maximized: false,
                fullscreen: false,
            }));

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should NOT set scaled window size on Mac using bounds read from file for non-primary monitor', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            screen.getDisplayMatching.mockImplementation(() => ({id: 2, scaleFactor: 2, bounds: {x: 0, y: 0, width: 1920, height: 1080}}));
            const mainWindow = new MainWindow();
            mainWindow.init();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                x: 400,
                y: 300,
                width: 1280,
                height: 700,
                maximized: false,
                fullscreen: false,
            }));

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should set default window size when failing to read bounds from file', () => {
            fs.readFileSync.mockImplementation(() => 'just a bunch of garbage');
            const mainWindow = new MainWindow();
            mainWindow.init();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                width: DEFAULT_WINDOW_WIDTH,
                height: DEFAULT_WINDOW_HEIGHT,
            }));
        });

        it('should set default window size when bounds are outside the normal screen', () => {
            fs.readFileSync.mockImplementation(() => '{"x":-400,"y":-300,"width":1280,"height":700,"maximized":false,"fullscreen":false}');
            isInsideRectangle.mockReturnValue(false);
            const mainWindow = new MainWindow();
            mainWindow.init();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                width: DEFAULT_WINDOW_WIDTH,
                height: DEFAULT_WINDOW_HEIGHT,
            }));
        });

        it('should reset zoom level and maximize if applicable on ready-to-show', () => {
            const window = {
                ...baseWindow,
                once: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'ready-to-show') {
                        cb();
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            fs.readFileSync.mockImplementation(() => '{"x":400,"y":300,"width":1280,"height":700,"maximized":true,"fullscreen":false}');
            Config.hideOnStart = false;
            const mainWindow = new MainWindow();
            mainWindow.init();
            expect(window.webContents.zoomLevel).toStrictEqual(0);
            expect(window.maximize).toBeCalled();
        });

        it('should not show window on ready-to-show', () => {
            const window = {
                ...baseWindow,
                once: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'ready-to-show') {
                        cb();
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            fs.readFileSync.mockImplementation(() => '{"x":400,"y":300,"width":1280,"height":700,"maximized":true,"fullscreen":false}');
            Config.hideOnStart = true;
            const mainWindow = new MainWindow();
            mainWindow.init();
            expect(window.show).not.toHaveBeenCalled();
        });

        it('should save window state on close if the app will quit', () => {
            global.willAppQuit = true;
            const window = {
                ...baseWindow,
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'close') {
                        cb({preventDefault: jest.fn()});
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            const mainWindow = new MainWindow();
            mainWindow.init();
            global.willAppQuit = false;
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        it('should hide window on close for Windows if app wont quit and config item is set', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });
            const window = {
                ...baseWindow,
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'close') {
                        cb({preventDefault: jest.fn()});
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            Config.minimizeToTray = true;
            Config.alwaysMinimize = true;
            const mainWindow = new MainWindow();
            mainWindow.init();
            Config.minimizeToTray = false;
            Config.alwaysMinimize = false;
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(window.hide).toHaveBeenCalled();
        });

        it('should close app on close window for Windows if app wont quit and config item is not set', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });
            const window = {
                ...baseWindow,
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'close') {
                        cb({preventDefault: jest.fn()});
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            Config.alwaysClose = true;
            const mainWindow = new MainWindow();
            mainWindow.init();
            Config.alwaysClose = false;
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(app.quit).toHaveBeenCalled();
        });

        it('should close app on Windows if window closed depending on user input', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });
            const window = {
                ...baseWindow,
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'close') {
                        cb({preventDefault: jest.fn()});
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            dialog.showMessageBox.mockResolvedValue({response: 1});
            const mainWindow = new MainWindow();
            mainWindow.init();
            expect(app.quit).not.toHaveBeenCalled();
            const promise = Promise.resolve({response: 0});
            dialog.showMessageBox.mockImplementation(() => promise);
            const mainWindow2 = new MainWindow();
            mainWindow2.init();
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            await promise;
            expect(app.quit).toHaveBeenCalled();
        });

        it('should hide window on close for Linux if app wont quit and config item is set', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
            const window = {
                ...baseWindow,
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'close') {
                        cb({preventDefault: jest.fn()});
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            Config.minimizeToTray = true;
            Config.alwaysMinimize = true;
            const mainWindow = new MainWindow();
            mainWindow.init();
            Config.minimizeToTray = false;
            Config.alwaysMinimize = false;
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(window.hide).toHaveBeenCalled();
        });

        it('should close app on close window for Linux if app wont quit and config item is not set', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
            const window = {
                ...baseWindow,
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'close') {
                        cb({preventDefault: jest.fn()});
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            Config.alwaysClose = true;
            const mainWindow = new MainWindow();
            mainWindow.init();
            Config.alwaysClose = false;
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(app.quit).toHaveBeenCalled();
        });

        it('should close app on linux if window closed depending on user input', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
            const window = {
                ...baseWindow,
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'close') {
                        cb({preventDefault: jest.fn()});
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            dialog.showMessageBox.mockResolvedValue({response: 1});
            const mainWindow = new MainWindow();
            mainWindow.init();
            expect(app.quit).not.toHaveBeenCalled();
            const promise = Promise.resolve({response: 0});
            dialog.showMessageBox.mockImplementation(() => promise);
            const mainWindow2 = new MainWindow();
            mainWindow2.init();
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            await promise;
            expect(app.quit).toHaveBeenCalled();
        });

        it('should hide window on close for Mac if app wont quit and window is not full screen', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            const window = {
                ...baseWindow,
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'close') {
                        cb({preventDefault: jest.fn()});
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            const mainWindow = new MainWindow();
            mainWindow.init();
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(app.hide).toHaveBeenCalled();
        });

        it('should leave full screen and then hide window on close for Mac if app wont quit and window is full screen', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            const window = {
                ...baseWindow,
                isFullScreen: jest.fn().mockImplementation(() => true),
                setFullScreen: jest.fn(),
                once: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'leave-full-screen') {
                        cb();
                    }
                }),
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'close') {
                        cb({preventDefault: jest.fn()});
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            const mainWindow = new MainWindow();
            mainWindow.init();
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(window.once).toHaveBeenCalledWith('leave-full-screen', expect.any(Function));
            expect(app.hide).toHaveBeenCalled();
            expect(window.setFullScreen).toHaveBeenCalledWith(false);
        });

        it('should select views using alt+cmd+arrow keys on Mac', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            const window = {
                ...baseWindow,
                webContents: {
                    ...baseWindow.webContents,
                    on: jest.fn().mockImplementation((event, cb) => {
                        if (event === 'before-input-event') {
                            cb(null, {alt: true, meta: true, key: 'ArrowRight'});
                            cb(null, {alt: true, meta: true, key: 'ArrowLeft'});
                        }
                    }),
                },
            };
            BrowserWindow.mockImplementation(() => window);
            const mainWindow = new MainWindow();
            mainWindow.init();
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(window.webContents.send).toHaveBeenCalledWith(SELECT_NEXT_TAB);
            expect(window.webContents.send).toHaveBeenCalledWith(SELECT_PREVIOUS_TAB);
        });

        it('should add override shortcuts for the top menu on Linux to stop it showing up', () => {
            const {isKDE} = require('../utils');
            isKDE.mockReturnValue(false);

            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
            const window = {
                ...baseWindow,
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'focus') {
                        cb();
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            const mainWindow = new MainWindow();
            mainWindow.getBounds = jest.fn();
            mainWindow.init();
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(globalShortcut.registerAll).toHaveBeenCalledWith(['Alt+F', 'Alt+E', 'Alt+V', 'Alt+H', 'Alt+W', 'Alt+P'], expect.any(Function));
        });

        it('should register global shortcuts even when window is minimized on KDE/KWin', () => {
            const {isKDE} = require('../utils');
            isKDE.mockReturnValue(true);

            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
            const window = {
                ...baseWindow,
                isMinimized: jest.fn().mockReturnValue(true),
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'focus') {
                        cb();
                    }
                }),
            };
            BrowserWindow.mockImplementation(() => window);
            const mainWindow = new MainWindow();
            mainWindow.getBounds = jest.fn();
            mainWindow.init();

            expect(globalShortcut.registerAll).toHaveBeenCalled();
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });

    describe('show', () => {
        const mainWindow = new MainWindow();
        mainWindow.win = {
            visible: false,
            isVisible: () => mainWindow.visible,
            show: jest.fn(),
            focus: jest.fn(),
            on: jest.fn(),
            once: jest.fn(),
            webContents: {
                setWindowOpenHandler: jest.fn(),
            },
        };
        mainWindow.init = jest.fn();

        beforeEach(() => {
            mainWindow.win.show.mockImplementation(() => {
                mainWindow.visible = true;
            });
        });

        afterEach(() => {
            mainWindow.ready = false;
            mainWindow.win.visible = false;
            jest.resetAllMocks();
        });

        it('should show main window if it is exists on macOS/Linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            mainWindow.ready = true;
            mainWindow.show();
            expect(mainWindow.win.show).toHaveBeenCalled();
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should focus main window if it exists and is visible on Windows', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });
            mainWindow.ready = true;
            mainWindow.win.visible = true;
            mainWindow.show();
            expect(mainWindow.win.focus).toHaveBeenCalled();
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should init if the main window does not exist', () => {
            mainWindow.show();
            expect(mainWindow.init).toHaveBeenCalled();
        });
    });

    describe('onUnresponsive', () => {
        const mainWindow = new MainWindow();

        beforeEach(() => {
            mainWindow.win = {};
        });

        it('should call app.relaunch when user elects not to wait', async () => {
            const promise = Promise.resolve({response: 0});
            dialog.showMessageBox.mockImplementation(() => promise);
            mainWindow.onUnresponsive();
            await promise;
            expect(app.relaunch).toBeCalled();
        });
    });
});
