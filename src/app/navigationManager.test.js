// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ModalManager from 'app/mainWindow/modals/modalManager';
import ServerHub from 'app/serverHub';
import WebContentsManager from 'app/views/webContentsManager';
import {BROWSER_HISTORY_PUSH} from 'common/communication';
import ServerManager from 'common/servers/serverManager';
import Utils from 'common/utils/util';
import ViewManager from 'common/views/viewManager';
import {handleWelcomeScreenModal} from 'main/app/intercom';

import {NavigationManager} from './navigationManager';

jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn(),
    },
}));

jest.mock('app/mainWindow/modals/modalManager', () => ({
    removeModal: jest.fn(),
}));

jest.mock('app/serverHub', () => ({
    showNewServerModal: jest.fn(),
}));

jest.mock('app/tabs/tabManager', () => ({
    switchToTab: jest.fn(),
}));

jest.mock('app/views/webContentsManager', () => ({
    getView: jest.fn(),
    getViewByWebContentsId: jest.fn(),
}));

jest.mock('common/communication', () => ({
    BROWSER_HISTORY_PUSH: 'BROWSER_HISTORY_PUSH',
    LOAD_FAILED: 'LOAD_FAILED',
    LOAD_SUCCESS: 'LOAD_SUCCESS',
}));

jest.mock('common/log', () => ({
    Logger: jest.fn().mockImplementation(() => ({
        error: jest.fn(),
        debug: jest.fn(),
        silly: jest.fn(),
    })),
}));

jest.mock('common/servers/serverManager', () => ({
    lookupServerByURL: jest.fn(),
    hasServers: jest.fn(),
    getRemoteInfo: jest.fn(),
    getServer: jest.fn(),
}));

jest.mock('common/utils/url', () => ({
    parseURL: (url) => {
        try {
            return new URL(url);
        } catch (e) {
            return null;
        }
    },
    getFormattedPathName: (pathname) => (pathname.length ? pathname : '/'),
}));

jest.mock('common/utils/util', () => ({
    isVersionGreaterThanOrEqualTo: jest.fn(),
}));

jest.mock('common/views/viewManager', () => ({
    getPrimaryView: jest.fn(),
    getViewLog: jest.fn(() => ({
        debug: jest.fn(),
        error: jest.fn(),
    })),
    isPrimaryView: jest.fn(),
}));

jest.mock('main/app/intercom', () => ({
    handleWelcomeScreenModal: jest.fn(),
}));

describe('app/navigationManager', () => {
    describe('openLinkInPrimaryTab', () => {
        const navigationManager = new NavigationManager();
        const baseView = {
            resetLoadingStatus: jest.fn(),
            load: jest.fn(),
            once: jest.fn(),
            isReady: jest.fn(),
            sendToRenderer: jest.fn(),
            removeListener: jest.fn(),
            id: 'view1',
            serverId: 'server1',
        };

        it('should load URL into matching view', () => {
            ServerManager.lookupServerByURL.mockImplementation(() => ({id: 'server1', url: new URL('http://server-1.com/')}));
            ViewManager.getPrimaryView.mockReturnValue({id: 'view1'});
            WebContentsManager.getView.mockReturnValue(baseView);
            baseView.isReady.mockReturnValue(false);

            navigationManager.openLinkInPrimaryTab('mattermost://server-1.com/deep/link?thing=yes');

            expect(baseView.load).toHaveBeenCalledWith('http://server-1.com/deep/link?thing=yes');
        });

        it('should send the URL to the view if its already loaded on a 6.0 server', () => {
            ServerManager.lookupServerByURL.mockImplementation(() => ({id: 'server1', url: new URL('http://server-1.com/')}));
            ViewManager.getPrimaryView.mockReturnValue({id: 'view1'});
            WebContentsManager.getView.mockReturnValue({
                ...baseView,
                serverId: 'server1',
            });
            ServerManager.getRemoteInfo.mockReturnValue({serverVersion: '6.0.0'});
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(true);
            baseView.isReady.mockReturnValue(true);

            navigationManager.openLinkInPrimaryTab('mattermost://server-1.com/deep/link?thing=yes');

            expect(baseView.sendToRenderer).toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, '/deep/link?thing=yes');
        });

        it('should throw error if view is missing', () => {
            ServerManager.lookupServerByURL.mockImplementation(() => ({id: 'server1', url: new URL('http://server-1.com/')}));
            ViewManager.getPrimaryView.mockReturnValue({id: 'view1'});
            WebContentsManager.getView.mockReturnValue(null);

            navigationManager.openLinkInPrimaryTab('mattermost://server-1.com/deep/link?thing=yes');

            expect(baseView.load).not.toHaveBeenCalled();
        });

        it('should open new server modal when using a server that does not exist', () => {
            ServerManager.hasServers.mockReturnValue(true);
            ServerManager.lookupServerByURL.mockReturnValue(null);

            navigationManager.openLinkInPrimaryTab('mattermost://server-2.com/deep/link?thing=yes');

            expect(ServerHub.showNewServerModal).toHaveBeenCalledWith('server-2.com/deep/link?thing=yes');
        });

        it('should handle welcome screen modal when no servers exist', () => {
            ServerManager.hasServers.mockReturnValue(false);
            ServerManager.lookupServerByURL.mockReturnValue(null);

            navigationManager.openLinkInPrimaryTab('mattermost://server-2.com/deep/link?thing=yes');

            expect(ModalManager.removeModal).toHaveBeenCalledWith('welcomeScreen');
            expect(handleWelcomeScreenModal).toHaveBeenCalledWith('server-2.com/deep/link?thing=yes');
        });

        it('should handle null URL gracefully', () => {
            navigationManager.openLinkInPrimaryTab(null);

            expect(ServerManager.lookupServerByURL).not.toHaveBeenCalled();
        });

        it('should handle empty URL gracefully', () => {
            navigationManager.openLinkInPrimaryTab('');

            expect(ServerManager.lookupServerByURL).not.toHaveBeenCalled();
        });
    });

    describe('handleBrowserHistoryPush', () => {
        const navigationManager = new NavigationManager();
        const mockView = {
            id: 'test-view',
            webContentsId: 1,
            serverId: 'server-1',
            sendToRenderer: jest.fn(),
            updateHistoryButton: jest.fn(),
        };
        const mockServer = {
            id: 'server-1',
            url: new URL('http://server-1.com'),
            isLoggedIn: true,
        };

        beforeEach(() => {
            WebContentsManager.getViewByWebContentsId.mockReturnValue(mockView);
            ServerManager.getServer.mockReturnValue(mockServer);
            ViewManager.isPrimaryView.mockReturnValue(false);
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should process browser history push for logged in user', () => {
            navigationManager.handleBrowserHistoryPush({sender: {id: 1}}, '/team/channel');

            expect(mockView.sendToRenderer).toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, '/team/channel');
            expect(mockView.updateHistoryButton).toHaveBeenCalled();
        });

        it('should process browser history push for primary view even when not logged in', () => {
            mockServer.isLoggedIn = false;
            ViewManager.isPrimaryView.mockReturnValue(true);

            navigationManager.handleBrowserHistoryPush({sender: {id: 1}}, '/team/channel');

            expect(mockView.sendToRenderer).toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, '/team/channel');
            expect(mockView.updateHistoryButton).toHaveBeenCalled();
        });

        it('should not process browser history push when view not found', () => {
            WebContentsManager.getViewByWebContentsId.mockReturnValue(null);

            navigationManager.handleBrowserHistoryPush({sender: {id: 1}}, '/team/channel');

            expect(mockView.sendToRenderer).not.toHaveBeenCalled();
            expect(mockView.updateHistoryButton).not.toHaveBeenCalled();
        });

        it('should not process browser history push when not logged in and not primary view', () => {
            mockServer.isLoggedIn = false;
            ViewManager.isPrimaryView.mockReturnValue(false);

            navigationManager.handleBrowserHistoryPush({sender: {id: 1}}, '/team/channel');

            expect(mockView.sendToRenderer).not.toHaveBeenCalled();
            expect(mockView.updateHistoryButton).not.toHaveBeenCalled();
        });

        it('should not process browser history push when server not found', () => {
            ServerManager.getServer.mockReturnValue(null);

            navigationManager.handleBrowserHistoryPush({sender: {id: 1}}, '/team/channel');

            expect(mockView.sendToRenderer).not.toHaveBeenCalled();
            expect(mockView.updateHistoryButton).not.toHaveBeenCalled();
        });

        it('should clean pathname when server has subpath', () => {
            ServerManager.getServer.mockReturnValue({
                ...mockServer,
                url: new URL('http://server-1.com/subpath'),
            });
            ViewManager.isPrimaryView.mockReturnValue(true);

            navigationManager.handleBrowserHistoryPush({sender: {id: 1}}, '/subpath/team/channel');

            expect(mockView.sendToRenderer).toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, '/team/channel');
            expect(mockView.updateHistoryButton).toHaveBeenCalled();
        });
    });
});
