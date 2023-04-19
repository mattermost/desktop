// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ServerManager from 'common/servers/serverManager';
import ViewManager from 'main/views/viewManager';

import {
    handleCloseTab,
    handleOpenTab,
} from './tabs';

jest.mock('common/servers/serverManager', () => ({
    setTabIsOpen: jest.fn(),
    getTab: jest.fn(),
    getLastActiveTabForServer: jest.fn(),
}));

jest.mock('main/views/viewManager', () => ({
    showById: jest.fn(),
}));

describe('main/app/tabs', () => {
    describe('handleCloseTab', () => {
        it('should close the specified tab and switch to the next open tab', () => {
            ServerManager.getTab.mockReturnValue({server: {id: 'server-1'}});
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'tab-2'});
            handleCloseTab(null, 'tab-3');
            expect(ServerManager.setTabIsOpen).toBeCalledWith('tab-3', false);
            expect(ViewManager.showById).toBeCalledWith('tab-2');
        });
    });

    describe('handleOpenTab', () => {
        it('should open the specified tab', () => {
            handleOpenTab(null, 'tab-1');
            expect(ViewManager.showById).toBeCalledWith('tab-1');
        });
    });
});
