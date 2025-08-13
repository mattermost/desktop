// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MainWindow from 'app/mainWindow/mainWindow';
import {TOGGLE_LOADING_SCREEN_VISIBILITY} from 'common/communication';

import {LoadingScreen} from './loadingScreen';

jest.mock('electron', () => {
    const EventEmitter = jest.requireActual('events');
    const mockIpcMain = new EventEmitter();
    mockIpcMain.on = jest.fn();

    return {
        ipcMain: mockIpcMain,
        WebContentsView: jest.fn().mockImplementation(() => {
            const {EventEmitter} = jest.requireActual('events');
            const mockWebContents = new EventEmitter();
            mockWebContents.send = jest.fn();
            mockWebContents.loadURL = jest.fn();
            mockWebContents.isLoading = jest.fn();

            return {
                webContents: mockWebContents,
                setBounds: jest.fn(),
            };
        }),
    };
});
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));
jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn(),
    getWindowBoundaries: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
    on: jest.fn(),
}));

describe('main/views/loadingScreen', () => {
    describe('show', () => {
        const mainWindow = {
            contentView: {
                addChildView: jest.fn(),
                children: [],
                on: jest.fn(),
            },
            webContents: {
                id: 123,
            },
        };
        const loadingScreen = new LoadingScreen(mainWindow);

        beforeEach(() => {
            mainWindow.contentView.children = [];
            MainWindow.get.mockReturnValue(mainWindow);
        });

        it('should add the loading screen view to the window when not loading', () => {
            loadingScreen.view.webContents.isLoading.mockReturnValue(false);
            loadingScreen.show();
            expect(loadingScreen.view.webContents.send).toHaveBeenCalledWith(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
            expect(mainWindow.contentView.addChildView).toHaveBeenCalledWith(loadingScreen.view);
        });

        it('should add the loading screen view to the window after loading finishes', () => {
            loadingScreen.view.webContents.isLoading.mockReturnValue(true);
            loadingScreen.show();

            // Simulate the 'did-finish-load' event
            loadingScreen.view.webContents.emit('did-finish-load');

            expect(loadingScreen.view.webContents.send).toHaveBeenCalledWith(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
            expect(mainWindow.contentView.addChildView).toHaveBeenCalledWith(loadingScreen.view);
        });
    });
});
