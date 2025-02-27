// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import AppState from 'common/appState';
import {LOAD_FAILED, UPDATE_TARGET_URL} from 'common/communication';
import {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import MessagingView from 'common/views/MessagingView';
import {updateServerInfos} from 'main/app/utils';
import {getServerAPI} from 'main/server/serverAPI';

import {MattermostWebContentsView} from './MattermostWebContentsView';

import ContextMenu from '../contextMenu';
import MainWindow from '../windows/mainWindow';

jest.mock('electron', () => ({
    app: {
        getVersion: () => '5.0.0',
        getPath: jest.fn(() => '/valid/downloads/path'),
    },
    WebContentsView: jest.fn().mockImplementation(() => ({
        webContents: {
            loadURL: jest.fn(),
            on: jest.fn(),
            getTitle: () => 'title',
            getURL: () => 'http://server-1.com',
            send: jest.fn(),
            navigationHistory: {
                clear: jest.fn(),
                canGoBack: jest.fn(),
                canGoForward: jest.fn(),
                goToOffset: jest.fn(),
                canGoToOffset: jest.fn(),
            },
        },
    })),
    ipcMain: {
        on: jest.fn(),
    },
}));

jest.mock('../windows/mainWindow', () => ({
    focusThreeDotMenu: jest.fn(),
    get: jest.fn(),
    sendToRenderer: jest.fn(),
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
jest.mock('../contextMenu', () => jest.fn());
jest.mock('../utils', () => ({
    getWindowBoundaries: jest.fn(),
    getLocalPreload: (file) => file,
    composeUserAgent: () => 'Mattermost/5.0.0',
    shouldHaveBackBar: jest.fn(),
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
    getViewLog: jest.fn().mockReturnValue({
        verbose: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        silly: jest.fn(),
    }),
    on: jest.fn(),
}));
jest.mock('main/server/serverAPI', () => ({
    getServerAPI: jest.fn(),
}));

const server = new MattermostServer({name: 'server_name', url: 'http://server-1.com'});
const view = new MessagingView(server, true);

describe('main/views/MattermostWebContentsView', () => {
    describe('load', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostWebContentsView(view, {}, {});

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            mattermostView.loadSuccess = jest.fn();
            mattermostView.loadRetry = jest.fn();
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
        const window = {on: jest.fn()};
        const mattermostView = new MattermostWebContentsView(view, {}, {});
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

        afterAll(() => {
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
            expect(MainWindow.sendToRenderer).toBeCalledWith(LOAD_FAILED, mattermostView.view.id, expect.any(String), expect.any(String));
            expect(mattermostView.status).toBe(-1);
            jest.runAllTimers();
            expect(retryInBackgroundFn).toBeCalled();
        });
    });

    describe('retryInBackground', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostWebContentsView(view, {}, {});
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
        const window = {on: jest.fn()};
        const mattermostView = new MattermostWebContentsView(view, {}, {});
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

    describe('onLogin', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostWebContentsView(view, {}, {});
        mattermostView.webContentsView.webContents.getURL = jest.fn();
        mattermostView.reload = jest.fn();

        afterEach(() => {
            MainWindow.get.mockReturnValue(window);
            jest.clearAllMocks();
        });

        it('should reload view when URL is not on subpath of original server URL', () => {
            mattermostView.webContentsView.webContents.getURL.mockReturnValue('http://server-2.com/subpath');
            mattermostView.onLogin(true);
            expect(mattermostView.reload).toHaveBeenCalled();
        });

        it('should not reload if URLs are matching', () => {
            mattermostView.webContentsView.webContents.getURL.mockReturnValue('http://server-1.com');
            mattermostView.onLogin(true);
            expect(mattermostView.reload).not.toHaveBeenCalled();
        });

        it('should not reload if URL is subpath of server URL', () => {
            mattermostView.webContentsView.webContents.getURL.mockReturnValue('http://server-1.com/subpath');
            mattermostView.onLogin(true);
            expect(mattermostView.reload).not.toHaveBeenCalled();
        });
    });

    describe('loadSuccess', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostWebContentsView(view, {}, {});

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

    describe('show', () => {
        const window = {
            contentView: {
                addChildView: jest.fn(),
                removeChildView: jest.fn(),
            },
            on: jest.fn(),
        };
        const mattermostView = new MattermostWebContentsView(view, {}, {});

        beforeEach(() => {
            jest.useFakeTimers();
            MainWindow.get.mockReturnValue(window);
            mattermostView.setBounds = jest.fn();
            mattermostView.focus = jest.fn();
        });

        afterAll(() => {
            jest.runOnlyPendingTimers();
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should add browser view to window and set bounds when request is true and view not currently visible', () => {
            mattermostView.isVisible = false;
            mattermostView.show();
            expect(window.contentView.addChildView).toBeCalledWith(mattermostView.webContentsView);
            expect(mattermostView.setBounds).toBeCalled();
            expect(mattermostView.isVisible).toBe(true);
        });

        it('should do nothing when not toggling', () => {
            mattermostView.isVisible = true;
            mattermostView.show();
            expect(window.contentView.addChildView).not.toBeCalled();
        });

        it('should focus view if view is ready', () => {
            mattermostView.status = 1;
            mattermostView.isVisible = false;
            mattermostView.show();
            expect(mattermostView.focus).toBeCalled();
        });
    });

    describe('hide', () => {
        const window = {
            contentView: {
                addChildView: jest.fn(),
                removeChildView: jest.fn(),
            },
            on: jest.fn(),
        };
        const mattermostView = new MattermostWebContentsView(view, {}, {});

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
        });

        it('should remove browser view', () => {
            mattermostView.isVisible = true;
            mattermostView.hide();
            expect(window.contentView.removeChildView).toBeCalledWith(mattermostView.webContentsView);
            expect(mattermostView.isVisible).toBe(false);
        });

        it('should do nothing when not toggling', () => {
            mattermostView.isVisible = false;
            mattermostView.hide();
            expect(window.contentView.removeChildView).not.toBeCalled();
        });
    });

    describe('updateHistoryButton', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostWebContentsView(view, {}, {});

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
        const window = {contentView: {removeChildView: jest.fn()}, on: jest.fn()};
        const contextMenu = {
            dispose: jest.fn(),
        };

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            ContextMenu.mockReturnValue(contextMenu);
        });

        it('should remove browser view from window', () => {
            const mattermostView = new MattermostWebContentsView(view, {}, {});
            mattermostView.webContentsView.webContents.close = jest.fn();
            mattermostView.destroy();
            expect(window.contentView.removeChildView).toBeCalledWith(mattermostView.webContentsView);
        });

        it('should clear mentions', () => {
            const mattermostView = new MattermostWebContentsView(view, {}, {});
            mattermostView.webContentsView.webContents.close = jest.fn();
            mattermostView.destroy();
            expect(AppState.clear).toBeCalledWith(mattermostView.view.id);
        });

        it('should clear outstanding timeouts', () => {
            const mattermostView = new MattermostWebContentsView(view, {}, {});
            mattermostView.webContentsView.webContents.close = jest.fn();
            const spy = jest.spyOn(global, 'clearTimeout');
            mattermostView.retryLoad = 999;
            mattermostView.removeLoading = 1000;
            mattermostView.destroy();
            expect(spy).toHaveBeenCalledTimes(2);
        });
    });

    describe('handleInputEvents', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostWebContentsView(view, {}, {});

        it('should open three dot menu on pressing Alt', () => {
            MainWindow.get.mockReturnValue(window);
            mattermostView.handleInputEvents(null, {key: 'Alt', type: 'keyDown', alt: true, shift: false, control: false, meta: false});
            mattermostView.handleInputEvents(null, {key: 'Alt', type: 'keyUp'});
            expect(MainWindow.focusThreeDotMenu).toHaveBeenCalled();
        });

        it('should not open three dot menu on holding Alt', () => {
            mattermostView.handleInputEvents(null, {key: 'Alt', type: 'keyDown'});
            expect(MainWindow.focusThreeDotMenu).not.toHaveBeenCalled();
        });

        it('should not open three dot menu on Alt as key combp', () => {
            mattermostView.handleInputEvents(null, {key: 'Alt', type: 'keyDown'});
            mattermostView.handleInputEvents(null, {key: 'F', type: 'keyDown'});
            mattermostView.handleInputEvents(null, {key: 'F', type: 'keyUp'});
            mattermostView.handleInputEvents(null, {key: 'Alt', type: 'keyUp'});
            expect(MainWindow.focusThreeDotMenu).not.toHaveBeenCalled();
        });
    });

    describe('handleUpdateTarget', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostWebContentsView(view, {}, {});

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
});
