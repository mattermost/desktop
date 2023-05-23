// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('Configure Server Modal', function desc() {
    this.timeout(30000);

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        await asyncSleep(1000);

        this.app = await env.getApp();

        configureServerModal = this.app.windows().find((window) => window.url().includes('welcomeScreen'));
        await configureServerModal.click('#getStartedWelcomeScreen');

        await asyncSleep(1000);
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    let configureServerModal;

    it('MM-T5115 should not be valid if no display name has been set', async () => {
        await configureServerModal.type('#input_name', '');

        const connectButtonDisabled = await configureServerModal.getAttribute('#connectConfigureServer', 'disabled');
        (connectButtonDisabled === '').should.be.true;
    });

    it('MM-T5116 should not be valid if no URL has been set', async () => {
        await configureServerModal.type('#input_url', '');

        const connectButtonDisabled = await configureServerModal.getAttribute('#connectConfigureServer', 'disabled');
        (connectButtonDisabled === '').should.be.true;
    });

    it('MM-T5117 should be valid if display name and URL are set', async () => {
        await configureServerModal.type('#input_name', 'TestServer');
        await configureServerModal.type('#input_url', 'https://community.mattermost.com');
        await configureServerModal.waitForSelector('#customMessage_url.Input___success');

        const connectButtonDisabled = await configureServerModal.getAttribute('#connectConfigureServer', 'disabled');
        (connectButtonDisabled === '').should.be.false;
    });

    it('MM-T5118 should not be valid if an invalid URL has been set', async () => {
        await configureServerModal.type('#input_name', 'TestServer');
        await configureServerModal.type('#input_url', '!@#$%^&*()');
        await configureServerModal.waitForSelector('#customMessage_url.Input___error');

        const errorClass = await configureServerModal.getAttribute('#customMessage_url', 'class');
        errorClass.should.contain('Input___error');

        const connectButtonDisabled = await configureServerModal.getAttribute('#connectConfigureServer', 'disabled');
        (connectButtonDisabled === '').should.be.true;
    });

    it('MM-T5119 should add the server to the config file', async () => {
        await configureServerModal.type('#input_name', 'TestServer');
        await configureServerModal.type('#input_url', 'http://example.org');

        await configureServerModal.click('#connectConfigureServer');

        await asyncSleep(1000);

        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('welcomeScreen')));
        existing.should.be.false;

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.teams.should.deep.contain({
            url: 'http://example.org/',
            name: 'TestServer',
            order: 0,
            lastActiveTab: 0,
            tabs: [
                {
                    name: 'TAB_MESSAGING',
                    order: 0,
                    isOpen: true,
                },
                {
                    name: 'TAB_FOCALBOARD',
                    order: 1,
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                },
            ],
        });
    });
});
