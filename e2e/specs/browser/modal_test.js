// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('modals', function desc() {
    this.timeout(30000);

    const config = {
        version: 3,
        teams: [{
            name: 'example',
            url: env.mattermostURL,
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
        }, {
            name: 'github',
            url: 'https://github.com/',
            order: 1,
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
        }],
        showTrayIcon: false,
        trayIconTheme: 'light',
        minimizeToTray: false,
        notifications: {
            flashWindow: 0,
            bounceIcon: false,
            bounceIconType: 'informational',
        },
        showUnreadBadge: true,
        useSpellChecker: true,
        enableHardwareAcceleration: true,
        autostart: true,
        darkMode: false,
        lastActiveTeam: 0,
        spellCheckerLocales: [],
    };

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
    });

    describe('RemoveServerModal', () => {
        let removeServerView;

        beforeEach(async () => {
            const mainView = this.app.windows().find((window) => window.url().includes('index'));
            const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
            await mainView.click('.TeamDropdownButton');
            await dropdownView.hover('.TeamDropdown .TeamDropdown__button:nth-child(1)');
            await dropdownView.click('.TeamDropdown .TeamDropdown__button:nth-child(1) button.TeamDropdown__button-remove');

            removeServerView = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('removeServer'),
            });
        });

        it('should remove existing team on click Remove', async () => {
            await removeServerView.click('button:has-text("Remove")');
            await asyncSleep(1000);

            const expectedConfig = JSON.parse(JSON.stringify(config.teams.slice(1)));
            expectedConfig.forEach((value) => {
                value.order--;
            });

            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            savedConfig.teams.should.deep.equal(expectedConfig);
        });

        it('should NOT remove existing team on click Cancel', async () => {
            await removeServerView.click('button:has-text("Cancel")');
            await asyncSleep(1000);

            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            savedConfig.teams.should.deep.equal(config.teams);
        });

        it('should disappear on click Close', async () => {
            await removeServerView.click('button.close');
            await asyncSleep(1000);
            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('removeServer')));
            existing.should.be.false;
        });

        it('should disappear on click background', async () => {
            await removeServerView.click('.modal', {position: {x: 20, y: 20}});
            await asyncSleep(1000);
            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('removeServer')));
            existing.should.be.false;
        });
    });

    describe('NewTeamModal', () => {
        let newServerView;

        beforeEach(async () => {
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

        it('should open the new server modal', async () => {
            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('newServer')));
            existing.should.be.true;
        });

        it('should focus the first text input', async () => {
            const isFocused = await newServerView.$eval('#teamNameInput', (el) => el === document.activeElement);
            isFocused.should.be.true;
        });

        it('should close the window after clicking cancel', async () => {
            await newServerView.click('#cancelNewServerModal');
            await asyncSleep(1000);
            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('newServer')));
            existing.should.be.false;
        });

        it('should not be valid if no team name has been set', async () => {
            await newServerView.click('#saveNewServerModal');
            const existing = await newServerView.isVisible('#teamNameInput.is-invalid');
            existing.should.be.true;
        });

        it('should not be valid if no server address has been set', async () => {
            await newServerView.click('#saveNewServerModal');
            const existing = await newServerView.isVisible('#teamUrlInput.is-invalid');
            existing.should.be.true;
        });

        describe('Valid server name', async () => {
            beforeEach(async () => {
                await newServerView.type('#teamNameInput', 'TestTeam');
                await newServerView.click('#saveNewServerModal');
            });

            it('should not be marked invalid', async () => {
                const existing = await newServerView.isVisible('#teamNameInput.is-invalid');
                existing.should.be.false;
            });

            it('should not be possible to click save', async () => {
                const disabled = await newServerView.getAttribute('#saveNewServerModal', 'disabled');
                (disabled === '').should.be.true;
            });
        });

        describe('Valid server url', () => {
            beforeEach(async () => {
                await newServerView.type('#teamUrlInput', 'http://example.org');
                await newServerView.click('#saveNewServerModal');
            });

            it('should be valid', async () => {
                const existing = await newServerView.isVisible('#teamUrlInput.is-invalid');
                existing.should.be.false;
            });

            it('should not be possible to click save', async () => {
                const disabled = await newServerView.getAttribute('#saveNewServerModal', 'disabled');
                (disabled === '').should.be.true;
            });
        });

        it('should not be valid if an invalid server address has been set', async () => {
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

            it('should add the team to the config file', async () => {
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
                    lastActiveTab: 0,
                });
            });
        });
    });

    describe('EditServerModal', () => {
        let editServerView;

        beforeEach(async () => {
            const mainView = this.app.windows().find((window) => window.url().includes('index'));
            const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
            await mainView.click('.TeamDropdownButton');
            await dropdownView.hover('.TeamDropdown .TeamDropdown__button:nth-child(1)');
            await dropdownView.click('.TeamDropdown .TeamDropdown__button:nth-child(1) button.TeamDropdown__button-edit');

            editServerView = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('editServer'),
            });
        });

        it('should not edit team when Cancel is pressed', async () => {
            await editServerView.click('#cancelNewServerModal');
            await asyncSleep(1000);
            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
            existing.should.be.false;

            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            savedConfig.teams.should.deep.contain({
                name: 'example',
                url: env.mattermostURL,
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

        it('should not edit team when Save is pressed but nothing edited', async () => {
            await editServerView.click('#saveNewServerModal');
            await asyncSleep(1000);
            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
            existing.should.be.false;

            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            savedConfig.teams.should.deep.contain({
                name: 'example',
                url: env.mattermostURL,
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

        it('should edit team when Save is pressed and name edited', async () => {
            await editServerView.fill('#teamNameInput', 'NewTestTeam');
            await editServerView.click('#saveNewServerModal');
            await asyncSleep(1000);
            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
            existing.should.be.false;

            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            savedConfig.teams.should.not.deep.contain({
                name: 'example',
                url: env.mattermostURL,
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
                url: env.mattermostURL,
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

        it('should edit team when Save is pressed and URL edited', async () => {
            await editServerView.fill('#teamUrlInput', 'http://google.com');
            await editServerView.click('#saveNewServerModal');
            await asyncSleep(1000);
            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
            existing.should.be.false;

            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            savedConfig.teams.should.not.deep.contain({
                name: 'example',
                url: env.mattermostURL,
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

        it('should edit team when Save is pressed and both edited', async () => {
            await editServerView.fill('#teamNameInput', 'NewTestTeam');
            await editServerView.fill('#teamUrlInput', 'http://google.com');
            await editServerView.click('#saveNewServerModal');
            await asyncSleep(1000);
            const existing = Boolean(await this.app.windows().find((window) => window.url().includes('editServer')));
            existing.should.be.false;

            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            savedConfig.teams.should.not.deep.contain({
                name: 'example',
                url: env.mattermostURL,
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
});
