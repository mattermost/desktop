// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Menu} from 'electron';

import ServerManager from 'common/servers/serverManager';

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
}));
jest.mock('app/serverHub', () => ({
    switchServer: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    sendToRenderer: jest.fn(),
    on: jest.fn(),
}));
jest.mock('app/mainWindow/modals/modalManager', () => ({
    addModal: jest.fn(),
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
});
