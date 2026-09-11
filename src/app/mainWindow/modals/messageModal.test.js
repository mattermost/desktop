// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import Config from 'common/config';

import {MessageModal} from './messageModal';

jest.mock('electron', () => ({
    app: {
        name: 'Mattermost',
        quit: jest.fn(),
    },
}));

jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid'),
}));

jest.mock('app/mainWindow/mainWindow', () => ({
    __esModule: true,
    default: {
        on: jest.fn(),
        get: jest.fn(),
    },
}));

jest.mock('app/mainWindow/modals/modalManager', () => ({
    __esModule: true,
    default: {
        addModal: jest.fn(),
    },
}));

jest.mock('common/config', () => ({
    __esModule: true,
    default: {
        set: jest.fn(),
    },
}));

jest.mock('common/constants', () => ({
    ModalConstants: {
        MESSAGE_MODAL: 'messageModal',
    },
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn((id, defaultMessage) => defaultMessage),
}));

jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn(() => 'preload'),
}));

describe('app/mainWindow/modals/messageModal', () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('showMessageModal', () => {
        it('should return the fallback result without opening a modal when there is no main window', async () => {
            MainWindow.get.mockReturnValue(null);
            const messageModal = new MessageModal();

            const result = await messageModal.showMessageModal({type: 'question', title: 't', message: 'm', cancelId: 2});

            expect(result).toEqual({response: 2, checkboxChecked: false});
            expect(ModalManager.addModal).not.toHaveBeenCalled();
        });

        it('should open a modal via the ModalManager when a main window exists', async () => {
            MainWindow.get.mockReturnValue({});
            ModalManager.addModal.mockReturnValue(Promise.resolve({response: 0, checkboxChecked: false}));
            const messageModal = new MessageModal();

            const result = await messageModal.showMessageModal({type: 'info', title: 't', message: 'm'});

            expect(ModalManager.addModal).toHaveBeenCalled();
            expect(result).toEqual({response: 0, checkboxChecked: false});
        });
    });

    describe('handleCloseConfirm', () => {
        it('should persist the preference and quit when the user confirms', async () => {
            const messageModal = new MessageModal();
            jest.spyOn(messageModal, 'showMessageModal').mockResolvedValue({response: 0, checkboxChecked: true});

            messageModal.handleCloseConfirm();
            await new Promise(setImmediate);

            expect(Config.set).toHaveBeenCalledWith('alwaysClose', true);
            expect(app.quit).toHaveBeenCalled();
        });

        it('should not quit when the user declines', async () => {
            const messageModal = new MessageModal();
            jest.spyOn(messageModal, 'showMessageModal').mockResolvedValue({response: 1, checkboxChecked: true});

            messageModal.handleCloseConfirm();
            await new Promise(setImmediate);

            expect(Config.set).toHaveBeenCalledWith('alwaysClose', false);
            expect(app.quit).not.toHaveBeenCalled();
        });
    });

    describe('handleMinimizeToTray', () => {
        it('should persist the preference and hide the window', async () => {
            const window = {blur: jest.fn(), hide: jest.fn()};
            MainWindow.get.mockReturnValue(window);
            const messageModal = new MessageModal();
            jest.spyOn(messageModal, 'showMessageModal').mockResolvedValue({response: 0, checkboxChecked: false});

            messageModal.handleMinimizeToTray();
            await new Promise(setImmediate);

            expect(Config.set).toHaveBeenCalledWith('alwaysMinimize', false);
            expect(window.hide).toHaveBeenCalled();
        });
    });
});
