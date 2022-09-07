// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {DOWNLOADS_DROPDOWN_FULL_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT, TAB_BAR_HEIGHT} from 'common/utils/constants';

import DownloadsDropdownView from './downloadsDropdownView';

jest.mock('main/utils', () => ({
    getLocalPreload: (file) => file,
    getLocalURLString: (file) => file,
}));
jest.mock('electron', () => {
    class NotificationMock {
        static isSupported = jest.fn();
        static didConstruct = jest.fn();
        constructor() {
            NotificationMock.didConstruct();
        }
        on = jest.fn();
        show = jest.fn();
        click = jest.fn();
        close = jest.fn();
    }
    return {
        app: {
            getAppPath: () => '',
        },
        BrowserView: jest.fn().mockImplementation(() => ({
            webContents: {
                loadURL: jest.fn(),
                focus: jest.fn(),
                session: {
                    webRequest: {
                        onHeadersReceived: jest.fn(),
                    },
                },
            },
            setBounds: jest.fn(),
        })),
        ipcMain: {
            emit: jest.fn(),
            handle: jest.fn(),
            on: jest.fn(),
        },
        Notification: NotificationMock,
    };
});
jest.mock('main/windows/windowManager', () => ({
    sendToRenderer: jest.fn(),
}));
jest.mock('common/JsonFileManager', () => {
    class JsonFileManagerMock {
        jsonFile;
        json;
        constructor(file) {
            this.jsonFile = file;
            this.json = {};
        }
        writeToFile = jest.fn().mockImplementation(() => {
            this.jsonFile = this.json;
        });
        setJson = jest.fn().mockImplementation((json) => {
            this.json = json;
            this.writeToFile();
        })
        setValue = jest.fn().mockImplementation((key, value) => {
            this.json[key] = value;
            this.writeToFile();
        });
        getValue = jest.fn().mockImplementation((key) => {
            return this.json[key];
        });
    }
    return JsonFileManagerMock;
});

describe('main/views/DownloadsDropdownView', () => {
    describe('getBounds', () => {
        it('should be placed far right when window is large enough', () => {
            const window = {
                getContentBounds: () => ({width: 800, height: 600, x: 0, y: 0}),
                addBrowserView: jest.fn(),
                setTopBrowserView: jest.fn(),
            };
            const downloadsDropdownView = new DownloadsDropdownView(window, {}, false);
            expect(downloadsDropdownView.getBounds(DOWNLOADS_DROPDOWN_FULL_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT)).toStrictEqual({x: 800 - DOWNLOADS_DROPDOWN_FULL_WIDTH, y: TAB_BAR_HEIGHT, width: DOWNLOADS_DROPDOWN_FULL_WIDTH, height: DOWNLOADS_DROPDOWN_HEIGHT});
        });
        it('should be placed left if window is very small', () => {
            const window = {
                getContentBounds: () => ({width: 500, height: 400, x: 0, y: 0}),
                addBrowserView: jest.fn(),
                setTopBrowserView: jest.fn(),
            };
            const downloadsDropdownView = new DownloadsDropdownView(window, {}, false);
            expect(downloadsDropdownView.getBounds(DOWNLOADS_DROPDOWN_FULL_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT)).toStrictEqual({x: 0, y: TAB_BAR_HEIGHT, width: DOWNLOADS_DROPDOWN_FULL_WIDTH, height: DOWNLOADS_DROPDOWN_HEIGHT});
        });
    });

    it('should change the view bounds based on open/closed state', () => {
        const window = {
            getContentBounds: () => ({width: 800, height: 600, x: 0, y: 0}),
            addBrowserView: jest.fn(),
            setTopBrowserView: jest.fn(),
        };
        const downloadsDropdownView = new DownloadsDropdownView(window, {}, false);
        downloadsDropdownView.bounds = {width: 400, height: 300};
        downloadsDropdownView.handleOpen();
        expect(downloadsDropdownView.view.setBounds).toBeCalledWith(downloadsDropdownView.bounds);
        downloadsDropdownView.handleClose();
        expect(downloadsDropdownView.view.setBounds).toBeCalledWith({width: 0, height: 0, x: expect.any(Number), y: expect.any(Number)});
    });
});
