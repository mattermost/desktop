// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('menu_bar/dropdown', function desc() {
    this.timeout(30000);

    const config = env.demoConfig;

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
        await env.clearElectronInstances();
    });

    it('MM-T4405 should set name of menu item from config file', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
        await mainWindow.click('.TeamDropdownButton');
        const firstMenuItem = await dropdownView.innerText('.TeamDropdown button.TeamDropdown__button:nth-child(1) span');
        const secondMenuItem = await dropdownView.innerText('.TeamDropdown button.TeamDropdown__button:nth-child(2) span');

        firstMenuItem.should.equal(config.teams[0].name);
        secondMenuItem.should.equal(config.teams[1].name);
    });

    it('MM-T4406 should only show dropdown when button is clicked', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const browserWindow = await this.app.browserWindow(mainWindow);

        let dropdownHeight = await browserWindow.evaluate((window) => window.getBrowserViews().find((view) => view.webContents.getURL().includes('dropdown')).getBounds().height);
        dropdownHeight.should.equal(0);

        await mainWindow.click('.TeamDropdownButton');
        dropdownHeight = await browserWindow.evaluate((window) => window.getBrowserViews().find((view) => view.webContents.getURL().includes('dropdown')).getBounds().height);
        dropdownHeight.should.be.greaterThan(0);

        await mainWindow.click('.TabBar');
        dropdownHeight = await browserWindow.evaluate((window) => window.getBrowserViews().find((view) => view.webContents.getURL().includes('dropdown')).getBounds().height);
        dropdownHeight.should.equal(0);
    });

    it('MM-T4407 should open the new server prompt after clicking the add button', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
        await mainWindow.click('.TeamDropdownButton');
        await dropdownView.click('.TeamDropdown__button.addServer');

        const newServerModal = await this.app.waitForEvent('window', {
            predicate: (window) => window.url().includes('newServer'),
        });
        const modalTitle = await newServerModal.innerText('#newServerModal .modal-title');
        modalTitle.should.equal('Add Server');
    });

    it('MM-T4408 should show only the selected team', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const browserWindow = await this.app.browserWindow(mainWindow);

        let firstViewIsAttached = await browserWindow.evaluate((window, url) => Boolean(window.getBrowserViews().find((view) => view.webContents.getURL() === url)), env.exampleURL);
        firstViewIsAttached.should.be.true;
        let secondViewIsAttached = await browserWindow.evaluate((window) => Boolean(window.getBrowserViews().find((view) => view.webContents.getURL() === 'https://github.com/')));
        secondViewIsAttached.should.be.false;

        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
        await mainWindow.click('.TeamDropdownButton');
        await dropdownView.click('.TeamDropdown button.TeamDropdown__button:nth-child(2)');

        firstViewIsAttached = await browserWindow.evaluate((window, url) => Boolean(window.getBrowserViews().find((view) => view.webContents.getURL() === url)), env.exampleURL);
        firstViewIsAttached.should.be.false;
        secondViewIsAttached = await browserWindow.evaluate((window) => Boolean(window.getBrowserViews().find((view) => view.webContents.getURL() === 'https://github.com/')));
        secondViewIsAttached.should.be.true;
    });
});
