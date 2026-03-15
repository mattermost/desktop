// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const {expect} = require('chai');
const {SHOW_SETTINGS_WINDOW} = require('src/common/communication');

const env = require('../../modules/environment');

describe('permissions/ipc', function desc() {
    this.timeout(30000);

    before(async function() {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(env.demoConfig));
        this.app = await env.getApp();
        await this.app.evaluate(({ipcMain}, showWindow) => {
            ipcMain.emit(showWindow);
        }, SHOW_SETTINGS_WINDOW);
        this.settingsWindow = await this.app.waitForEvent('window', {
            predicate: (w) => w.url().includes('settings'),
        });
        await this.settingsWindow.waitForLoadState('domcontentloaded');
    });

    after(async function() {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    it('E2E-P01: should return a valid media access status via GET_MEDIA_ACCESS_STATUS IPC', async function() {
        const status = await this.settingsWindow.evaluate(
            () => window.desktop.getMediaAccessStatus('microphone'),
        );
        expect(['granted', 'denied', 'not-determined', 'restricted', 'unknown']).to.include(status);
    });

    env.shouldTest(it, process.platform === 'win32')(
        'E2E-P02: should open ms-settings:privacy-webcam for camera preferences (Windows only)',
        async function() {
            await this.app.evaluate(() => {
                const {shell} = require('electron');
                global.__testCapturedExternalURL = null;
                shell.openExternal = (url) => {
                    global.__testCapturedExternalURL = url;
                    return Promise.resolve();
                };
            });

            await this.settingsWindow.evaluate(
                () => window.desktop.openWindowsCameraPreferences(),
            );

            const capturedURL = await this.app.evaluate(
                () => global.__testCapturedExternalURL,
            );
            expect(capturedURL).to.equal('ms-settings:privacy-webcam');
        },
    );

    env.shouldTest(it, process.platform === 'win32')(
        'E2E-P03: should open ms-settings:privacy-microphone for microphone preferences (Windows only)',
        async function() {
            await this.app.evaluate(() => {
                const {shell} = require('electron');
                global.__testCapturedExternalURL = null;
                shell.openExternal = (url) => {
                    global.__testCapturedExternalURL = url;
                    return Promise.resolve();
                };
            });

            await this.settingsWindow.evaluate(
                () => window.desktop.openWindowsMicrophonePreferences(),
            );

            const capturedURL = await this.app.evaluate(
                () => global.__testCapturedExternalURL,
            );
            expect(capturedURL).to.equal('ms-settings:privacy-microphone');
        },
    );
});
