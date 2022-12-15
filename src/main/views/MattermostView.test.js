// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {LOAD_FAILED, TOGGLE_BACK_BUTTON, UPDATE_TARGET_URL} from 'common/communication';
import {MattermostServer} from 'common/servers/MattermostServer';
import MessagingTabView from 'common/tabs/MessagingTabView';

import * as WindowManager from '../windows/windowManager';
import * as appState from '../appState';
import Utils from '../utils';

import {MattermostView} from './MattermostView';

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
        },
    })),
    ipcMain: {
        on: jest.fn(),
    },
}));

jest.mock('../windows/windowManager', () => ({
    sendToRenderer: jest.fn(),
    focusThreeDotMenu: jest.fn(),
}));
jest.mock('../appState', () => ({
    updateMentions: jest.fn(),
}));
jest.mock('./webContentEvents', () => ({
    removeWebContentsListeners: jest.fn(),
}));
jest.mock('../contextMenu', () => jest.fn());
jest.mock('../utils', () => ({
    getWindowBoundaries: jest.fn(),
    getLocalPreload: (file) => file,
    composeUserAgent: () => 'Mattermost/5.0.0',
    shouldHaveBackBar: jest.fn(),
}));

const server = new MattermostServer('server_name', 'http://server-1.com');
const tabView = new MessagingTabView(server);

describe('main/views/MattermostView', () => {
    describe('load', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostView(tabView, {}, window, {});

        beforeEach(() => {
            mattermostView.loadSuccess = jest.fn();
            mattermostView.loadRetry = jest.fn();
        });

        it('should load provided URL when provided', async () => {
            const promise = Promise.resolve();
            mattermostView.view.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('http://server-2.com');
            await promise;
            expect(mattermostView.view.webContents.loadURL).toBeCalledWith('http://server-2.com/', expect.any(Object));
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-2.com/');
        });

        it('should load server URL when not provided', async () => {
            const promise = Promise.resolve();
            mattermostView.view.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load();
            await promise;
            expect(mattermostView.view.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-1.com/');
        });

        it('should load server URL when bad url provided', async () => {
            const promise = Promise.resolve();
            mattermostView.view.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('a-bad<url');
            await promise;
            expect(mattermostView.view.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-1.com/');
        });

        it('should call retry when failing to load', async () => {
            const error = new Error('test');
            const promise = Promise.reject(error);
            mattermostView.view.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('a-bad<url');
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.view.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadRetry).toBeCalledWith('http://server-1.com/', error);
        });

        it('should not retry when failing to load due to cert error', async () => {
            const error = new Error('test');
            error.code = 'ERR_CERT_ERROR';
            const promise = Promise.reject(error);
            mattermostView.view.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.load('a-bad<url');
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.view.webContents.loadURL).toBeCalledWith('http://server-1.com/', expect.any(Object));
            expect(mattermostView.loadRetry).not.toBeCalled();
        });
    });

    describe('retry', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostView(tabView, {}, window, {});
        const retryInBackgroundFn = jest.fn();

        beforeEach(() => {
            jest.useFakeTimers();
            mattermostView.view.webContents.loadURL.mockImplementation(() => Promise.resolve());
            mattermostView.loadSuccess = jest.fn();
            mattermostView.loadRetry = jest.fn();
            mattermostView.emit = jest.fn();
            mattermostView.retryInBackground = () => retryInBackgroundFn;
        });

        it('should do nothing when webcontents are destroyed', () => {
            const webContents = mattermostView.view.webContents;
            mattermostView.view.webContents = null;
            mattermostView.retry('http://server-1.com')();
            expect(mattermostView.loadSuccess).not.toBeCalled();
            mattermostView.view.webContents = webContents;
        });

        it('should call loadSuccess on successful load', async () => {
            const promise = Promise.resolve();
            mattermostView.view.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.retry('http://server-1.com')();
            await promise;
            expect(mattermostView.loadSuccess).toBeCalledWith('http://server-1.com');
        });

        it('should call loadRetry if maxRetries are still remaining', async () => {
            mattermostView.maxRetries = 10;
            const error = new Error('test');
            const promise = Promise.reject(error);
            mattermostView.view.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.retry('http://server-1.com')();
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.view.webContents.loadURL).toBeCalledWith('http://server-1.com', expect.any(Object));
            expect(mattermostView.loadRetry).toBeCalledWith('http://server-1.com', error);
        });

        it('should set to error status and retry in the background when max retries are reached', async () => {
            mattermostView.maxRetries = 0;
            const error = new Error('test');
            const promise = Promise.reject(error);
            mattermostView.view.webContents.loadURL.mockImplementation(() => promise);
            mattermostView.retry('http://server-1.com')();
            await expect(promise).rejects.toThrow(error);
            expect(mattermostView.view.webContents.loadURL).toBeCalledWith('http://server-1.com', expect.any(Object));
            expect(mattermostView.loadRetry).not.toBeCalled();
            expect(WindowManager.sendToRenderer).toBeCalledWith(LOAD_FAILED, mattermostView.tab.name, expect.any(String), expect.any(String));
            expect(mattermostView.status).toBe(-1);
            jest.runAllTimers();
            expect(retryInBackgroundFn).toBeCalled();
        });
    });

    describe('loadSuccess', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostView(tabView, {}, window, {});

        beforeEach(() => {
            jest.useFakeTimers();
            mattermostView.emit = jest.fn();
            mattermostView.setBounds = jest.fn();
            mattermostView.setInitialized = jest.fn();
            mattermostView.updateMentionsFromTitle = jest.fn();
            mattermostView.findUnreadState = jest.fn();
        });

        it('should reset max retries', () => {
            mattermostView.maxRetries = 1;
            mattermostView.loadSuccess('http://server-1.com')();
            jest.runAllTimers();
            expect(mattermostView.maxRetries).toBe(3);
        });
    });

    describe('show', () => {
        const window = {addBrowserView: jest.fn(), removeBrowserView: jest.fn(), on: jest.fn()};
        const mattermostView = new MattermostView(tabView, {}, window, {});

        beforeEach(() => {
            jest.useFakeTimers();
            mattermostView.setBounds = jest.fn();
            mattermostView.focus = jest.fn();
        });

        it('should add browser view to window and set bounds when request is true and view not currently visible', () => {
            mattermostView.isVisible = false;
            mattermostView.show(true);
            expect(window.addBrowserView).toBeCalledWith(mattermostView.view);
            expect(mattermostView.setBounds).toBeCalled();
            expect(mattermostView.isVisible).toBe(true);
        });

        it('should remove browser view when request is false', () => {
            mattermostView.isVisible = true;
            mattermostView.show(false);
            expect(window.removeBrowserView).toBeCalledWith(mattermostView.view);
            expect(mattermostView.isVisible).toBe(false);
        });

        it('should do nothing when not toggling', () => {
            mattermostView.isVisible = true;
            mattermostView.show(true);
            expect(window.addBrowserView).not.toBeCalled();
            expect(window.removeBrowserView).not.toBeCalled();

            mattermostView.isVisible = false;
            mattermostView.show(false);
            expect(window.addBrowserView).not.toBeCalled();
            expect(window.removeBrowserView).not.toBeCalled();
        });

        it('should focus view if view is ready', () => {
            mattermostView.status = 1;
            mattermostView.isVisible = false;
            mattermostView.show(true);
            expect(mattermostView.focus).toBeCalled();
        });
    });

    describe('destroy', () => {
        const window = {removeBrowserView: jest.fn(), on: jest.fn()};
        const mattermostView = new MattermostView(tabView, {}, window, {});

        beforeEach(() => {
            mattermostView.view.webContents.destroy = jest.fn();
        });

        it('should remove browser view from window', () => {
            mattermostView.destroy();
            expect(window.removeBrowserView).toBeCalledWith(mattermostView.view);
        });

        it('should clear mentions', () => {
            mattermostView.destroy();
            expect(appState.updateMentions).toBeCalledWith(mattermostView.tab.name, 0, false);
        });

        it('should clear outstanding timeouts', () => {
            const spy = jest.spyOn(global, 'clearTimeout');
            mattermostView.retryLoad = 999;
            mattermostView.removeLoading = 1000;
            mattermostView.destroy();
            expect(spy).toHaveBeenCalledTimes(2);
        });
    });

    describe('handleInputEvents', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostView(tabView, {}, window, {});

        it('should open three dot menu on pressing Alt', () => {
            mattermostView.handleInputEvents(null, {key: 'Alt', type: 'keyDown', alt: true, shift: false, control: false, meta: false});
            mattermostView.handleInputEvents(null, {key: 'Alt', type: 'keyUp'});
            expect(WindowManager.focusThreeDotMenu).toHaveBeenCalled();
        });

        it('should not open three dot menu on holding Alt', () => {
            mattermostView.handleInputEvents(null, {key: 'Alt', type: 'keyDown'});
            expect(WindowManager.focusThreeDotMenu).not.toHaveBeenCalled();
        });

        it('should not open three dot menu on Alt as key combp', () => {
            mattermostView.handleInputEvents(null, {key: 'Alt', type: 'keyDown'});
            mattermostView.handleInputEvents(null, {key: 'F', type: 'keyDown'});
            mattermostView.handleInputEvents(null, {key: 'F', type: 'keyUp'});
            mattermostView.handleInputEvents(null, {key: 'Alt', type: 'keyUp'});
            expect(WindowManager.focusThreeDotMenu).not.toHaveBeenCalled();
        });
    });

    describe('handleDidNavigate', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostView(tabView, {}, window, {});

        beforeEach(() => {
            mattermostView.setBounds = jest.fn();
        });

        it('should hide back button on internal url', () => {
            Utils.shouldHaveBackBar.mockReturnValue(false);
            mattermostView.handleDidNavigate(null, 'http://server-1.com/path/to/channels');
            expect(WindowManager.sendToRenderer).toHaveBeenCalledWith(TOGGLE_BACK_BUTTON, false);
        });

        it('should show back button on external url', () => {
            Utils.shouldHaveBackBar.mockReturnValue(true);
            mattermostView.handleDidNavigate(null, 'http://server-2.com/some/other/path');
            expect(WindowManager.sendToRenderer).toHaveBeenCalledWith(TOGGLE_BACK_BUTTON, true);
        });
    });

    describe('handleUpdateTarget', () => {
        const window = {on: jest.fn()};
        const mattermostView = new MattermostView(tabView, {}, window, {});

        beforeEach(() => {
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
        const window = {on: jest.fn()};
        const mattermostView = new MattermostView(tabView, {}, window, {});

        it('should parse mentions from title', () => {
            mattermostView.updateMentionsFromTitle('(7) Mattermost');
            expect(appState.updateMentions).toHaveBeenCalledWith(mattermostView.tab.name, 7);
        });

        it('should parse unreads from title', () => {
            mattermostView.updateMentionsFromTitle('* Mattermost');
            expect(appState.updateMentions).toHaveBeenCalledWith(mattermostView.tab.name, 0);
        });
    });
});
