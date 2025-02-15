// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('Add Server Modal', function desc() {
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
        await dropdownView.click('.ServerDropdown .ServerDropdown__button.addServer');
        newServerView = await this.app.waitForEvent('window', {
            predicate: (window) => window.url().includes('newServer'),
        });

        // wait for autofocus to finish
        await asyncSleep(2000);
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    let newServerView;

    it('MM-T1312 should focus the first text input', async () => {
        const isFocused = await newServerView.$eval('#serverUrlInput', (el) => el.isSameNode(document.activeElement));
        isFocused.should.be.true;
    });

    it('MM-T4388 should close the window after clicking cancel', async () => {
        await newServerView.click('#newServerModal_cancel');
        await asyncSleep(1000);
        const existing = Boolean(this.app.windows().find((window) => window.url().includes('newServer')));
        existing.should.be.false;
    });

    describe('MM-T4389 Invalid messages', () => {
        it('MM-T4389_1 should not be valid and save should be disabled if no server name or URL has been set', async () => {
            const disabled = await newServerView.getAttribute('#newServerModal_confirm', 'disabled');
            (disabled === '').should.be.true;
        });

        it('should warn the user if a server with the same URL exists, but still allow them to save', async () => {
            await newServerView.type('#serverNameInput', 'some-new-server');
            await newServerView.type('#serverUrlInput', config.teams[0].url);
            await newServerView.waitForSelector('#customMessage_url.Input___warning');
            const existing = await newServerView.isVisible('#customMessage_url.Input___warning');
            existing.should.be.true;
            const disabled = await newServerView.getAttribute('#newServerModal_confirm', 'disabled');
            (disabled === '').should.be.false;
        });

        describe('Valid server name', async () => {
            beforeEach(async () => {
                await newServerView.type('#serverNameInput', 'TestServer');
            });

            it('MM-T4389_2 Name should not be marked invalid, but should not be able to save', async () => {
                await newServerView.waitForSelector('#customMessage_name.Input___error', {state: 'detached'});
                const disabled = await newServerView.getAttribute('#newServerModal_confirm', 'disabled');
                (disabled === '').should.be.true;
            });
        });

        describe('Valid server url', () => {
            beforeEach(async () => {
                await newServerView.type('#serverUrlInput', 'http://example.org');
            });

            it('MM-T4389_3 URL should not be marked invalid, name should be marked invalid', async () => {
                await newServerView.waitForSelector('#customMessage_name.Input___error');
                const existingUrl = await newServerView.isVisible('#customMessage_url.Input___error');
                const existingName = await newServerView.isVisible('#customMessage_name.Input___error');
                const disabled = await newServerView.getAttribute('#newServerModal_confirm', 'disabled');
                existingName.should.be.true;
                existingUrl.should.be.false;
                (disabled === '').should.be.true;
            });
        });
    });

    it('MM-T2826_1 should not be valid if an invalid server address has been set', async () => {
        await newServerView.type('#serverUrlInput', 'superInvalid url');
        await newServerView.waitForSelector('#customMessage_url.Input___error');
        const existing = await newServerView.isVisible('#customMessage_url.Input___error');
        existing.should.be.true;
    });

    describe('Valid Team Settings', () => {
        beforeEach(async () => {
            await newServerView.type('#serverUrlInput', 'http://example.org');
            await newServerView.type('#serverNameInput', 'TestServer');
            await newServerView.waitForSelector('#customMessage_url.Input___warning');
        });

        it('should be possible to click add', async () => {
            const disabled = await newServerView.getAttribute('#newServerModal_confirm', 'disabled');
            (disabled === null).should.be.true;
        });

        it('MM-T2826_2 should add the server to the config file', async () => {
            await newServerView.click('#newServerModal_confirm');
            await asyncSleep(2000);
            const existing = Boolean(this.app.windows().find((window) => window.url().includes('newServer')));
            existing.should.be.false;

            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            savedConfig.teams.should.deep.contain({
                name: 'TestServer',
                url: 'http://example.org/',
                order: 2,
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
});
