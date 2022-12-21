// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const env = require('../modules/environment');
const {asyncSleep} = require('../modules/utils');

const {measurePerformance} = require('./utils');

describe('startup/app', function desc() {
    this.timeout(30000);

    it('should show the welcome screen modal when no servers exist', async () => {
        await measurePerformance(
            async () => {
                if (this.app) {
                    await this.app.close();
                }
                await env.clearElectronInstances();
                env.createTestUserDataDir();
                env.cleanTestConfig();
            },
            async () => {
                this.app = await env.getApp();
                await asyncSleep(500);
                const welcomeScreenModal = this.app.windows().find((window) => window.url().includes('welcomeScreen'));
                const modalButton = await welcomeScreenModal.innerText('.WelcomeScreen .WelcomeScreen__button');
                modalButton.should.equal('Get Started');
            },
            () => {},
            5,
            2200,
        );
    });
});
