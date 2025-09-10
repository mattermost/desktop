// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import ServerManager from 'common/servers/serverManager';
import {getLocalPreload} from 'main/utils';

import {
    handleWelcomeScreenModal,
    handleMainWindowIsShown,
    handleToggleSecureInput,
} from './intercom';

jest.mock('electron', () => ({
    app: {
        setSecureKeyboardEntryEnabled: jest.fn(),
    },
}));
jest.mock('main/secureStorage', () => ({
    setSecret: jest.fn(),
    deleteSecret: jest.fn(),
    getSecret: jest.fn(),
}));

jest.mock('app/serverHub', () => ({}));
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
}));
jest.mock('common/views/viewManager', () => ({}));
jest.mock('app/mainWindow/modals/modalManager', () => ({
    addModal: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
}));

jest.mock('./app', () => ({}));

describe('main/app/intercom', () => {
    describe('handleWelcomeScreenModal', () => {
        beforeEach(() => {
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            ServerManager.hasServers.mockReturnValue(false);
        });

        it('should show welcomeScreen modal', async () => {
            const promise = Promise.resolve({});
            ModalManager.addModal.mockReturnValue(promise);

            handleWelcomeScreenModal();
            expect(ModalManager.addModal).toHaveBeenCalledWith('welcomeScreen', 'mattermost-desktop://renderer/welcomeScreen.html', '/some/preload.js', {prefillURL: undefined}, {}, true);
        });
    });

    describe('handleMainWindowIsShown', () => {
        it('MM-48079 should not show onboarding screen or server screen if GPO server is pre-configured', () => {
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({
                isVisible: () => true,
            });
            ServerManager.hasServers.mockReturnValue(true);

            handleMainWindowIsShown();
            expect(ModalManager.addModal).not.toHaveBeenCalled();
        });
    });

    describe('handleToggleSecureInput', () => {
        beforeEach(() => {
            MainWindow.get.mockReturnValue({
                isFocused: () => true,
            });
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should not fire for OSes that are not macOS', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });

            handleToggleSecureInput({}, true);

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });

            expect(app.setSecureKeyboardEntryEnabled).not.toHaveBeenCalled();
        });

        it('should not fire if window is not focused', () => {
            MainWindow.get.mockReturnValue({isFocused: () => false});
            handleToggleSecureInput({}, true);

            expect(app.setSecureKeyboardEntryEnabled).not.toHaveBeenCalled();
        });
    });
});
