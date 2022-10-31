// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import {DOWNLOADS_DROPDOWN_FULL_WIDTH, DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT, DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, TAB_BAR_HEIGHT} from 'common/utils/constants';

import DownloadsDropdownMenuView from './downloadsDropdownMenuView';

jest.mock('main/utils', () => ({
    getLocalPreload: (file) => file,
    getLocalURLString: (file) => file,
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
        },
        BrowserView: jest.fn().mockImplementation(() => ({
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
        },
        Notification: NotificationMock,
    };
});
jest.mock('macos-notification-state', () => ({
    getDoNotDisturb: jest.fn(),
}));
jest.mock('main/windows/windowManager', () => ({
    sendToRenderer: jest.fn(),
}));
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(false),
    readFileSync: jest.fn().mockImplementation((text) => text),
    writeFile: jest.fn(),
}));

describe('main/views/DownloadsDropdownMenuView', () => {
    const window = {
        getContentBounds: () => ({width: 800, height: 600, x: 0, y: 0}),
        addBrowserView: jest.fn(),
        setTopBrowserView: jest.fn(),
    };
    const downloadsDropdownMenuView = new DownloadsDropdownMenuView(window, {}, false);

    beforeEach(() => {
        getDarwinDoNotDisturb.mockReturnValue(false);
    });

    describe('getBounds', () => {
        it('should be placed top-left inside the downloads dropdown if coordinates not used', () => {
            expect(downloadsDropdownMenuView.getBounds(DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT)).toStrictEqual({x: 800 - DOWNLOADS_DROPDOWN_FULL_WIDTH - DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, y: TAB_BAR_HEIGHT, width: DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, height: DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT});
        });
    });

    it('should change the view bounds based on open/closed state', () => {
        downloadsDropdownMenuView.bounds = {width: 400, height: 300};
        downloadsDropdownMenuView.handleOpen();
        expect(downloadsDropdownMenuView.view.setBounds).toBeCalledWith(downloadsDropdownMenuView.bounds);
        downloadsDropdownMenuView.handleClose();
        expect(downloadsDropdownMenuView.view.setBounds).toBeCalledWith({width: 0, height: 0, x: expect.any(Number), y: expect.any(Number)});
    });
});
