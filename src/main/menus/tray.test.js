// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import ServerManager from 'common/servers/serverManager';

import {createTemplate} from './tray';

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => ({
    getOrderedServers: jest.fn(),
}));
jest.mock('app/serverViewState', () => ({
    switchServer: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    sendToRenderer: jest.fn(),
    on: jest.fn(),
}));
jest.mock('main/views/modalManager', () => ({
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
        const menu = createTemplate();
        for (let i = 0; i < 9; i++) {
            const menuItem = menu.find((item) => item.label === `server-${i}`);
            expect(menuItem).not.toBe(undefined);
        }
        for (let i = 9; i < 15; i++) {
            const menuItem = menu.find((item) => item.label === `server-${i}`);
            expect(menuItem).toBe(undefined);
        }
    });
});
