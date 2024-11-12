// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MainWindow from 'main/windows/mainWindow';

import {LoadingScreen} from './loadingScreen';

jest.mock('electron', () => ({
    ipcMain: {
        on: jest.fn(),
    },
}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
    on: jest.fn(),
}));

describe('main/views/loadingScreen', () => {
    describe('show', () => {
        const mainWindow = {
            contentView: {
                addChildView: jest.fn(),
                children: [],
            },
        };
        const loadingScreen = new LoadingScreen();
        loadingScreen.create = jest.fn();
        loadingScreen.setBounds = jest.fn();
        const view = {webContents: {send: jest.fn(), isLoading: () => false}};

        beforeEach(() => {
            mainWindow.contentView.children = [];
            MainWindow.get.mockReturnValue(mainWindow);
        });

        afterEach(() => {
            delete loadingScreen.view;
            jest.resetAllMocks();
        });

        it('should create new loading screen if one doesnt exist and add it to the window', () => {
            loadingScreen.create.mockImplementation(() => {
                loadingScreen.view = view;
            });
            loadingScreen.show();
            expect(loadingScreen.create).toHaveBeenCalled();
            expect(mainWindow.contentView.addChildView).toHaveBeenCalled();
        });

        it('should set the browser view as top if already exists and needs to be shown', () => {
            loadingScreen.view = view;
            mainWindow.contentView.children = [view];
            loadingScreen.show();
            expect(mainWindow.contentView.addChildView).toHaveBeenCalled();
        });
    });
});
