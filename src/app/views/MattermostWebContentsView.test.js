// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcMain} from 'electron';

import AppState from 'common/appState';
import {BROWSER_HISTORY_PUSH, LOAD_FAILED, SERVER_URL_CHANGED, UPDATE_SHORTCUT_MENU, UPDATE_TARGET_URL} from 'common/communication';
import {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {MattermostView, ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {updateServerInfos} from 'main/app/utils';
import {getServerAPI} from 'main/server/serverAPI';

import {MattermostWebContentsView} from './MattermostWebContentsView';

import ContextMenu from '../../main/contextMenu';
import MainWindow from '../mainWindow/mainWindow';

jest.mock('electron', () => ({
    app: {
        getVersion: () => '5.0.0',
        getPath: jest.fn(() => '/valid/downloads/path'),
    },
    WebContentsView: jest.fn().mockImplementation(() => ({
        webContents: {
            id: 42,
            loadURL: jest.fn(),
            on: jest.fn(),
            once: jest.fn(),
            off: jest.fn(),
            reload: jest.fn(),
            getTitle: () => 'title',
            getURL: () => 'http://server-1.com',
            send: jest.fn(),
            openDevTools: jest.fn(),
            closeDevTools: jest.fn(),
            isDevToolsOpened: jest.fn(),
            navigationHistory: {
                clear: jest.fn(),
                canGoBack: jest.fn(),
                canGoForward: jest.fn(),
                goToOffset: jest.fn(),
                canGoToOffset: jest.fn(),
            },
            isDestroyed: jest.fn(() => false),
        },
    })),
    ipcMain: {
        on: jest.fn(),
        emit: jest.fn(),
    },
}));

jest.mock('app/mainWindow/mainWindow', () => ({
    focusThreeDotMenu: jest.fn(),
    get: jest.fn(),
    sendToRenderer: jest.fn(),
}));
jest.mock('app/navigationManager', () => ({
    openLinkInNewTab: jest.fn(),
    openLinkInNewWindow: jest.fn(),
}));
jest.mock('common/appState', () => ({
    clear: jest.fn(),
    updateMentions: jest.fn(),
    updateExpired: jest.fn(),
}));
jest.mock('./webContentEvents', () => ({
    addWebContentsEventListeners: jest.fn(),
    removeWebContentsListeners: jest.fn(),
}));
jest.mock('main/contextMenu', () => jest.fn());
jest.mock('main/utils', () => ({
    getWindowBoundaries: jest.fn(),
    getLocalPreload: (file) => file,
    composeUserAgent: () => 'Mattermost/5.0.0',
    shouldHaveBackBar: jest.fn(),
}));
jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));
jest.mock('main/developerMode', () => ({
    get: jest.fn(),
}));
jest.mock('main/app/utils', () => ({
    updateServerInfos: jest.fn(),
}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
    registerServerView: jest.fn(),
    unregisterView: jest.fn(),
}));
jest.mock('common/servers/serverManager', () => ({
    getRemoteInfo: jest.fn(),
    getServer: jest.fn(),
    getServerLog: jest.fn().mockReturnValue({
        verbose: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        silly: jest.fn(),
    }),
    on: jest.fn(),
    off: jest.fn(),
}));
jest.mock('main/server/serverAPI', () => ({
    getServerAPI: jest.fn(),
}));
jest.mock('common/views/viewManager', () => ({
    updateViewTitle: jest.fn(),
    isPrimaryView: jest.fn(),
    getViewLog: jest.fn().mockReturnValue({
        info: jest.fn(),
        verbose: jest.fn(),
        error: jest.fn(),
        silly: jest.fn(),
    }),
}));

const server = new MattermostServer({name: 'server_name', url: 'http://server-1.com'}, false, undefined);
const view = new MattermostView(server, ViewType.TAB);

describe('main/views/MattermostWebContentsView', () => {
    describe('load', () => {
        const window = {on: jest.fn(), webContents: {send: jest.fn()}};
        const mattermostView = new MattermostWebContentsView(view, {}, window);

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            ServerManager.getServer.mockReturnValue(server);
            mattermostView.loadSuccess = jest.fn();
            mattermostView.loadRetry = jest.fn();
            mattermostView.emit = jest.fn();
            mattermostView.log = {
                info: jest.fn(),
                verbose: jest.fn(),
                error: jest.fn(),
            };
        });

        it('should load provided URL when provided', async () => {
            const promise = Promise.resolve();
            mattermostView.webContentsView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('http://server-2.com');
            await promise;
            expect(mattermostView.webContentsView.webContents.loadURL).toBeCalledWith('http://server-2.com/', expect.any(Object));
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-2.com/');
        });

        it('should load server URL when not provided', async () => {
            const promise = Promise.resolve();
            mattermostView.webContentsView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load();
            await promise;
            expect(mattermostView.webContentsView.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-1.com/');
        });

        it('should load server URL when bad url provided', async () => {
            const promise = Promise.resolve();
            mattermostView.webContentsView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('a-bad<url');
            await promise;
            expect(mattermostView.webContentsView.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-1.com/');
        });

        it('should call retry when failing to load', async () => {
            const error = new Error('test');
            const promise = Promise.reject(error);
            mattermostView.webContentsView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('a-bad<url');
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.webContentsView.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadRetry).toBeCalledWith('http://server-1.com/', error);
        });

        it('should not retry when failing to load due to cert error', async () => {
            const error = new Error('test');
            error.code = 'ERR_CERT_ERROR';
            const promise = Promise.reject(error);
            mattermostView.webContentsView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('a-bad<url');
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.webContentsView.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadRetry).not.toBeCalled();
        });
    });

    describe('retry', () => {
        const window = {on: jest.fn(), webContents: {send: jest.fn()}};
        const mattermostView = new MattermostWebContentsView(view, {}, window);
        const retryInBackgroundFn = jest.fn();

        beforeEach(() => {
            jest.useFakeTimers();
            MainWindow.get.mockReturnValue(window);
            mattermostView.webContentsView.webContents.loadURL.mockImplementation(() => Promise.resolve());
            mattermostView.loadSuccess = jest.fn();
            mattermostView.loadRetry = jest.fn();
            mattermostView.emit = jest.fn();
            mattermostView.retryInBackground = () => retryInBackgroundFn;
        });

        afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should do nothing when webcontents are destroyed', () => {
            const webContents = mattermostView.webContentsView.webContents;
            mattermostView.webContentsView.webContents = null;
            mattermostView.retry('http://server-1.com')();
            expect(mattermostView.loadSuccess).not.toBeCalled();
            mattermostView.webContentsView.webContents = webContents;
        });

        it('should call loadSuccess on successful load', async () => {
            const promise = Promise.resolve();
            mattermostView.webContentsView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.retry('http://server-1.com')();
            await promise;
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-1.com');
        });

        it('should call loadRetry if maxRetries are still remaining', async () => {
            mattermostView.maxRetries = 10;
            const error = new Error('test');
            const promise = Promise.reject(error);
            mattermostView.webContentsView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.retry('http://server-1.com')();
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.webContentsView.webContents.loadURL).toBeCalledWith('http://server-1.com', expect.any(Object));
            expect(mattermostView.loadRetry).toBeCalledWith('http://server-1.com', error);
        });

        it('should set to error status and retry in the background when max retries are reached', async () => {
            mattermostView.maxRetries = 0;
            const error = new Error('test');
            const promise = Promise.reject(error);
            mattermostView.webContentsView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.retry('http://server-1.com')();
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.webContentsView.webContents.loadURL).toBeCalledWith('http://server-1.com', expect.any(Object));
            expect(mattermostView.loadRetry).not.toBeCalled();
            expect(window.webContents.send).toBeCalledWith(LOAD_FAILED, mattermostView.id, expect.any(String), expect.any(String));
            expect(mattermostView.status).toBe(-1);
            jest.runAllTimers();
            expect(retryInBackgroundFn).toBeCalled();
        });
    });

    describe('retryInBackground', () => {
        const window = {on: jest.fn(), webContents: {send: jest.fn()}};
        const mattermostView = new MattermostWebContentsView(view, {}, window);
        mattermostView.reload = jest.fn();

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            mattermostView.webContentsView.webContents.loadURL.mockImplementation(() => Promise.resolve());
            getServerAPI.mockImplementation((url, isAuth, onSuccess) => onSuccess());
        });

        it('should call updateServerInfos and reload on successful retry', async () => {
            await mattermostView.retryInBackground('http://server-1.com')();
            expect(updateServerInfos).toBeCalled();
            expect(mattermostView.reload).toBeCalled();
        });
    });

    describe('goToOffset', () => {
        const window = {on: jest.fn(), webContents: {send: jest.fn()}};
        const mattermostView = new MattermostWebContentsView(view, {}, window);
        mattermostView.reload = jest.fn();

        afterEach(() => {
            MainWindow.get.mockReturnValue(window);
            jest.clearAllMocks();
        });

        it('should only go to offset if it can', () => {
            mattermostView.webContentsView.webContents.navigationHistory.canGoToOffset.mockReturnValue(false);
            mattermostView.goToOffset(1);
            expect(mattermostView.webContentsView.webContents.navigationHistory.goToOffset).not.toBeCalled();

            mattermostView.webContentsView.webContents.navigationHistory.canGoToOffset.mockReturnValue(true);
            mattermostView.goToOffset(1);
            expect(mattermostView.webContentsView.webContents.navigationHistory.goToOffset).toBeCalled();
        });

        it('should call reload if an error occurs', () => {
            mattermostView.webContentsView.webContents.navigationHistory.canGoToOffset.mockReturnValue(true);
            mattermostView.webContentsView.webContents.navigationHistory.goToOffset.mockImplementation(() => {
                throw new Error('hi');
            });
            mattermostView.goToOffset(1);
            expect(mattermostView.reload).toBeCalled();
        });
    });

    describe('loadSuccess', () => {
        const window = {on: jest.fn(), webContents: {send: jest.fn()}};
        const mattermostView = new MattermostWebContentsView(view, {}, window);

        beforeEach(() => {
            jest.useFakeTimers();
            MainWindow.get.mockReturnValue(window);
            mattermostView.emit = jest.fn();
            mattermostView.setBounds = jest.fn();
            mattermostView.setInitialized = jest.fn();
            mattermostView.updateMentionsFromTitle = jest.fn();
            mattermostView.findUnreadState = jest.fn();
            ServerManager.getRemoteInfo.mockReturnValue({serverVersion: '10.0.0'});
        });

        afterAll(() => {
            jest.runOnlyPendingTimers();
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should reset max retries', () => {
            mattermostView.maxRetries = 1;
            mattermostView.loadSuccess('http://server-1.com')();
            jest.runAllTimers();
            expect(mattermostView.maxRetries).toBe(3);
        });
    });

    describe('updateHistoryButton', () => {
        const window = {on: jest.fn(), webContents: {send: jest.fn()}};
        const mattermostView = new MattermostWebContentsView(view, {}, window);

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
        });

        it('should erase history and set isAtRoot when navigating to root URL', () => {
            mattermostView.atRoot = false;
            mattermostView.updateHistoryButton();
            expect(mattermostView.webContentsView.webContents.navigationHistory.clear).toHaveBeenCalled();
            expect(mattermostView.isAtRoot).toBe(true);
        });
    });

    describe('destroy', () => {
        const window = {contentView: {removeChildView: jest.fn()}, on: jest.fn(), off: jest.fn(), isDestroyed: jest.fn(() => false)};
        const contextMenu = {
            dispose: jest.fn(),
        };

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            ContextMenu.mockReturnValue(contextMenu);
        });

        it('should remove browser view from window', () => {
            const mattermostView = new MattermostWebContentsView(view, {}, window);
            mattermostView.webContentsView.webContents.close = jest.fn();
            mattermostView.destroy();
            expect(window.contentView.removeChildView).toBeCalledWith(mattermostView.webContentsView);
        });

        it('should clear mentions', () => {
            const mattermostView = new MattermostWebContentsView(view, {}, window);
            mattermostView.webContentsView.webContents.close = jest.fn();
            mattermostView.destroy();
            expect(AppState.clear).toBeCalledWith(mattermostView.id);
        });

        it('should dispose context menu when context menu exists', () => {
            const mattermostView = new MattermostWebContentsView(view, {}, window);
            mattermostView.webContentsView.webContents.close = jest.fn();
            mattermostView.destroy();
            expect(contextMenu.dispose).toHaveBeenCalled();
        });

        it('should clear outstanding timeouts', () => {
            const mattermostView = new MattermostWebContentsView(view, {}, window);
            mattermostView.webContentsView.webContents.close = jest.fn();
            const spy = jest.spyOn(global, 'clearTimeout');
            mattermostView.retryLoad = 999;
            mattermostView.removeLoading = 1000;
            mattermostView.destroy();
            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('should remove listeners on long-lived emitters', () => {
            const mattermostView = new MattermostWebContentsView(view, {}, window);
            mattermostView.webContentsView.webContents.close = jest.fn();
            mattermostView.destroy();
            expect(ServerManager.off).toHaveBeenCalledWith(SERVER_URL_CHANGED, expect.any(Function));
            expect(window.off).toHaveBeenCalledWith('blur', expect.any(Function));
        });

        it('should not throw when the underlying webContents is already gone', () => {
            const mattermostView = new MattermostWebContentsView(view, {}, window);
            mattermostView.webContentsView.webContents = undefined;
            expect(() => mattermostView.destroy()).not.toThrow();
        });

        it('should not remove browser view when the parent window is already destroyed', () => {
            const mattermostView = new MattermostWebContentsView(view, {}, window);
            mattermostView.webContentsView.webContents.close = jest.fn();
            window.isDestroyed.mockReturnValueOnce(true);
            expect(() => mattermostView.destroy()).not.toThrow();
            expect(window.contentView.removeChildView).not.toBeCalled();
        });
    });

    describe('teardown during in-flight load (regression)', () => {
        const window = {on: jest.fn(), off: jest.fn(), contentView: {removeChildView: jest.fn()}, webContents: {send: jest.fn()}, isDestroyed: jest.fn(() => false)};
        let mattermostView;

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            ServerManager.getServer.mockReturnValue(server);
            mattermostView = new MattermostWebContentsView(view, {}, window);
            mattermostView.webContentsView.webContents.close = jest.fn();
            mattermostView.log = {info: jest.fn(), verbose: jest.fn(), error: jest.fn()};
        });

        it('isDestroyed should return true instead of throwing when the webContents is undefined', () => {
            mattermostView.webContentsView.webContents = undefined;
            expect(() => mattermostView.isDestroyed()).not.toThrow();
            expect(mattermostView.isDestroyed()).toBe(true);
        });

        it('loadRetry should be a guarded no-op when the webContents is undefined', () => {
            mattermostView.webContentsView.webContents = undefined;
            expect(() => mattermostView.loadRetry('http://server-1.com/', new Error('test'))).not.toThrow();
            expect(window.webContents.send).not.toHaveBeenCalled();
        });

        it('webContentsId should remain valid after the webContents is gone', () => {
            const id = mattermostView.webContentsId;
            expect(id).toBe(42);
            mattermostView.webContentsView.webContents = undefined;
            expect(mattermostView.webContentsId).toBe(id);
        });

        it('should not throw when a load rejects after the view has been destroyed', async () => {
            const error = new Error('ERR_FAILED');
            const rejection = Promise.reject(error);
            mattermostView.webContentsView.webContents.loadURL.mockImplementation(() => rejection);

            // Kick off a load, then tear the view down while it is still in flight.
            mattermostView.load('http://server-1.com');
            mattermostView.destroy();

            // Electron nulls out the webContents once it is destroyed; the pending
            // loadURL().catch() must not blow up when it reaches loadRetry/isDestroyed.
            mattermostView.webContentsView.webContents = undefined;

            await expect(rejection.catch((e) => e)).resolves.toBe(error);
            await new Promise((resolve) => setImmediate(resolve));

            expect(window.webContents.send).not.toHaveBeenCalledWith(LOAD_FAILED, expect.anything(), expect.anything(), expect.anything());
        });
    });

    describe('handleUpdateTarget', () => {
        const window = {on: jest.fn(), webContents: {send: jest.fn()}};
        const mattermostView = new MattermostWebContentsView(view, {}, window);

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            mattermostView.emit = jest.fn();
        });

        it('should emit tooltip URL if not internal', () => {
            mattermostView.handleUpdateTarget(null, 'http://server-2.com/some/other/path');
            expect(mattermostView.emit).toHaveBeenCalledWith(UPDATE_TARGET_URL, 'http://server-2.com/some/other/path');
        });

        it('should not throw error if URL is invalid', () => {
            expect(() => {
                mattermostView.handleUpdateTarget(null, 'not<a-real;;url');
            }).not.toThrow();
        });

        it('should not emit tooltip URL if internal', () => {
            mattermostView.handleUpdateTarget(null, 'http://server-1.com/path/to/channels');
            expect(mattermostView.emit).toHaveBeenCalled();
            expect(mattermostView.emit).not.toHaveBeenCalledWith(UPDATE_TARGET_URL, 'http://server-1.com/path/to/channels');
        });

        it('should still emit even if URL is blank', () => {
            mattermostView.handleUpdateTarget(null, '');
            expect(mattermostView.emit).toHaveBeenCalled();
        });
    });

    describe('handlePageTitleUpdated', () => {
        const window = {on: jest.fn(), webContents: {send: jest.fn()}};
        const mattermostView = new MattermostWebContentsView(view, {}, window);

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            ServerManager.getServer.mockReturnValue({
                isLoggedIn: true,
            });
            ServerManager.getRemoteInfo.mockReturnValue({
                siteName: 'Server Name',
            });
            mattermostView.log = {
                info: jest.fn(),
                verbose: jest.fn(),
                error: jest.fn(),
                silly: jest.fn(),
            };
            ViewManager.updateViewTitle.mockClear();
        });

        it('should extract channel name from title with standard format', () => {
            mattermostView.handlePageTitleUpdated('Channel Name - Team Name Server Name');
            expect(ViewManager.updateViewTitle).toHaveBeenCalledWith(mattermostView.id, 'Channel Name', 'Team Name');
        });

        it('should handle channel name with dash in it', () => {
            mattermostView.handlePageTitleUpdated('Channel - Name - Team Name Server Name');
            expect(ViewManager.updateViewTitle).toHaveBeenCalledWith(mattermostView.id, 'Channel - Name', 'Team Name');
        });

        it('should handle title with mention count', () => {
            mattermostView.handlePageTitleUpdated('(3) Channel Name - Team Name Server Name');
            expect(ViewManager.updateViewTitle).toHaveBeenCalledWith(mattermostView.id, 'Channel Name', 'Team Name');
        });

        it('should handle channel name with dash and mention count', () => {
            mattermostView.handlePageTitleUpdated('(5) Channel - Name - Team Name Server Name');
            expect(ViewManager.updateViewTitle).toHaveBeenCalledWith(mattermostView.id, 'Channel - Name', 'Team Name');
        });

        it('should not update title when user is not logged in', () => {
            ServerManager.getServer.mockReturnValue({
                isLoggedIn: false,
            });

            mattermostView.handlePageTitleUpdated('Channel Name - Team Name Server Name');
            expect(ViewManager.updateViewTitle).not.toHaveBeenCalled();
        });

        it('should handle title with only one dash', () => {
            mattermostView.handlePageTitleUpdated('Channel Name - Team Name Server Name');
            expect(ViewManager.updateViewTitle).toHaveBeenCalledWith(mattermostView.id, 'Channel Name', 'Team Name');
        });

        it('should handle title with no dash', () => {
            mattermostView.handlePageTitleUpdated('Just Channel Name');
            expect(ViewManager.updateViewTitle).toHaveBeenCalledWith(mattermostView.id, 'Just Channel Name');
        });
    });

    describe('useLastPath', () => {
        const window = {on: jest.fn(), webContents: {send: jest.fn()}};
        let mattermostView;

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            mattermostView = new MattermostWebContentsView(view, {}, window);
        });

        it('should send BROWSER_HISTORY_PUSH immediately for the primary view', () => {
            ViewManager.isPrimaryView.mockReturnValue(true);
            mattermostView.setLastPath('/team/channel');

            mattermostView.useLastPath();

            expect(mattermostView.webContentsView.webContents.send).toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, '/team/channel');
            expect(mattermostView.webContentsView.webContents.reload).not.toHaveBeenCalled();
            expect(mattermostView.lastPath).toBeUndefined();
        });

        it('should send the captured path after reload, even though lastPath was cleared synchronously', () => {
            ViewManager.isPrimaryView.mockReturnValue(false);

            let didFinishLoadCb;
            mattermostView.webContentsView.webContents.once.mockImplementation((event, cb) => {
                if (event === 'did-finish-load') {
                    didFinishLoadCb = cb;
                }
            });

            mattermostView.setLastPath('/team/channel');
            mattermostView.useLastPath();

            expect(mattermostView.webContentsView.webContents.reload).toHaveBeenCalled();
            expect(mattermostView.lastPath).toBeUndefined();

            didFinishLoadCb();

            expect(mattermostView.webContentsView.webContents.send).toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, '/team/channel');
        });

        it('should not send when the webContents is destroyed before did-finish-load fires', () => {
            ViewManager.isPrimaryView.mockReturnValue(false);

            let didFinishLoadCb;
            mattermostView.webContentsView.webContents.once.mockImplementation((event, cb) => {
                if (event === 'did-finish-load') {
                    didFinishLoadCb = cb;
                }
            });

            mattermostView.setLastPath('/team/channel');
            mattermostView.useLastPath();

            mattermostView.webContentsView.webContents.isDestroyed.mockReturnValue(true);
            didFinishLoadCb();

            expect(mattermostView.webContentsView.webContents.send).not.toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, expect.anything());
        });

        it('should be a no-op when lastPath is not set', () => {
            ViewManager.isPrimaryView.mockReturnValue(false);

            mattermostView.useLastPath();

            expect(mattermostView.webContentsView.webContents.once).not.toHaveBeenCalled();
            expect(mattermostView.webContentsView.webContents.reload).not.toHaveBeenCalled();
            expect(mattermostView.webContentsView.webContents.send).not.toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, expect.anything());
        });
    });

    describe('constructor', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should register devtools-focused listener permanently', () => {
            const window = {on: jest.fn(), webContents: {send: jest.fn()}};
            const mattermostView = new MattermostWebContentsView(view, {}, window);
            const onCalls = mattermostView.webContentsView.webContents.on.mock.calls;
            expect(onCalls.some(([e]) => e === 'devtools-focused')).toBe(true);
        });

        it('should register devtools-closed listener permanently', () => {
            const window = {on: jest.fn(), webContents: {send: jest.fn()}};
            const mattermostView = new MattermostWebContentsView(view, {}, window);
            const onCalls = mattermostView.webContentsView.webContents.on.mock.calls;
            expect(onCalls.some(([e]) => e === 'devtools-closed')).toBe(true);
        });

        it('should emit UPDATE_SHORTCUT_MENU when devtools-focused fires', () => {
            const window = {on: jest.fn(), webContents: {send: jest.fn()}};
            const mattermostView = new MattermostWebContentsView(view, {}, window);
            const onCall = mattermostView.webContentsView.webContents.on.mock.calls.find(([e]) => e === 'devtools-focused');
            expect(onCall).toBeDefined();
            onCall[1]();
            expect(ipcMain.emit).toHaveBeenCalledWith(UPDATE_SHORTCUT_MENU);
        });

        it('should emit UPDATE_SHORTCUT_MENU when devtools-closed fires', () => {
            const window = {on: jest.fn(), webContents: {send: jest.fn()}};
            const mattermostView = new MattermostWebContentsView(view, {}, window);
            const onCall = mattermostView.webContentsView.webContents.on.mock.calls.find(([e]) => e === 'devtools-closed');
            expect(onCall).toBeDefined();
            onCall[1]();
            expect(ipcMain.emit).toHaveBeenCalledWith(UPDATE_SHORTCUT_MENU);
        });
    });

    describe('openDevTools', () => {
        const window = {on: jest.fn(), webContents: {send: jest.fn()}};
        let mattermostView;

        beforeEach(() => {
            mattermostView = new MattermostWebContentsView(view, {}, window);
            mattermostView.webContentsView.webContents.isDevToolsOpened.mockReturnValue(false);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should call openDevTools in detach mode', () => {
            mattermostView.openDevTools();

            expect(mattermostView.webContentsView.webContents.openDevTools).toHaveBeenCalledWith({mode: 'detach'});
        });

        it('should reset DevTools via mac workaround when DevTools does not open cleanly', () => {
            jest.useFakeTimers();
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true});

            try {
                mattermostView.openDevTools();

                // DevTools opens (isDevToolsOpened returns true) but devtools-opened event never fires,
                // so the timeout runs and triggers the reset workaround
                mattermostView.webContentsView.webContents.isDevToolsOpened.mockReturnValue(true);
                jest.advanceTimersByTime(500);

                expect(mattermostView.webContentsView.webContents.closeDevTools).toHaveBeenCalled();
                expect(mattermostView.webContentsView.webContents.openDevTools).toHaveBeenCalledTimes(2);
            } finally {
                Object.defineProperty(process, 'platform', {value: originalPlatform, configurable: true});
            }
        });

        it('should cancel the mac workaround timeout when devtools-opened fires normally', () => {
            jest.useFakeTimers();
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true});

            try {
                mattermostView.openDevTools();

                // Fire the devtools-opened event to cancel the workaround timeout
                const devToolsOpenedCall = mattermostView.webContentsView.webContents.on.mock.calls.find(([e]) => e === 'devtools-opened');
                expect(devToolsOpenedCall).toBeDefined();
                devToolsOpenedCall[1]();

                mattermostView.webContentsView.webContents.isDevToolsOpened.mockReturnValue(true);
                jest.advanceTimersByTime(500);

                expect(mattermostView.webContentsView.webContents.closeDevTools).not.toHaveBeenCalled();
            } finally {
                Object.defineProperty(process, 'platform', {value: originalPlatform, configurable: true});
            }
        });
    });
});
