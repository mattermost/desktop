// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import {shell, dialog} from 'electron';

import {AllowProtocolDialog} from './allowProtocolDialog';
import MainWindow from './windows/mainWindow';

jest.mock('fs', () => ({
    readFile: jest.fn(),
    writeFile: jest.fn(),
}));

jest.mock('path', () => ({
    resolve: () => 'path',
}));

jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(),
    },
    dialog: {
        showMessageBox: jest.fn(),
    },
    shell: {
        openExternal: jest.fn(),
    },
}));

jest.mock('common/config/buildConfig', () => ({
    allowedProtocols: [
        'pone',
        'ptwo',
    ],
}));

jest.mock('common/Validator', () => ({
    validateAllowedProtocols: (protocols) => protocols,
}));

jest.mock('./windows/mainWindow', () => ({
    get: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

describe('main/allowProtocolDialog', () => {
    describe('init', () => {
        it('should copy data from file when no error', () => {
            fs.readFile.mockImplementation((fileName, encoding, callback) => {
                callback(null, '["spotify:", "steam:", "git:"]');
            });

            const allowProtocolDialog = new AllowProtocolDialog();
            allowProtocolDialog.init();

            expect(allowProtocolDialog.allowedProtocols).toContain('spotify:');
            expect(allowProtocolDialog.allowedProtocols).toContain('steam:');
            expect(allowProtocolDialog.allowedProtocols).toContain('git:');
        });

        it('should include data from electron-builder', () => {
            const allowProtocolDialog = new AllowProtocolDialog();
            allowProtocolDialog.init();

            expect(allowProtocolDialog.allowedProtocols).toContain('pone:');
            expect(allowProtocolDialog.allowedProtocols).toContain('ptwo:');
        });

        it('should always include http and https', () => {
            const allowProtocolDialog = new AllowProtocolDialog();
            allowProtocolDialog.init();

            expect(allowProtocolDialog.allowedProtocols).toContain('http:');
            expect(allowProtocolDialog.allowedProtocols).toContain('https:');
        });
    });

    describe('addScheme', () => {
        it('should add new scheme to the list', () => {
            const allowProtocolDialog = new AllowProtocolDialog();
            allowProtocolDialog.addScheme('test');

            expect(allowProtocolDialog.allowedProtocols).toContain('test:');
        });

        it('should not add duplicates', () => {
            const allowProtocolDialog = new AllowProtocolDialog();
            allowProtocolDialog.addScheme('test');
            allowProtocolDialog.addScheme('test2');
            allowProtocolDialog.addScheme('test');

            expect(allowProtocolDialog.allowedProtocols).toStrictEqual(['test:', 'test2:']);
        });
    });

    describe('handleDialogEvent', () => {
        fs.readFile.mockImplementation((fileName, encoding, callback) => {
            callback(null, '["spotify:", "steam:", "git:"]');
        });

        let allowProtocolDialog;
        beforeEach(() => {
            allowProtocolDialog = new AllowProtocolDialog();
            allowProtocolDialog.init();
        });

        it('should open protocol that is already allowed', () => {
            allowProtocolDialog.handleDialogEvent('spotify:', 'spotify:album:3AQgdwMNCiN7awXch5fAaG');
            expect(shell.openExternal).toBeCalledWith('spotify:album:3AQgdwMNCiN7awXch5fAaG');
        });

        it('should not open message box if main window is missing', () => {
            MainWindow.get.mockImplementation(() => null);
            allowProtocolDialog.handleDialogEvent('mattermost:', 'mattermost://community.mattermost.com');
            expect(shell.openExternal).not.toBeCalled();
            expect(dialog.showMessageBox).not.toBeCalled();
        });

        describe('main window not null', () => {
            beforeEach(() => {
                MainWindow.get.mockImplementation(() => ({}));
            });

            it('should open the window but not save when clicking Yes', async () => {
                const promise = Promise.resolve({response: 0});
                dialog.showMessageBox.mockImplementation(() => promise);
                allowProtocolDialog.handleDialogEvent('mattermost:', 'mattermost://community.mattermost.com');
                await promise;

                expect(shell.openExternal).toBeCalledWith('mattermost://community.mattermost.com');
                expect(allowProtocolDialog.allowedProtocols).not.toContain('mattermost:');
                expect(fs.writeFile).not.toBeCalled();
            });

            it('should open the window and save when clicking Yes and Save', async () => {
                const promise = Promise.resolve({response: 1});
                dialog.showMessageBox.mockImplementation(() => promise);
                allowProtocolDialog.handleDialogEvent('mattermost:', 'mattermost://community.mattermost.com');
                await promise;

                expect(shell.openExternal).toBeCalledWith('mattermost://community.mattermost.com');
                expect(allowProtocolDialog.allowedProtocols).toContain('mattermost:');
                expect(fs.writeFile).toBeCalled();
            });

            it('should do nothing when clicking No', async () => {
                const promise = Promise.resolve({response: 2});
                dialog.showMessageBox.mockImplementation(() => promise);
                allowProtocolDialog.handleDialogEvent('mattermost:', 'mattermost://community.mattermost.com');
                await promise;

                expect(shell.openExternal).not.toBeCalled();
                expect(allowProtocolDialog.allowedProtocols).not.toContain('mattermost:');
                expect(fs.writeFile).not.toBeCalled();
            });

            it('should not throw error when shell.openExternal fails', async () => {
                const promise = Promise.resolve({response: 0});
                dialog.showMessageBox.mockImplementation(() => promise);
                shell.openExternal.mockReturnValue(Promise.reject(new Error('bad protocol')));
                allowProtocolDialog.handleDialogEvent('bad-protocol:', 'bad-protocol://community.mattermost.com');
                await promise;

                expect(shell.openExternal).toBeCalledWith('bad-protocol://community.mattermost.com');
            });
        });
    });
});
