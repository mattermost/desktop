// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import downloadsManager from 'main/downloadsManager';

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
                send: jest.fn(),
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

describe('main/downloadsManager', () => {
    it('should be initialized', () => {
        expect(downloadsManager).toHaveProperty('downloads', {});
    });

    // it('should setup save dialog correctly', async () => {
    //     const item = {
    //         getFilename: () => 'filename.txt',
    //         setSavePath: () => '/path/to/file',
    //         on: jest.fn(),
    //         setSaveDialogOptions: jest.fn(),
    //     };
    //     Config.downloadLocation = '/some/dir';
    //     path.resolve.mockImplementation((base, p) => `${base}/${p}`);
    //     session.defaultSession.on.mockImplementation((event, cb) => {
    //         if (event === 'will-download') {
    //             cb(null, item, {id: 0, getURL: jest.fn()});
    //         }
    //     });

    //     await initialize();
    //     expect(item.setSaveDialogOptions).toHaveBeenCalledWith(expect.objectContaining({
    //         title: 'filename.txt',
    //         defaultPath: '/some/dir/filename.txt',
    //     }));
    // });

    // it('should use name of saved file instead of original file name', async () => {
    //     const item = {
    //         getFilename: () => 'filename.txt',
    //         on: jest.fn(),
    //         setSaveDialogOptions: jest.fn(),
    //         savePath: '/some/dir/new_filename.txt',
    //     };
    //     Config.downloadLocation = '/some/dir';
    //     path.resolve.mockImplementation((base, p) => `${base}/${p}`);
    //     session.defaultSession.on.mockImplementation((event, cb) => {
    //         if (event === 'will-download') {
    //             cb(null, item, {id: 0, getURL: jest.fn()});
    //         }
    //     });

    //     item.on.mockImplementation((event, cb) => {
    //         if (event === 'done') {
    //             cb(null, 'completed');
    //         }
    //     });

    //     await initialize();
    //     expect(displayDownloadCompleted).toHaveBeenCalledWith('new_filename.txt', '/some/dir/new_filename.txt', expect.anything());
    // });
});

