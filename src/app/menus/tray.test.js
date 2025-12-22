// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Menu} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import ServerManager from 'common/servers/serverManager';
import {localizeMessage} from 'main/i18nManager';

import createTrayMenu from './tray';

jest.mock('electron', () => ({
    Menu: {
        buildFromTemplate: jest.fn(),
    },
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => ({
    getOrderedServers: jest.fn(),
    updateCurrentServer: jest.fn(),
}));
jest.mock('app/serverHub', () => ({
    switchServer: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
    show: jest.fn(),
    sendToRenderer: jest.fn(),
    on: jest.fn(),
}));
jest.mock('app/mainWindow/modals/modalManager', () => ({
    addModal: jest.fn(),
}));
jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn((file) => file),
}));
jest.mock('common/constants', () => ({
    ModalConstants: {
        SETTINGS_MODAL: 'settings-modal',
    },
}));

describe('main/menus/tray', () => {
    it('should show the first 9 servers (using order)', () => {
        const servers = [...Array(15).keys()].map((key) => ({
            id: `server-${key}`,
            name: `server-${key}`,
            url: `http://server-${key}.com`,
        }));
        ServerManager.getOrderedServers.mockReturnValue(servers);
        createTrayMenu();
        expect(Menu.buildFromTemplate).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({label: 'server-0'}),
            expect.objectContaining({label: 'server-1'}),
            expect.objectContaining({label: 'server-2'}),
            expect.objectContaining({label: 'server-3'}),
            expect.objectContaining({label: 'server-4'}),
            expect.objectContaining({label: 'server-5'}),
            expect.objectContaining({label: 'server-6'}),
            expect.objectContaining({label: 'server-7'}),
            expect.objectContaining({label: 'server-8'}),
        ]));
    });

    it('should open main window if it is not visible when clicking a server', () => {
        const servers = [{
            id: 'server-1',
            name: 'Test Server',
            url: 'http://test.com',
        }];
        ServerManager.getOrderedServers.mockReturnValue(servers);

        const mockWindow = {
            isVisible: jest.fn().mockReturnValue(false),
        };
        MainWindow.get.mockReturnValue(mockWindow);

        createTrayMenu();

        const template = Menu.buildFromTemplate.mock.calls[0][0];
        const serverMenuItem = template.find((item) => item.label === 'Test Server');

        expect(serverMenuItem).toBeDefined();
        expect(serverMenuItem.click).toBeDefined();

        serverMenuItem.click();

        expect(MainWindow.show).toHaveBeenCalled();
        expect(ServerManager.updateCurrentServer).toHaveBeenCalledWith('server-1');
    });

    it('should open main window if it is not visible when clicking settings', () => {
        ServerManager.getOrderedServers.mockReturnValue([]);
        localizeMessage.mockReturnValue('Settings');

        const mockWindow = {
            isVisible: jest.fn().mockReturnValue(false),
            show: jest.fn(),
        };
        MainWindow.get.mockReturnValue(mockWindow);

        createTrayMenu();

        const template = Menu.buildFromTemplate.mock.calls[0][0];
        const settingsMenuItem = template.find((item) => item.label === 'Settings');

        expect(settingsMenuItem).toBeDefined();
        expect(settingsMenuItem.click).toBeDefined();

        settingsMenuItem.click();

        expect(mockWindow.show).toHaveBeenCalled();
        expect(ModalManager.addModal).toHaveBeenCalled();
    });
});
