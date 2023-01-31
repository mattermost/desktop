// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const env = require('../modules/environment');

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

    it('should show the welcome screen modal when no servers exist', async () => {
        const welcomeScreenModal = this.app.windows().find((window) => window.url().includes('welcomeScreen'));
        const modalButton = await welcomeScreenModal.innerText('.WelcomeScreen .WelcomeScreen__button');
        modalButton.should.equal('Get Started');
    });
});
