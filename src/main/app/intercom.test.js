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
    handleShowSettingsModal,
} from './intercom';

jest.mock('electron', () => ({
    app: {
        setSecureKeyboardEntryEnabled: jest.fn(),
        once: jest.fn(),
        removeListener: jest.fn(),
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
    addPriorityModal: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
    once: jest.fn(),
    on: jest.fn(),
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
        // Helper: build a BrowserWindow mock whose `once` records listeners so
        // tests can fire them on demand.
        const makeWindow = (initialVisible) => {
            const listeners = {};
            let visible = initialVisible;
            return {
                listeners,
                setVisible: (v) => {
                    visible = v;
                },
                isVisible: jest.fn(() => visible),
                once: jest.fn((event, cb) => {
                    listeners[event] = cb;
                }),
                removeListener: jest.fn((event, cb) => {
                    if (listeners[event] === cb) {
                        delete listeners[event];
                    }
                }),
                fire: (event) => listeners[event] && listeners[event](),
            };
        };

        afterEach(() => {
            delete global.__e2eAppReady;
            jest.useRealTimers();
            jest.clearAllMocks();
        });

        it('MM-48079 should not show onboarding screen or server screen if GPO server is pre-configured', () => {
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({
                isVisible: () => true,
                once: jest.fn(),
            });
            ServerManager.hasServers.mockReturnValue(true);

            handleMainWindowIsShown();
            expect(ModalManager.addModal).not.toHaveBeenCalled();
        });

        it('should mark __e2eAppReady synchronously without attaching listeners when the main window is already visible', () => {
            ServerManager.hasServers.mockReturnValue(true);
            const win = makeWindow(true);
            MainWindow.get.mockReturnValue(win);

            handleMainWindowIsShown();

            expect(global.__e2eAppReady).toBe(true);
            expect(win.once).not.toHaveBeenCalled();
            expect(MainWindow.once).not.toHaveBeenCalled();
        });

        it('should set __e2eAppReady via a `show` listener (not `ready-to-show`) when the window is not yet visible', () => {
            ServerManager.hasServers.mockReturnValue(true);
            const win = makeWindow(false);
            MainWindow.get.mockReturnValue(win);

            handleMainWindowIsShown();

            // We listen to `show` only — never `ready-to-show`, which fires
            // *before* the window is visible.
            expect(win.once).toHaveBeenCalledWith('show', expect.any(Function));
            expect(win.once).not.toHaveBeenCalledWith('ready-to-show', expect.any(Function));
            expect(global.__e2eAppReady).toBeUndefined();

            // The window becomes visible and the `show` event fires.
            win.fire('show');
            expect(global.__e2eAppReady).toBe(true);
        });

        it('should defer to MAIN_WINDOW_CREATED if no main window exists yet, then mark ready when it appears', () => {
            ServerManager.hasServers.mockReturnValue(true);
            MainWindow.get.mockReturnValue(undefined);

            handleMainWindowIsShown();

            // No window yet — should have registered a one-shot listener.
            expect(MainWindow.once).toHaveBeenCalledWith('main-window-created', expect.any(Function));
            expect(global.__e2eAppReady).toBeUndefined();

            // Window comes into existence (and happens to already be visible).
            const win = makeWindow(true);
            MainWindow.get.mockReturnValue(win);

            // Invoke the captured listener (simulating MainWindow emitting).
            const createdCb = MainWindow.once.mock.calls[0][1];
            createdCb();

            expect(global.__e2eAppReady).toBe(true);
        });
    });

    describe('handleShowSettingsModal', () => {
        beforeEach(() => {
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});
        });

        it('should open settings modal using addPriorityModal', () => {
            handleShowSettingsModal();
            expect(ModalManager.addPriorityModal).toHaveBeenCalledWith('settingsModal', 'mattermost-desktop://renderer/settings.html', '/some/preload.js', null, {});
        });

        it('should not open settings modal if no main window', () => {
            MainWindow.get.mockReturnValue(null);
            handleShowSettingsModal();
            expect(ModalManager.addPriorityModal).not.toHaveBeenCalled();
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
