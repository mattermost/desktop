// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import {DownloadsManager} from 'main/downloadsManager';

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
jest.mock('main/windows/windowManager', () => ({
    sendToRenderer: jest.fn(),
}));
jest.mock('common/config', () => {
    const original = jest.requireActual('common/config');
    return {
        ...original,
        downloadLocation: '/path/to/downloads',
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
    it('should handle a new download', () => {
        const dl = new DownloadsManager({});
        const nowSeconds = Date.now() / 1000;
        const item = {
            getFilename: () => 'file.txt',
            getMimeType: () => 'text/plain',
            getReceivedBytes: () => 2121,
            getStartTime: () => nowSeconds,
            getTotalBytes: () => 4242,
            getSavePath: () => '/some/dir/file.txt',
            setSavePath: () => '/some/dir',
            on: jest.fn(),
            setSaveDialogOptions: jest.fn(),
            once: jest.fn(),
        };
        path.parse.mockImplementation(() => ({base: 'file.txt'}));
        dl.handleNewDownload({}, item, {id: 0, getURL: jest.fn()});
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
});

