// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-undef, import/no-commonjs */

// Stub used by jestSetup so unit tests never `require('electron')` for real.
// Electron 43+ downloads its binary lazily; parallel Jest workers otherwise
// race extracting dist/Electron.app (EEXIST) and fail with "failed to install".

module.exports = {
    app: {
        isReady: jest.fn(() => true),
        getPath: jest.fn(() => '/tmp'),
        getName: jest.fn(() => 'Mattermost'),
        getVersion: jest.fn(() => '5.0.0'),
        on: jest.fn(),
        once: jest.fn(),
        quit: jest.fn(),
    },
    ipcMain: {
        on: jest.fn(),
        handle: jest.fn(),
        emit: jest.fn(),
        removeHandler: jest.fn(),
        removeAllListeners: jest.fn(),
    },
    shell: {
        openExternal: jest.fn(),
        openPath: jest.fn(),
        showItemInFolder: jest.fn(),
    },
    powerMonitor: {
        getSystemIdleTime: jest.fn(() => 0),
        on: jest.fn(),
    },
    session: {
        defaultSession: {},
    },
    Notification: jest.fn(),
    systemPreferences: {
        getMediaAccessStatus: jest.fn(),
    },
    net: {
        request: jest.fn(),
    },
    dialog: {
        showMessageBox: jest.fn(),
        showOpenDialog: jest.fn(),
        showSaveDialog: jest.fn(),
    },
    BrowserWindow: jest.fn(),
    screen: {
        getPrimaryDisplay: jest.fn(() => ({
            workArea: {x: 0, y: 0, width: 1920, height: 1080},
        })),
        getAllDisplays: jest.fn(() => []),
    },
};
