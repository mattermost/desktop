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
        await mainView.click('.TeamDropdownButton');
        await dropdownView.click('.TeamDropdown .TeamDropdown__button.addServer');
        newServerView = await this.app.waitForEvent('window', {
            predicate: (window) => window.url().includes('newServer'),
        });

        // wait for autofocus to finish
        await asyncSleep(500);
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
    });

    let newServerView;

    it('MM-T1312 should focus the first text input', async () => {
        const isFocused = await newServerView.$eval('#teamNameInput', (el) => el === document.activeElement);
        isFocused.should.be.true;
    });

    it('MM-T4388 should close the window after clicking cancel', async () => {
        await newServerView.click('#cancelNewServerModal');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('newServer')));
        existing.should.be.false;
    });

    describe('MM-T4389 Invalid messages', () => {
        it('MM-T4389_1 should not be valid if no team name has been set', async () => {
            await newServerView.click('#saveNewServerModal');
            const existing = await newServerView.isVisible('#teamNameInput.is-invalid');
            existing.should.be.true;
        });

        it('MM-T4389_2 should not be valid if no server address has been set', async () => {
            await newServerView.click('#saveNewServerModal');
            const existing = await newServerView.isVisible('#teamUrlInput.is-invalid');
            existing.should.be.true;
        });

        it('should not be valid if a server with the same name exists', async () => {
            await newServerView.type('#teamNameInput', config.teams[0].name);
            await newServerView.type('#teamUrlInput', 'http://example.org');
            await newServerView.click('#saveNewServerModal');
            const existing = await newServerView.isVisible('#teamNameInput.is-invalid');
            existing.should.be.true;
        });

        it('should not be valid if a server with the same URL exists', async () => {
            await newServerView.type('#teamNameInput', 'some-new-server');
            await newServerView.type('#teamUrlInput', config.teams[0].url);
            await newServerView.click('#saveNewServerModal');
            const existing = await newServerView.isVisible('#teamUrlInput.is-invalid');
            existing.should.be.true;
        });

        describe('Valid server name', async () => {
            beforeEach(async () => {
                await newServerView.type('#teamNameInput', 'TestTeam');
                await newServerView.click('#saveNewServerModal');
            });

            it('MM-T4389_3 should not be marked invalid', async () => {
                const existing = await newServerView.isVisible('#teamNameInput.is-invalid');
                existing.should.be.false;
            });

            it('MM-T4389_4 should not be possible to click save', async () => {
                const disabled = await newServerView.getAttribute('#saveNewServerModal', 'disabled');
                (disabled === '').should.be.true;
            });
        });

        describe('Valid server url', () => {
            beforeEach(async () => {
                await newServerView.type('#teamUrlInput', 'http://example.org');
                await newServerView.click('#saveNewServerModal');
            });

            it('MM-T4389_5 should be valid', async () => {
                const existing = await newServerView.isVisible('#teamUrlInput.is-invalid');
                existing.should.be.false;
            });

            it('MM-T4389_6 should not be possible to click save', async () => {
                const disabled = await newServerView.getAttribute('#saveNewServerModal', 'disabled');
                (disabled === '').should.be.true;
            });
        });
    });

    it('MM-T2826_1 should not be valid if an invalid server address has been set', async () => {
        await newServerView.type('#teamUrlInput', 'superInvalid url');
        await newServerView.click('#saveNewServerModal');
        const existing = await newServerView.isVisible('#teamUrlInput.is-invalid');
        existing.should.be.true;
    });

    describe('Valid Team Settings', () => {
        beforeEach(async () => {
            await newServerView.type('#teamUrlInput', 'http://example.org');
            await newServerView.type('#teamNameInput', 'TestTeam');
        });

        it('should be possible to click add', async () => {
            const disabled = await newServerView.getAttribute('#saveNewServerModal', 'disabled');
            (disabled === null).should.be.true;
        });

        it('MM-T2826_2 should add the team to the config file', async () => {
            await newServerView.click('#saveNewServerModal');
            await asyncSleep(1000);
            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('newServer')));
            existing.should.be.false;

            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            savedConfig.teams.should.deep.contain({
                name: 'TestTeam',
                url: 'http://example.org',
                order: 2,
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
