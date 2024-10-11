// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shell} from 'electron';

import ServerViewState from 'app/serverViewState';
import {parseURL} from 'common/utils/url';
import ViewManager from 'main/views/viewManager';

import PluginsPopUpsManager from './pluginsPopUps';

import allowProtocolDialog from '../allowProtocolDialog';

jest.mock('electron', () => ({
    shell: {
        openExternal: jest.fn(),
    },
}));

jest.mock('main/views/viewManager', () => ({
    getView: jest.fn(),
    getViewByWebContentsId: jest.fn(),
    handleDeepLink: jest.fn(),
}));

jest.mock('app/serverViewState', () => ({
    switchServer: jest.fn(),
}));

jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
    focus: jest.fn(),
}));

const mockContextMenuReload = jest.fn();
const mockContextMenuDispose = jest.fn();
jest.mock('../contextMenu', () => {
    return jest.fn().mockImplementation(() => {
        return {
            reload: mockContextMenuReload,
            dispose: mockContextMenuDispose,
        };
    });
});

jest.mock('../allowProtocolDialog', () => ({
    handleDialogEvent: jest.fn(),
}));

describe('PluginsPopUpsManager', () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    it('generateHandleCreateWindow', () => {
        const handlers = {};
        const win = {
            webContents: {
                id: 45,
                on: jest.fn((ev, handler) => {
                    handlers[ev] = handler;
                }),
                once: jest.fn((ev, handler) => {
                    handlers[ev] = handler;
                }),
                setWindowOpenHandler: jest.fn((handler) => {
                    handlers['window-open'] = handler;
                }),
                removeAllListeners: jest.fn(),
            },
            once: jest.fn((ev, handler) => {
                handlers[ev] = handler;
            }),
        };
        const details = {
            url: 'about:blank',
        };
        PluginsPopUpsManager.generateHandleCreateWindow(1)(win, details);

        expect(win.webContents.on).toHaveBeenNthCalledWith(1, 'will-redirect', handlers['will-redirect']);
        expect(win.webContents.on).toHaveBeenNthCalledWith(2, 'will-navigate', handlers['will-navigate']);
        expect(win.webContents.on).toHaveBeenNthCalledWith(3, 'did-start-navigation', handlers['did-start-navigation']);
        expect(win.webContents.once).toHaveBeenCalledWith('render-process-gone', handlers['render-process-gone']);
        expect(win.webContents.setWindowOpenHandler).toHaveBeenCalledWith(handlers['window-open']);

        expect(win.once).toHaveBeenCalledWith('closed', handlers.closed);

        expect(mockContextMenuReload).toHaveBeenCalledTimes(1);

        // Verify the popout has been added to the map
        expect(PluginsPopUpsManager.popups).toHaveProperty('45', {parentId: 1, win});

        // Verify redirects are disabled
        const redirectEv = {
            preventDefault: jest.fn(),
        };
        handlers['will-redirect'](redirectEv);
        expect(redirectEv.preventDefault).toHaveBeenCalled();

        // Verify navigations are only allowed to the same url
        const navigateEv = {
            preventDefault: jest.fn(),
            url: 'about:blank',
        };
        handlers['will-navigate'](navigateEv);
        expect(navigateEv.preventDefault).not.toHaveBeenCalled();
        navigateEv.url = 'http://localhost:8065';
        handlers['will-navigate'](navigateEv);
        expect(navigateEv.preventDefault).toHaveBeenCalled();

        navigateEv.preventDefault = jest.fn();
        navigateEv.url = 'about:blank';
        handlers['did-start-navigation'](navigateEv);
        expect(navigateEv.preventDefault).not.toHaveBeenCalled();
        navigateEv.url = 'http://localhost:8065';
        handlers['did-start-navigation'](navigateEv);
        expect(navigateEv.preventDefault).toHaveBeenCalled();

        // Verify opening new windows is not allowed
        expect(handlers['window-open']({url: ''})).toEqual({action: 'deny'});
        expect(shell.openExternal).not.toHaveBeenCalled();

        // Verify internal link is routed in main view
        ViewManager.getViewByWebContentsId.mockReturnValue({name: 'parent', webContentsId: 1, view: {server: {url: parseURL('http://localhost:8065'), id: 4545}}});
        expect(handlers['window-open']({url: 'http://localhost:8065/team/channel'})).toEqual({action: 'deny'});
        expect(shell.openExternal).not.toHaveBeenCalled();
        expect(ServerViewState.switchServer).toHaveBeenCalledWith(4545);
        expect(ViewManager.handleDeepLink).toHaveBeenCalledWith(parseURL('http://localhost:8065/team/channel'));

        // Verify opening custom protocols is handled through allowProtocolDialog
        expect(handlers['window-open']({url: 'custom:somelink'})).toEqual({action: 'deny'});
        expect(allowProtocolDialog.handleDialogEvent).toBeCalledWith('custom:', 'custom:somelink');
        expect(shell.openExternal).not.toHaveBeenCalledWith('custom:somelink');

        // Verify opening external links is allowed through browser
        expect(handlers['window-open']({url: 'https://www.example.com'})).toEqual({action: 'deny'});
        expect(shell.openExternal).toHaveBeenCalledWith('https://www.example.com');

        // Simulate render process gone
        handlers['render-process-gone'](null, {reason: 'oom'});
        expect(win.webContents.removeAllListeners).toHaveBeenCalledTimes(1);

        // Throw case
        win.webContents.removeAllListeners = jest.fn(() => {
            throw new Error('failed');
        });
        handlers['render-process-gone'](null, {reason: 'clean-exit'});
        expect(win.webContents.removeAllListeners).toHaveBeenCalledTimes(1);

        // Close
        handlers.closed();
        expect(mockContextMenuDispose).toHaveBeenCalledTimes(1);

        // Verify the popout reference has been deleted
        expect(PluginsPopUpsManager.popups).toEqual({});
    });

    it('handleNewWindow', () => {
        // Anything but about:blank should not be allowed
        expect(PluginsPopUpsManager.handleNewWindow(45, {url: ''})).toEqual({action: 'deny'});
        expect(PluginsPopUpsManager.handleNewWindow(45, {url: 'http://localhost:8065'})).toEqual({action: 'deny'});

        // We should deny also if the parent view doesn't exist
        expect(PluginsPopUpsManager.handleNewWindow(45, {url: 'about:blank'})).toEqual({action: 'deny'});

        // Finally, we allow if URL is `about:blank` and a parent view exists
        ViewManager.getViewByWebContentsId.mockReturnValue({name: 'parent', webContentsId: 1});
        expect(PluginsPopUpsManager.handleNewWindow(45, {url: 'about:blank'})).toEqual({action: 'allow'});
    });
});
