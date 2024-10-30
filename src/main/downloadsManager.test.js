// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';
import path from 'path';

import {shell} from 'electron';
import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import Config from 'common/config';
import {APP_UPDATE_KEY} from 'common/constants';
import {DownloadsManager} from 'main/downloadsManager';

const downloadLocationMock = '/path/to/downloads';
const locationMock = '/some/dir/file.txt';
const locationMock1 = '/downloads/file1.txt';
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
            getAppPath: jest.fn(),
            getPath: jest.fn(() => '/valid/downloads/path'),
        },
        WebContentsView: jest.fn().mockImplementation(() => ({
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
            removeHandler: jest.fn(),
            removeListener: jest.fn(),
        },
        Menu: {
            getApplicationMenu: () => ({
                getMenuItemById: jest.fn(),
            }),
        },
        Notification: NotificationMock,
        session: {
            defaultSession: {
                on: jest.fn(),
            },
        },
        shell: {
            showItemInFolder: jest.fn(),
            openPath: jest.fn(),
        },
    };
});
jest.mock('path', () => {
    const original = jest.requireActual('path');
    return {
        ...original,
        resolve: jest.fn(),
        parse: jest.fn(),
    };
});
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(false),
    readFileSync: jest.fn().mockImplementation((text) => text),
    writeFile: jest.fn(),
}));
jest.mock('macos-notification-state', () => ({
    getDoNotDisturb: jest.fn(),
}));
jest.mock('main/notifications', () => ({}));
jest.mock('main/windows/mainWindow', () => ({
    sendToRenderer: jest.fn(),
}));
jest.mock('main/views/viewManager', () => ({}));
jest.mock('common/config', () => {
    const original = jest.requireActual('common/config');
    return {
        ...original,
        canUpgrade: true,
        downloadLocation: downloadLocationMock,
    };
});

const downloadsJson = {
    'file1.txt': {
        addedAt: 1662545584346,
        filename: 'file1.txt',
        mimeType: 'text/plain',
        location: '/downloads/file1.txt',
        progress: 100,
        receivedBytes: 5425,
        state: 'completed',
        totalBytes: 5425,
        type: 'file',
    },
    'file2.txt': {
        addedAt: 1662545588346,
        filename: 'file2.txt',
        mimeType: 'text/plain',
        location: '/downloads/file2.txt',
        progress: 100,
        receivedBytes: 5425,
        state: 'cancelled',
        totalBytes: 5425,
        type: 'file',
    },
};
const nowSeconds = Date.now() / 1000;
const item = {
    getFilename: () => 'file.txt',
    getMimeType: () => 'text/plain',
    getReceivedBytes: () => 2121,
    getStartTime: () => nowSeconds,
    getTotalBytes: () => 4242,
    getSavePath: () => locationMock,
    getURL: () => 'http://some-url.com/some-text.txt',
    hasUserGesture: jest.fn().mockReturnValue(true),
    setSavePath: jest.fn(),
    on: jest.fn(),
    setSaveDialogOptions: jest.fn(),
    once: jest.fn(),
    location: locationMock,
};
const item1 = {
    ...item,
    getFilename: () => 'file1.txt',
    getSavePath: () => locationMock1,
    location: locationMock1,
};
describe('main/downloadsManager', () => {
    beforeEach(() => {
        getDarwinDoNotDisturb.mockReturnValue(false);
    });

    it('should be initialized', () => {
        expect(new DownloadsManager({})).toHaveProperty('downloads', {});
    });
    it('should mark "completed" files that were deleted as "deleted"', () => {
        expect(new DownloadsManager(JSON.stringify(downloadsJson))).toHaveProperty('downloads', {...downloadsJson, 'file1.txt': {...downloadsJson['file1.txt'], state: 'deleted'}});
    });
    it('should handle a new download', async () => {
        const dl = new DownloadsManager({});
        path.parse.mockImplementation(() => ({base: 'file.txt'}));
        dl.willDownloadURLs.set('http://some-url.com/some-text.txt', {filePath: locationMock});
        await dl.handleNewDownload({preventDefault: jest.fn()}, item, {id: 0, getURL: jest.fn(), downloadURL: jest.fn()});
        expect(dl).toHaveProperty('downloads', {'file.txt': {
            addedAt: nowSeconds * 1000,
            filename: 'file.txt',
            mimeType: 'text/plain',
            location: '/some/dir/file.txt',
            progress: 50,
            receivedBytes: 2121,
            state: 'progressing',
            totalBytes: 4242,
            type: 'file',
        }});
    });

    it('should monitor network to retrieve the file size of downloading items', () => {
        const dl = new DownloadsManager({});
        const details = {
            responseHeaders: {
                'content-encoding': ['gzip'],
                'x-uncompressed-content-length': ['4242'],
                'content-disposition': ['attachment; filename="file.txt"; foobar'],
            },
        };
        dl.webRequestOnHeadersReceivedHandler(details, jest.fn());
        expect(dl.fileSizes.get('file.txt')).toBe('4242');
    });

    it('should clear the downloads list', () => {
        const dl = new DownloadsManager(JSON.stringify(downloadsJson));
        dl.clearDownloadsDropDown();
        expect(dl).toHaveProperty('downloads', {});
    });

    it('should open downloads folder if file deleted', () => {
        const dl = new DownloadsManager(JSON.stringify(downloadsJson));
        path.parse.mockImplementation(() => ({base: 'file1.txt'}));
        dl.showFileInFolder(item1);
        expect(shell.openPath).toHaveBeenCalledWith(downloadLocationMock);
    });

    it('should show the file in the downloads folder', () => {
        const dl = new DownloadsManager(JSON.stringify(downloadsJson));
        fs.existsSync.mockReturnValueOnce(true);
        path.parse.mockImplementation(() => ({base: 'file1.txt'}));
        dl.showFileInFolder(item1);
        expect(shell.showItemInFolder).toHaveBeenCalledWith(locationMock1);
    });

    it('MM-48483 - should remove an invalid file from the list on startup', () => {
        const dl = new DownloadsManager(JSON.stringify({
            ...downloadsJson,
            'invalid_file1.txt': undefined,
            'invalid_file2.txt': {},
            'invalid_file3.txt': {invalidProperty: 'something'},
            'invalid_file4.txt': {
                state: 'completed',
                type: 'file',
            },
            'invalid_file5.txt': {
                filename: 'invalid_file5.txt',
                type: 'file',
            },
            'invalid_file6.txt': {
                filename: 'invalid_file5.txt',
                state: 'completed',
            },
        }));
        expect(Object.keys(dl.downloads).includes('invalid_file1.txt')).toBe(false);
        expect(Object.keys(dl.downloads).includes('invalid_file2.txt')).toBe(false);
        expect(Object.keys(dl.downloads).includes('invalid_file3.txt')).toBe(false);
        expect(Object.keys(dl.downloads).includes('invalid_file4.txt')).toBe(false);
        expect(Object.keys(dl.downloads).includes('invalid_file5.txt')).toBe(false);
        expect(Object.keys(dl.downloads).includes('invalid_file6.txt')).toBe(false);
    });

    it('should remove updates if they are disabled', () => {
        const file = JSON.stringify({
            ...downloadsJson,
            [APP_UPDATE_KEY]: {
                type: 'update',
                progress: 0,
                location: '',
                addedAt: 0,
                receivedBytes: 0,
                totalBytes: 0,
                state: 'available',
                filename: '1.2.3',
            },
        });
        const dl = new DownloadsManager(file);
        expect(dl.hasUpdate()).toBe(true);
        Config.canUpgrade = false;
        dl.init();
        expect(dl.hasUpdate()).toBe(false);
    });
});

