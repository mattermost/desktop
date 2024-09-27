// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import AppState from 'common/appState';
import {LOAD_FAILED, TOGGLE_BACK_BUTTON, UPDATE_TARGET_URL} from 'common/communication';
import {MattermostServer} from 'common/servers/MattermostServer';
import MessagingView from 'common/views/MessagingView';

import {MattermostBrowserView} from './MattermostBrowserView';

import ContextMenu from '../contextMenu';
import Utils from '../utils';
import MainWindow from '../windows/mainWindow';

jest.mock('electron', () => ({
    app: {
        getVersion: () => '5.0.0',
    },
    BrowserView: jest.fn().mockImplementation(() => ({
        webContents: {
            loadURL: jest.fn(),
            on: jest.fn(),
            getTitle: () => 'title',
            getURL: () => 'http://server-1.com',
            clearHistory: jest.fn(),
            send: jest.fn(),
            canGoBack: jest.fn(),
            canGoForward: jest.fn(),
            goToOffset: jest.fn(),
            canGoToOffset: jest.fn(),
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

const server = new MattermostServer({name: 'server_name', url: 'http://server-1.com'});
const view = new MessagingView(server, true);

describe('main/views/MattermostBrowserView', () => {
    describe('load', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostBrowserView(view, {}, {});

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            mattermostView.loadSuccess = jest.fn();
            mattermostView.loadRetry = jest.fn();
        });

        it('should load provided URL when provided', async () => {
            const promise = Promise.resolve();
            mattermostView.browserView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('http://server-2.com');
            await promise;
            expect(mattermostView.browserView.webContents.loadURL).toBeCalledWith('http://server-2.com/', expect.any(Object));
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-2.com/');
        });

        it('should load server URL when not provided', async () => {
            const promise = Promise.resolve();
            mattermostView.browserView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load();
            await promise;
            expect(mattermostView.browserView.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-1.com/');
        });

        it('should load server URL when bad url provided', async () => {
            const promise = Promise.resolve();
            mattermostView.browserView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('a-bad<url');
            await promise;
            expect(mattermostView.browserView.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-1.com/');
        });

        it('should call retry when failing to load', async () => {
            const error = new Error('test');
            const promise = Promise.reject(error);
            mattermostView.browserView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('a-bad<url');
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.browserView.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadRetry).toBeCalledWith('http://server-1.com/', error);
        });

        it('should not retry when failing to load due to cert error', async () => {
            const error = new Error('test');
            error.code = 'ERR_CERT_ERROR';
            const promise = Promise.reject(error);
            mattermostView.browserView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('a-bad<url');
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.browserView.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadRetry).not.toBeCalled();
        });
    });

    describe('retry', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostBrowserView(view, {}, {});
        const retryInBackgroundFn = jest.fn();

        beforeEach(() => {
            jest.useFakeTimers();
            MainWindow.get.mockReturnValue(window);
            mattermostView.browserView.webContents.loadURL.mockImplementation(() => Promise.resolve());
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
            const webContents = mattermostView.browserView.webContents;
            mattermostView.browserView.webContents = null;
            mattermostView.retry('http://server-1.com')();
            expect(mattermostView.loadSuccess).not.toBeCalled();
            mattermostView.browserView.webContents = webContents;
        });

        it('should call loadSuccess on successful load', async () => {
            const promise = Promise.resolve();
            mattermostView.browserView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.retry('http://server-1.com')();
            await promise;
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-1.com');
        });

        it('should call loadRetry if maxRetries are still remaining', async () => {
            mattermostView.maxRetries = 10;
            const error = new Error('test');
            const promise = Promise.reject(error);
            mattermostView.browserView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.retry('http://server-1.com')();
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.browserView.webContents.loadURL).toBeCalledWith('http://server-1.com', expect.any(Object));
            expect(mattermostView.loadRetry).toBeCalledWith('http://server-1.com', error);
        });

        it('should set to error status and retry in the background when max retries are reached', async () => {
            mattermostView.maxRetries = 0;
            const error = new Error('test');
            const promise = Promise.reject(error);
            mattermostView.browserView.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.retry('http://server-1.com')();
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.browserView.webContents.loadURL).toBeCalledWith('http://server-1.com', expect.any(Object));
            expect(mattermostView.loadRetry).not.toBeCalled();
            expect(MainWindow.sendToRenderer).toBeCalledWith(LOAD_FAILED, mattermostView.view.id, expect.any(String), expect.any(String));
            expect(mattermostView.status).toBe(-1);
            jest.runAllTimers();
            expect(retryInBackgroundFn).toBeCalled();
        });
    });

    describe('goToOffset', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostBrowserView(view, {}, {});
        mattermostView.reload = jest.fn();

        afterEach(() => {
            MainWindow.get.mockReturnValue(window);
            jest.clearAllMocks();
        });

        it('should only go to offset if it can', () => {
            mattermostView.browserView.webContents.canGoToOffset.mockReturnValue(false);
            mattermostView.goToOffset(1);
            expect(mattermostView.browserView.webContents.goToOffset).not.toBeCalled();

            mattermostView.browserView.webContents.canGoToOffset.mockReturnValue(true);
            mattermostView.goToOffset(1);
            expect(mattermostView.browserView.webContents.goToOffset).toBeCalled();
        });

        it('should call reload if an error occurs', () => {
            mattermostView.browserView.webContents.canGoToOffset.mockReturnValue(true);
            mattermostView.browserView.webContents.goToOffset.mockImplementation(() => {
                throw new Error('hi');
            });
            mattermostView.goToOffset(1);
            expect(mattermostView.reload).toBeCalled();
        });
    });

    describe('onLogin', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostBrowserView(view, {}, {});
        mattermostView.browserView.webContents.getURL = jest.fn();
        mattermostView.reload = jest.fn();

        afterEach(() => {
            MainWindow.get.mockReturnValue(window);
            jest.clearAllMocks();
        });

        it('should reload view when URL is not on subpath of original server URL', () => {
            mattermostView.browserView.webContents.getURL.mockReturnValue('http://server-2.com/subpath');
            mattermostView.onLogin(true);
            expect(mattermostView.reload).toHaveBeenCalled();
        });

        it('should not reload if URLs are matching', () => {
            mattermostView.browserView.webContents.getURL.mockReturnValue('http://server-1.com');
            mattermostView.onLogin(true);
            expect(mattermostView.reload).not.toHaveBeenCalled();
        });

        it('should not reload if URL is subpath of server URL', () => {
            mattermostView.browserView.webContents.getURL.mockReturnValue('http://server-1.com/subpath');
            mattermostView.onLogin(true);
            expect(mattermostView.reload).not.toHaveBeenCalled();
        });
    });

    describe('loadSuccess', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostBrowserView(view, {}, {});

        beforeEach(() => {
            jest.useFakeTimers();
            MainWindow.get.mockReturnValue(window);
            mattermostView.emit = jest.fn();
            mattermostView.setBounds = jest.fn();
            mattermostView.setInitialized = jest.fn();
            mattermostView.updateMentionsFromTitle = jest.fn();
            mattermostView.findUnreadState = jest.fn();
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
        const window = {addBrowserView: jest.fn(), removeBrowserView: jest.fn(), on: jest.fn(), setTopBrowserView: jest.fn()};
        const mattermostView = new MattermostBrowserView(view, {}, {});

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
            expect(window.addBrowserView).toBeCalledWith(mattermostView.browserView);
            expect(mattermostView.setBounds).toBeCalled();
            expect(mattermostView.isVisible).toBe(true);
        });

        it('should do nothing when not toggling', () => {
            mattermostView.isVisible = true;
            mattermostView.show();
            expect(window.addBrowserView).not.toBeCalled();
        });

        it('should focus view if view is ready', () => {
            mattermostView.status = 1;
            mattermostView.isVisible = false;
            mattermostView.show();
            expect(mattermostView.focus).toBeCalled();
        });
    });

    describe('hide', () => {
        const window = {addBrowserView: jest.fn(), removeBrowserView: jest.fn(), on: jest.fn(), setTopBrowserView: jest.fn()};
        const mattermostView = new MattermostBrowserView(view, {}, {});

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
        });

        it('should remove browser view', () => {
            mattermostView.isVisible = true;
            mattermostView.hide();
            expect(window.removeBrowserView).toBeCalledWith(mattermostView.browserView);
            expect(mattermostView.isVisible).toBe(false);
        });

        it('should do nothing when not toggling', () => {
            mattermostView.isVisible = false;
            mattermostView.hide();
            expect(window.removeBrowserView).not.toBeCalled();
        });
    });

    describe('updateHistoryButton', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostBrowserView(view, {}, {});

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
        });

        it('should erase history and set isAtRoot when navigating to root URL', () => {
            mattermostView.atRoot = false;
            mattermostView.updateHistoryButton();
            expect(mattermostView.browserView.webContents.clearHistory).toHaveBeenCalled();
            expect(mattermostView.isAtRoot).toBe(true);
        });
    });

    describe('destroy', () => {
        const window = {removeBrowserView: jest.fn(), on: jest.fn()};
        const contextMenu = {
            dispose: jest.fn(),
        };

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            ContextMenu.mockReturnValue(contextMenu);
        });

        it('should remove browser view from window', () => {
            const mattermostView = new MattermostBrowserView(view, {}, {});
            mattermostView.browserView.webContents.close = jest.fn();
            mattermostView.destroy();
            expect(window.removeBrowserView).toBeCalledWith(mattermostView.browserView);
        });

        it('should clear mentions', () => {
            const mattermostView = new MattermostBrowserView(view, {}, {});
            mattermostView.browserView.webContents.close = jest.fn();
            mattermostView.destroy();
            expect(AppState.clear).toBeCalledWith(mattermostView.view.id);
        });

        it('should clear outstanding timeouts', () => {
            const mattermostView = new MattermostBrowserView(view, {}, {});
            mattermostView.browserView.webContents.close = jest.fn();
            const spy = jest.spyOn(global, 'clearTimeout');
            mattermostView.retryLoad = 999;
            mattermostView.removeLoading = 1000;
            mattermostView.destroy();
            expect(spy).toHaveBeenCalledTimes(2);
        });
    });

    describe('handleInputEvents', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostBrowserView(view, {}, {});

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

    describe('handleDidNavigate', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostBrowserView(view, {}, {});

        beforeEach(() => {
            MainWindow.get.mockReturnValue(window);
            mattermostView.setBounds = jest.fn();
        });

        it('should hide back button on internal url', () => {
            Utils.shouldHaveBackBar.mockReturnValue(false);
            mattermostView.handleDidNavigate(null, 'http://server-1.com/path/to/channels');
            expect(MainWindow.sendToRenderer).toHaveBeenCalledWith(TOGGLE_BACK_BUTTON, false);
        });

        it('should show back button on external url', () => {
            Utils.shouldHaveBackBar.mockReturnValue(true);
            mattermostView.handleDidNavigate(null, 'http://server-2.com/some/other/path');
            expect(MainWindow.sendToRenderer).toHaveBeenCalledWith(TOGGLE_BACK_BUTTON, true);
        });
    });

    describe('handleUpdateTarget', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostBrowserView(view, {}, {});

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

    describe('updateMentionsFromTitle', () => {
        const mattermostView = new MattermostBrowserView(view, {}, {});

        it('should parse mentions from title', () => {
            mattermostView.updateMentionsFromTitle('(7) Mattermost');
            expect(AppState.updateMentions).toHaveBeenCalledWith(mattermostView.view.id, 7);
        });

        it('should parse unreads from title', () => {
            mattermostView.updateMentionsFromTitle('* Mattermost');
            expect(AppState.updateMentions).toHaveBeenCalledWith(mattermostView.view.id, 0);
        });
    });
});
