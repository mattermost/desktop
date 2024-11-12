// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {TAB_BAR_HEIGHT, THREE_DOT_MENU_WIDTH, THREE_DOT_MENU_WIDTH_MAC, MENU_SHADOW_WIDTH} from 'common/utils/constants';
import MainWindow from 'main/windows/mainWindow';

import {ServerDropdownView} from './serverDropdownView';

jest.mock('app/serverViewState', () => ({}));

jest.mock('main/utils', () => ({
    getLocalPreload: (file) => file,
}));

jest.mock('electron', () => ({
    WebContentsView: jest.fn().mockImplementation(() => ({
        webContents: {
            loadURL: jest.fn(),
            focus: jest.fn(),
        },
        setBounds: jest.fn(),
    })),
    ipcMain: {
        on: jest.fn(),
    },
    app: {
        getPath: jest.fn(() => '/valid/downloads/path'),
    },
}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    on: jest.fn(),
    get: jest.fn(),
    getBounds: jest.fn(),
    sendToRenderer: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => ({
    on: jest.fn(),
    getOrderedServers: jest.fn().mockReturnValue([]),
}));

describe('main/views/serverDropdownView', () => {
    describe('getBounds', () => {
        beforeEach(() => {
            MainWindow.getBounds.mockReturnValue({width: 500, height: 400, x: 0, y: 0});
        });

        const serverDropdownView = new ServerDropdownView();
        if (process.platform === 'darwin') {
            it('should account for three dot menu, tab bar and shadow', () => {
                expect(serverDropdownView.getBounds(400, 300)).toStrictEqual({x: THREE_DOT_MENU_WIDTH_MAC - MENU_SHADOW_WIDTH, y: TAB_BAR_HEIGHT - MENU_SHADOW_WIDTH, width: 400, height: 300});
            });
        } else {
            it('should account for three dot menu, tab bar and shadow', () => {
                expect(serverDropdownView.getBounds(400, 300)).toStrictEqual({x: THREE_DOT_MENU_WIDTH - MENU_SHADOW_WIDTH, y: TAB_BAR_HEIGHT - MENU_SHADOW_WIDTH, width: 400, height: 300});
            });
        }
    });

    it('should change the view bounds based on open/closed state', () => {
        const serverDropdownView = new ServerDropdownView();
        serverDropdownView.view = {
            setBounds: jest.fn(),
            webContents: {
                focus: jest.fn(),
            },
        };
        serverDropdownView.bounds = {width: 400, height: 300};
        serverDropdownView.handleOpen();
        expect(serverDropdownView.view.setBounds).toBeCalledWith(serverDropdownView.bounds);
        serverDropdownView.handleClose();
        expect(serverDropdownView.view.setBounds).toBeCalledWith({width: 0, height: 0, x: expect.any(Number), y: expect.any(Number)});
    });
});
