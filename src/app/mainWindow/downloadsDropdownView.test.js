// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import MainWindow from 'app/mainWindow/mainWindow';
import {DOWNLOADS_DROPDOWN_FULL_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT, TAB_BAR_HEIGHT} from 'common/utils/constants';
import downloadsManager from 'main/downloadsManager';

import {DownloadsDropdownView} from './downloadsDropdownView';

jest.mock('main/utils', () => ({
    getLocalPreload: (file) => file,
}));
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(false),
    readFileSync: jest.fn().mockImplementation((text) => text),
    writeFile: jest.fn(),
}));
jest.mock('macos-notification-state', () => ({
    getDoNotDisturb: jest.fn(),
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
                session: {
                    webRequest: {
                        onHeadersReceived: jest.fn(),
                    },
                },
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
jest.mock('main/downloadsManager', () => ({
    getDownloads: jest.fn(),
    getIsOpen: jest.fn(),
    onOpen: jest.fn(),
    onClose: jest.fn(),
}));
jest.mock('app/mainWindow/modals/modalManager', () => ({
    on: jest.fn(),
}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    on: jest.fn(),
    get: jest.fn(),
    getBounds: jest.fn(),
    sendToRenderer: jest.fn(),
}));
jest.mock('main/themeManager', () => ({
    registerMainWindowView: jest.fn(),
}));

describe('main/views/DownloadsDropdownView', () => {
    beforeEach(() => {
        MainWindow.get.mockReturnValue({contentView: {addChildView: jest.fn()}});
        getDarwinDoNotDisturb.mockReturnValue(false);
    });
    describe('getBounds', () => {
        it('should be placed far right when window is large enough', () => {
            const downloadsDropdownView = new DownloadsDropdownView();
            expect(downloadsDropdownView.getBounds(800, DOWNLOADS_DROPDOWN_FULL_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT)).toStrictEqual({x: 800 - DOWNLOADS_DROPDOWN_FULL_WIDTH, y: TAB_BAR_HEIGHT, width: DOWNLOADS_DROPDOWN_FULL_WIDTH, height: DOWNLOADS_DROPDOWN_HEIGHT});
        });
        it('should be placed left if window is very small', () => {
            const downloadsDropdownView = new DownloadsDropdownView();
            expect(downloadsDropdownView.getBounds(500, DOWNLOADS_DROPDOWN_FULL_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT)).toStrictEqual({x: 0, y: TAB_BAR_HEIGHT, width: DOWNLOADS_DROPDOWN_FULL_WIDTH, height: DOWNLOADS_DROPDOWN_HEIGHT});
        });
    });

    it('should change the view bounds based on open/closed state', () => {
        MainWindow.getBounds.mockReturnValue({width: 800, height: 600, x: 0, y: 0});
        const downloadsDropdownView = new DownloadsDropdownView();
        downloadsDropdownView.init();
        downloadsDropdownView.bounds = {width: 400, height: 300};
        downloadsDropdownView.handleOpen();
        expect(downloadsDropdownView.view.setBounds).toBeCalledWith(downloadsDropdownView.bounds);
        downloadsDropdownView.handleClose();
        expect(downloadsDropdownView.view.setBounds).toBeCalledWith({width: 0, height: 0, x: expect.any(Number), y: expect.any(Number)});
    });

    describe('handleModalOpen', () => {
        const mainWindow = {contentView: {addChildView: jest.fn()}};
        let downloadsDropdownView;

        beforeEach(() => {
            MainWindow.getBounds.mockReturnValue({width: 800, height: 600, x: 0, y: 0});
            downloadsDropdownView = new DownloadsDropdownView();
            downloadsDropdownView.init();
            MainWindow.get.mockReturnValue(mainWindow);
        });

        it('should move the dropdown back on top when a server modal opens while it is open', () => {
            downloadsManager.getIsOpen.mockReturnValue(true);
            downloadsDropdownView.handleModalOpen(true);
            expect(mainWindow.contentView.addChildView).toBeCalledWith(downloadsDropdownView.view);
        });

        it('should not move the dropdown when it is closed', () => {
            downloadsManager.getIsOpen.mockReturnValue(false);
            downloadsDropdownView.handleModalOpen(true);
            expect(mainWindow.contentView.addChildView).not.toBeCalled();
        });

        it('should not move the dropdown for a global modal', () => {
            downloadsManager.getIsOpen.mockReturnValue(true);
            downloadsDropdownView.handleModalOpen(false);
            expect(mainWindow.contentView.addChildView).not.toBeCalled();
        });
    });
});
