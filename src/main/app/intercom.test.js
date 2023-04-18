// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getLocalURLString, getLocalPreload} from 'main/utils';
import ServerManager from 'common/servers/serverManager';
import MainWindow from 'main/windows/mainWindow';
import ModalManager from 'main/views/modalManager';
import WindowManager from 'main/windows/windowManager';

import {
    handleOpenTab,
    handleCloseTab,
    handleWelcomeScreenModal,
    handleMainWindowIsShown,
} from './intercom';

jest.mock('common/config', () => ({
    setServers: jest.fn(),
}));
jest.mock('common/tabs/TabView', () => ({
    getDefaultConfigTeamFromTeam: jest.fn(),
}));
jest.mock('main/notifications', () => ({}));
jest.mock('common/servers/serverManager', () => ({
    setTabIsOpen: jest.fn(),
    getAllServers: jest.fn(),
    hasServers: jest.fn(),
    addServer: jest.fn(),
    editServer: jest.fn(),
    removeServer: jest.fn(),
    getServer: jest.fn(),
    getTab: jest.fn(),
    getLastActiveTabForServer: jest.fn(),
}));
jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn(),
    getLocalURLString: jest.fn(),
}));
jest.mock('main/views/viewManager', () => ({}));
jest.mock('main/views/modalManager', () => ({
    addModal: jest.fn(),
}));
jest.mock('main/windows/windowManager', () => ({
    switchServer: jest.fn(),
    switchTab: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
}));

jest.mock('./app', () => ({}));

describe('main/app/intercom', () => {
    describe('handleCloseTab', () => {
        it('should close the specified tab and switch to the next open tab', () => {
            ServerManager.getTab.mockReturnValue({server: {id: 'server-1'}});
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'tab-2'});
            handleCloseTab(null, 'tab-3');
            expect(ServerManager.setTabIsOpen).toBeCalledWith('tab-3', false);
            expect(WindowManager.switchTab).toBeCalledWith('tab-2');
        });
    });

    describe('handleOpenTab', () => {
        it('should open the specified tab', () => {
            handleOpenTab(null, 'tab-1');
            expect(WindowManager.switchTab).toBeCalledWith('tab-1');
        });
    });

    describe('handleWelcomeScreenModal', () => {
        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            ServerManager.getAllServers.mockReturnValue([]);
            ServerManager.hasServers.mockReturnValue(false);
        });

        it('should show welcomeScreen modal', async () => {
            const promise = Promise.resolve({});
            ModalManager.addModal.mockReturnValue(promise);

            handleWelcomeScreenModal();
            expect(ModalManager.addModal).toHaveBeenCalledWith('welcomeScreen', '/some/index.html', '/some/preload.js', [], {}, true);
        });
    });

    describe('handleMainWindowIsShown', () => {
        it('MM-48079 should not show onboarding screen or server screen if GPO server is pre-configured', () => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({
                isVisible: () => true,
            });
            ServerManager.hasServers.mockReturnValue(true);

            handleMainWindowIsShown();
            expect(ModalManager.addModal).not.toHaveBeenCalled();
        });
    });
});
