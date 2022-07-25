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
        await mainView.click('.TeamDropdownButton');
        await dropdownView.hover('.TeamDropdown .TeamDropdown__button:nth-child(1)');
        await dropdownView.click('.TeamDropdown .TeamDropdown__button:nth-child(1) button.TeamDropdown__button-edit');

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

    it('should not edit team when Cancel is pressed', async () => {
        await editServerView.click('#cancelNewServerModal');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
        existing.should.be.false;

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.teams.should.deep.contain({
            name: 'example',
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
                    isOpen: true,
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                    isOpen: true,
                },
            ],
            lastActiveTab: 0,
        });
    });

    it('MM-T4391_1 should not edit team when Save is pressed but nothing edited', async () => {
        await editServerView.click('#saveNewServerModal');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
        existing.should.be.false;

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.teams.should.deep.contain({
            name: 'example',
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
                    isOpen: true,
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                    isOpen: true,
                },
            ],
            lastActiveTab: 0,
        });
    });

    it('MM-T2826_3 should not edit team if an invalid server address has been set', async () => {
        await editServerView.type('#teamUrlInput', 'superInvalid url');
        await editServerView.click('#saveNewServerModal');
        const existing = await editServerView.isVisible('#teamUrlInput.is-invalid');
        existing.should.be.true;
    });

    it('should not edit team if another server with the same name or URL exists', async () => {
        await editServerView.fill('#teamNameInput', config.teams[1].name);
        await editServerView.click('#saveNewServerModal');
        let existing = await editServerView.isVisible('#teamNameInput.is-invalid');
        existing.should.be.true;

        await editServerView.fill('#teamNameInput', 'NewTestTeam');
        await editServerView.fill('#teamUrlInput', config.teams[1].url);
        existing = await editServerView.isVisible('#teamUrlInput.is-invalid');
        existing.should.be.true;
    });

    it('MM-T4391_2 should edit team when Save is pressed and name edited', async () => {
        await editServerView.fill('#teamNameInput', 'NewTestTeam');
        await editServerView.click('#saveNewServerModal');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
        existing.should.be.false;

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.teams.should.not.deep.contain({
            name: 'example',
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
                    isOpen: true,
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                    isOpen: true,
                },
            ],
            lastActiveTab: 0,
        });
        savedConfig.teams.should.deep.contain({
            name: 'NewTestTeam',
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
                    isOpen: true,
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                    isOpen: true,
                },
            ],
            lastActiveTab: 0,
        });
    });

    it('MM-T4391_3 should edit team when Save is pressed and URL edited', async () => {
        await editServerView.fill('#teamUrlInput', 'http://google.com');
        await editServerView.click('#saveNewServerModal');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
        existing.should.be.false;

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.teams.should.not.deep.contain({
            name: 'example',
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
                    isOpen: true,
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                    isOpen: true,
                },
            ],
            lastActiveTab: 0,
        });
        savedConfig.teams.should.deep.contain({
            name: 'example',
            url: 'http://google.com',
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
                    isOpen: true,
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                    isOpen: true,
                },
            ],
            lastActiveTab: 0,
        });
    });

    it('MM-T4391_4 should edit team when Save is pressed and both edited', async () => {
        await editServerView.fill('#teamNameInput', 'NewTestTeam');
        await editServerView.fill('#teamUrlInput', 'http://google.com');
        await editServerView.click('#saveNewServerModal');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
        existing.should.be.false;

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.teams.should.not.deep.contain({
            name: 'example',
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
                    isOpen: true,
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                    isOpen: true,
                },
            ],
            lastActiveTab: 0,
        });
        savedConfig.teams.should.deep.contain({
            name: 'NewTestTeam',
            url: 'http://google.com',
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
                    isOpen: true,
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                    isOpen: true,
                },
            ],
            lastActiveTab: 0,
        });
    });
});
