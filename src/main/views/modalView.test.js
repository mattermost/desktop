// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ModalView} from './modalView';

jest.mock('electron', () => ({
    BrowserView: jest.fn().mockImplementation(() => ({
        webContents: {
            loadURL: jest.fn(),
            once: jest.fn(),
            isLoading: jest.fn(),
            focus: jest.fn(),
            openDevTools: jest.fn(),
            isDevToolsOpened: jest.fn(),
            closeDevTools: jest.fn(),
            close: jest.fn(),
        },
        setBounds: jest.fn(),
        setAutoResize: jest.fn(),
    })),
}));

jest.mock('../contextMenu', () => jest.fn());

jest.mock('../utils', () => ({
    getWindowBoundaries: jest.fn(),
}));

describe('main/views/modalView', () => {
    describe('show', () => {
        const window = {addBrowserView: jest.fn(), removeBrowserView: jest.fn()};
        const onResolve = jest.fn();
        const onReject = jest.fn();
        let modalView;

        beforeEach(() => {
            modalView = new ModalView(
                'test_modal',
                'some_html',
                'preload',
                {value1: 'value-1', value2: 'value-2'},
                onResolve,
                onReject,
                window,
                false,
            );

            modalView.view.webContents.isLoading = jest.fn().mockReturnValue(false);
        });

        it('should add to window', () => {
            modalView.show();
            expect(window.addBrowserView).toBeCalledWith(modalView.view);
            expect(modalView.status).toBe(1);
        });

        it('should reattach if already attached', () => {
            modalView.windowAttached = window;
            modalView.show();
            expect(window.removeBrowserView).toBeCalledWith(modalView.view);
            expect(window.addBrowserView).toBeCalledWith(modalView.view);
        });

        it('should delay call to focus when the modal is loading', () => {
            let callback;
            modalView.view.webContents.isLoading = jest.fn().mockReturnValue(true);
            modalView.view.webContents.once = jest.fn().mockImplementation((event, cb) => {
                callback = cb;
            });
            modalView.show();
            expect(modalView.view.webContents.once).toHaveBeenCalled();
            expect(modalView.view.webContents.focus).not.toHaveBeenCalled();
            callback();
            expect(modalView.view.webContents.focus).toHaveBeenCalled();
        });

        it('should open dev tools when specified', () => {
            modalView.show(undefined, true);
            expect(modalView.view.webContents.openDevTools).toHaveBeenCalled();
        });
    });

    describe('hide', () => {
        const window = {addBrowserView: jest.fn(), removeBrowserView: jest.fn()};
        const onResolve = jest.fn();
        const onReject = jest.fn();
        let modalView;

        beforeEach(() => {
            modalView = new ModalView(
                'test_modal',
                'some_html',
                'preload',
                {value1: 'value-1', value2: 'value-2'},
                onResolve,
                onReject,
                window,
                false,
            );

            modalView.view.webContents.isLoading = jest.fn().mockReturnValue(false);
            modalView.windowAttached = window;
        });

        it('should remove browser view and destroy web contents on hide', () => {
            modalView.hide();
            expect(modalView.view.webContents.close).toBeCalled();
            expect(window.removeBrowserView).toBeCalledWith(modalView.view);
        });

        it('should close dev tools when open', () => {
            modalView.view.webContents.isDevToolsOpened = jest.fn().mockReturnValue(true);
            modalView.hide();
            expect(modalView.view.webContents.closeDevTools).toBeCalled();
        });
    });
});
