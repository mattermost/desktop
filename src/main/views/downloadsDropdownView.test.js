// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import {DOWNLOADS_DROPDOWN_FULL_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT, TAB_BAR_HEIGHT} from 'common/utils/constants';
import MainWindow from 'main/windows/mainWindow';

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
    onOpen: jest.fn(),
    onClose: jest.fn(),
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
});
