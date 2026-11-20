// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SET_URL_FOR_URL_VIEW, UPDATE_URL_VIEW_WIDTH} from 'common/communication';

import {URLView} from './urlView';

import {ipcMain} from 'electron';

jest.mock('electron', () => {
    const EventEmitter = jest.requireActual('events');
    const mockIpcMain = new EventEmitter();

    return {
        ipcMain: mockIpcMain,
        WebContentsView: jest.fn().mockImplementation(() => {
            const {EventEmitter} = jest.requireActual('events');
            const mockWebContents = new EventEmitter();
            mockWebContents.send = jest.fn();
            mockWebContents.loadURL = jest.fn();

            return {
                webContents: mockWebContents,
                setBackgroundColor: jest.fn(),
                setBounds: jest.fn(),
                setVisible: jest.fn(),
            };
        }),
    };
});

jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));
jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn(),
    getWindowBoundaries: jest.fn(),
}));

describe('main/views/urlView', () => {
    const parent = {
        contentView: {
            addChildView: jest.fn(),
            children: [],
        },
        webContents: {
            id: 123,
        },
        getBounds: jest.fn(() => ({x: -7, y: -7, width: 1296, height: 688})),
        getContentBounds: jest.fn(() => ({x: 0, y: 0, width: 1280, height: 672})),
    };

    it('should show the url and show the view', () => {
        const urlView = new URLView(parent);

        urlView.show('https://example.com');

        expect(urlView.urlView.webContents.send).toHaveBeenCalledWith(SET_URL_FOR_URL_VIEW, 'https://example.com');
        expect(urlView.urlView.setVisible).toHaveBeenCalledWith(true);
    });

    it('should position the view using content bounds, not window bounds', () => {
        const urlView = new URLView(parent);

        urlView.show('https://example.com');

        ipcMain.emit(UPDATE_URL_VIEW_WIDTH, {}, 800);

        expect(urlView.urlView.setBounds).toHaveBeenCalledWith(expect.objectContaining({
            y: 652,
        }));
    });
});
