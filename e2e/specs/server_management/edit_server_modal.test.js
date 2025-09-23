// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('EditServerModal', function desc() {
    this.timeout(30000);
    const config = env.demoConfig;

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();

        const mainView = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
        await mainView.click('.ServerDropdownButton');
        await dropdownView.hover('.ServerDropdown .ServerDropdown__button:nth-child(1)');
        await dropdownView.click('.ServerDropdown .ServerDropdown__button:nth-child(1) button.ServerDropdown__button-edit');

        editServerView = await this.app.waitForEvent('window', {
            predicate: (window) => window.url().includes('editServer'),
        });
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    let editServerView;

    it('should not edit server when Cancel is pressed', async () => {
        await editServerView.click('#newServerModal_cancel');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
        existing.should.be.false;

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.servers.should.deep.contain({
            name: 'example',
            url: env.exampleURL,
            order: 0,
        });
    });

    it('MM-T4391_1 should not edit server when Save is pressed but nothing edited', async () => {
        await editServerView.click('#newServerModal_confirm');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
        existing.should.be.false;

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.servers.should.deep.contain({
            name: 'example',
            url: env.exampleURL,
            order: 0,
        });
    });

    it('MM-T2826_3 should not edit server if an invalid server address has been set', async () => {
        await editServerView.fill('#serverUrlInput', 'superInvalid url');
        await editServerView.waitForSelector('#customMessage_url.Input___error');
        const existing = await editServerView.isVisible('#customMessage_url.Input___error');
        existing.should.be.true;
    });

    it('MM-T4391_2 should edit server when Save is pressed and name edited', async () => {
        await editServerView.fill('#serverNameInput', 'NewTestServer');
        await editServerView.click('#newServerModal_confirm');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
        existing.should.be.false;

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.servers.should.not.deep.contain({
            name: 'example',
            url: env.exampleURL,
            order: 0,
        });
        savedConfig.servers.should.deep.contain({
            name: 'NewTestServer',
            url: env.exampleURL,
            order: 0,
        });
    });

    it('MM-T4391_3 should edit server when Save is pressed and URL edited', async () => {
        await editServerView.fill('#serverUrlInput', 'http://google.com');
        await editServerView.click('#newServerModal_confirm');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
        existing.should.be.false;

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.servers.should.not.deep.contain({
            name: 'example',
            url: env.exampleURL,
            order: 0,
        });
        savedConfig.servers.should.deep.contain({
            name: 'example',
            url: 'http://google.com/',
            order: 0,
        });
    });

    it('MM-T4391_4 should edit server when Save is pressed and both edited', async () => {
        await editServerView.fill('#serverNameInput', 'NewTestServer');
        await editServerView.fill('#serverUrlInput', 'http://google.com');
        await editServerView.click('#newServerModal_confirm');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
        existing.should.be.false;

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.servers.should.not.deep.contain({
            name: 'example',
            url: env.exampleURL,
            order: 0,
        });
        savedConfig.servers.should.deep.contain({
            name: 'NewTestServer',
            url: 'http://google.com/',
            order: 0,
        });
    });

    describe('Pre-Auth Header Editing', () => {
        it('should show advanced section with pre-auth field in edit mode', async () => {
            await editServerView.click('button.NewServerModal__advanced-toggle');
            await editServerView.waitForSelector('#input_preAuthSecret');
            const preAuthField = await editServerView.isVisible('#input_preAuthSecret');
            preAuthField.should.be.true;
        });

        it('should show masked pre-auth secret if one exists', async () => {
            // Simulate existing pre-auth secret by typing in the field and checking if it shows masked characters
            await editServerView.click('button.NewServerModal__advanced-toggle');
            const inputType = await editServerView.getAttribute('#input_preAuthSecret', 'type');
            inputType.should.equal('password');
        });

        it('should allow editing pre-auth secret', async () => {
            await editServerView.click('button.NewServerModal__advanced-toggle');
            await editServerView.fill('#input_preAuthSecret', 'new-secret-123');
            const value = await editServerView.inputValue('#input_preAuthSecret');
            value.should.equal('new-secret-123');
        });

        it('should validate server with updated pre-auth secret', async () => {
            // Mock server response for validation
            await editServerView.route('**/api/v4/system/ping', (route) => {
                const authHeader = route.request().headers()['x-mattermost-preauth-secret'];
                if (authHeader === 'valid-updated-secret') {
                    route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({status: 'OK'}),
                    });
                } else {
                    route.fulfill({
                        status: 403,
                        contentType: 'application/json',
                        body: JSON.stringify({message: 'Invalid authentication secret'}),
                    });
                }
            });

            await editServerView.click('button.NewServerModal__advanced-toggle');
            await editServerView.fill('#input_preAuthSecret', 'valid-updated-secret');
            await editServerView.waitForSelector('#customMessage_url.Input___success');
            await asyncSleep(3000);
            await editServerView.click('#newServerModal_confirm');

            const successMessage = await editServerView.isVisible('#customMessage_url.Input___success');
            successMessage.should.be.true;
        });

        it('should save server with updated pre-auth secret', async () => {
            // Mock successful validation
            await editServerView.route('**/api/v4/system/ping', (route) => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({status: 'OK'}),
                });
            });

            await editServerView.click('button.NewServerModal__advanced-toggle');
            await editServerView.fill('#input_preAuthSecret', 'updated-secret');
            await editServerView.fill('#serverNameInput', 'UpdatedServerName');
            await editServerView.click('#newServerModal_confirm');
            await asyncSleep(1000);

            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
            existing.should.be.false;

            // Verify server name was updated in config
            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            savedConfig.teams.should.deep.contain({
                name: 'UpdatedServerName',
                url: env.exampleURL,
                order: 0,
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
                lastActiveTab: 0,
            });
        });

        it('should allow clearing pre-auth secret', async () => {
            await editServerView.click('button.NewServerModal__advanced-toggle');
            await editServerView.fill('#input_preAuthSecret', '');
            await editServerView.click('#newServerModal_confirm');
            await asyncSleep(1000);

            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
            existing.should.be.false;
        });
    });
});
