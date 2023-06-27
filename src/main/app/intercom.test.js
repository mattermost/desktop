// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getLocalURLString, getLocalPreload} from 'main/utils';
import ServerManager from 'common/servers/serverManager';
import MainWindow from 'main/windows/mainWindow';
import ModalManager from 'main/views/modalManager';

import {
    handleWelcomeScreenModal,
    handleMainWindowIsShown,
} from './intercom';

jest.mock('app/serverViewState', () => ({}));
jest.mock('common/config', () => ({
    setServers: jest.fn(),
}));
jest.mock('main/notifications', () => ({}));
jest.mock('common/servers/serverManager', () => ({
    setViewIsOpen: jest.fn(),
    getAllServers: jest.fn(),
    hasServers: jest.fn(),
    addServer: jest.fn(),
    editServer: jest.fn(),
    removeServer: jest.fn(),
    getServer: jest.fn(),
    getView: jest.fn(),
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
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
}));

jest.mock('./app', () => ({}));

describe('main/app/intercom', () => {
    describe('handleWelcomeScreenModal', () => {
        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            ServerManager.hasServers.mockReturnValue(false);
        });

        it('should show welcomeScreen modal', async () => {
            const promise = Promise.resolve({});
            ModalManager.addModal.mockReturnValue(promise);

            handleWelcomeScreenModal();
            expect(ModalManager.addModal).toHaveBeenCalledWith('welcomeScreen', '/some/index.html', '/some/preload.js', null, {}, true);
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
