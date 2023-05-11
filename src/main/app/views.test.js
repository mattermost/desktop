// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ServerManager from 'common/servers/serverManager';
import ViewManager from 'main/views/viewManager';

import {
    handleCloseView,
    handleOpenView,
} from './views';

jest.mock('common/servers/serverManager', () => ({
    setViewIsOpen: jest.fn(),
    getView: jest.fn(),
    getLastActiveTabForServer: jest.fn(),
}));

jest.mock('main/views/viewManager', () => ({
    showById: jest.fn(),
}));

describe('main/app/views', () => {
    describe('handleCloseView', () => {
        it('should close the specified view and switch to the next open view', () => {
            ServerManager.getView.mockReturnValue({server: {id: 'server-1'}});
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'view-2'});
            handleCloseView(null, 'view-3');
            expect(ServerManager.setViewIsOpen).toBeCalledWith('view-3', false);
            expect(ViewManager.showById).toBeCalledWith('view-2');
        });
    });

    describe('handleOpenView', () => {
        it('should open the specified view', () => {
            handleOpenView(null, 'view-1');
            expect(ViewManager.showById).toBeCalledWith('view-1');
        });
    });
});
