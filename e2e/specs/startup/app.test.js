// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('startup/app', function desc() {
    this.timeout(30000);

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        this.app = await env.getApp();
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    it('MM-T4400 should be stopped when the app instance already exists', (done) => {
        const secondApp = env.getApp();

        // In the correct case, 'start().then' is not called.
        // So need to use setTimeout in order to finish this test.
        const timer = setTimeout(() => {
            done();
        }, 3000);
        secondApp.then(() => {
            clearTimeout(timer);
            return secondApp.close();
        }).then(() => {
            done(new Error('Second app instance exists'));
        });
    });

    it('MM-T4975 should show the welcome screen modal when no servers exist', async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        this.app = await env.getApp();

        await asyncSleep(500);

        const welcomeScreenModal = this.app.windows().find((window) => window.url().includes('welcomeScreen'));
        const modalButton = await welcomeScreenModal.innerText('.WelcomeScreen .WelcomeScreen__button');
        modalButton.should.equal('Get Started');
    });

    if (process.platform !== 'linux') {
        it('MM-T4985 should show app name in title bar when no servers exist', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const titleBarText = await mainWindow.innerText('.app-title');
            titleBarText.should.equal('Electron');
        });
    }
});
