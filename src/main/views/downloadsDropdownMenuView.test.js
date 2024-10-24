// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import {DOWNLOADS_DROPDOWN_FULL_WIDTH, DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT, DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, TAB_BAR_HEIGHT} from 'common/utils/constants';
import MainWindow from 'main/windows/mainWindow';

import {DownloadsDropdownMenuView} from './downloadsDropdownMenuView';

jest.mock('main/utils', () => ({
    getLocalPreload: (file) => file,
}));
jest.mock('electron', () => {
    class NotificationMock {
        static isSupported = jest.fn();
        static didConstruct = jest.fn();
        constructor() {
            NotificationMock.didConstruct();
        }
        on = jest.fn();
        show = jest.fn();
        click = jest.fn();
        close = jest.fn();
    }
    return {
        app: {
            getAppPath: () => '',
            getPath: jest.fn(() => '/valid/downloads/path'),
        },
        WebContentsView: jest.fn().mockImplementation(() => ({
            setBackgroundColor: jest.fn(),
            webContents: {
                loadURL: jest.fn(),
                focus: jest.fn(),
                send: jest.fn(),
            },
            setBounds: jest.fn(),
        })),
        ipcMain: {
            emit: jest.fn(),
            handle: jest.fn(),
            on: jest.fn(),
            removeHandler: jest.fn(),
            removeListener: jest.fn(),
        },
        Notification: NotificationMock,
    };
});
jest.mock('macos-notification-state', () => ({
    getDoNotDisturb: jest.fn(),
}));
jest.mock('main/downloadsManager', () => ({}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    on: jest.fn(),
    get: jest.fn(),
    getBounds: jest.fn(),
    sendToRenderer: jest.fn(),
}));
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(false),
    readFileSync: jest.fn().mockImplementation((text) => text),
    writeFile: jest.fn(),
}));

describe('main/views/DownloadsDropdownMenuView', () => {
    beforeEach(() => {
        MainWindow.get.mockReturnValue({contentView: {addChildView: jest.fn()}});
        MainWindow.getBounds.mockReturnValue({width: 800, height: 600, x: 0, y: 0});
        getDarwinDoNotDisturb.mockReturnValue(false);
    });

    describe('getBounds', () => {
        it('should be placed top-left inside the downloads dropdown if coordinates not used', () => {
            const downloadsDropdownMenuView = new DownloadsDropdownMenuView();
            expect(downloadsDropdownMenuView.getBounds(800, DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT)).toStrictEqual({x: 800 - DOWNLOADS_DROPDOWN_FULL_WIDTH - DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, y: TAB_BAR_HEIGHT, width: DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, height: DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT});
        });
    });

    it('should change the view bounds based on open/closed state', () => {
        const downloadsDropdownMenuView = new DownloadsDropdownMenuView();
        downloadsDropdownMenuView.init();
        downloadsDropdownMenuView.bounds = {width: 400, height: 300};
        downloadsDropdownMenuView.handleOpen();
        expect(downloadsDropdownMenuView.view.setBounds).toBeCalledWith(downloadsDropdownMenuView.bounds);
        downloadsDropdownMenuView.handleClose();
        expect(downloadsDropdownMenuView.view.setBounds).toBeCalledWith({width: 0, height: 0, x: expect.any(Number), y: expect.any(Number)});
    });
});
