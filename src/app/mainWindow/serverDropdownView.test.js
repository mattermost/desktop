// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import {UPDATE_SERVERS_DROPDOWN} from 'common/communication';
import {TAB_BAR_HEIGHT, THREE_DOT_MENU_WIDTH, THREE_DOT_MENU_WIDTH_MAC, MENU_SHADOW_WIDTH} from 'common/utils/constants';

import {ServerDropdownView} from './serverDropdownView';

jest.mock('app/serverHub', () => ({}));

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
jest.mock('main/themeManager', () => ({
    registerMainWindowView: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    on: jest.fn(),
    get: jest.fn(),
    getBounds: jest.fn(),
    sendToRenderer: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => ({
    on: jest.fn(),
    getOrderedServers: jest.fn().mockReturnValue([]),
    hasServers: jest.fn().mockReturnValue(false),
}));

jest.mock('common/appState', () => ({
    on: jest.fn(),
    getExpired: jest.fn(),
    getMentionsPerServer: jest.fn(),
    getUnreadsPerServer: jest.fn(),
    getPendingModals: jest.fn(),
}));

jest.mock('common/config', () => ({
    enableServerManagement: true,
}));

jest.mock('app/mainWindow/modals/modalManager', () => ({
    on: jest.fn(),
    isModalDisplayed: jest.fn(),
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
                isDestroyed: jest.fn(() => false),
                send: jest.fn(),
            },
        };
        serverDropdownView.bounds = {width: 400, height: 300};
        serverDropdownView.handleOpen();
        expect(serverDropdownView.view.setBounds).toBeCalledWith(serverDropdownView.bounds);
        serverDropdownView.handleClose();
        expect(serverDropdownView.view.setBounds).toBeCalledWith({width: 0, height: 0, x: expect.any(Number), y: expect.any(Number)});
    });

    it('should send the current modal state to the dropdown when opened', () => {
        ModalManager.isModalDisplayed.mockReturnValue(true);
        const serverDropdownView = new ServerDropdownView();
        serverDropdownView.view = {
            setBounds: jest.fn(),
            webContents: {
                focus: jest.fn(),
                isDestroyed: jest.fn(() => false),
                send: jest.fn(),
            },
        };
        serverDropdownView.handleOpen();
        expect(serverDropdownView.view.webContents.send).toBeCalledWith(UPDATE_SERVERS_DROPDOWN, [], undefined, undefined, true, undefined, undefined, undefined, true, undefined);
    });

    describe('handleModalOpen', () => {
        const mainWindow = {contentView: {addChildView: jest.fn()}};
        let serverDropdownView;

        beforeEach(() => {
            MainWindow.get.mockReturnValue(mainWindow);
            serverDropdownView = new ServerDropdownView();
            serverDropdownView.view = {};
        });

        it('should move the dropdown back on top when a server modal opens while it is open', () => {
            serverDropdownView.isOpen = true;
            serverDropdownView.handleModalOpen(true);
            expect(mainWindow.contentView.addChildView).toBeCalledWith(serverDropdownView.view);
        });

        it('should not move the dropdown when it is closed', () => {
            serverDropdownView.isOpen = false;
            serverDropdownView.handleModalOpen(true);
            expect(mainWindow.contentView.addChildView).not.toBeCalled();
        });

        it('should not move the dropdown for a global modal', () => {
            serverDropdownView.isOpen = true;
            serverDropdownView.handleModalOpen(false);
            expect(mainWindow.contentView.addChildView).not.toBeCalled();
        });
    });
});
