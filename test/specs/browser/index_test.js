// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

// const http = require('http');
// const path = require('path');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('renderer/index.html', function desc() {
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

    it('should set src of browser view from config file', async () => {
        const firstServer = this.app.windows().find((window) => window.url() === config.teams[0].url);
        const secondServer = this.app.windows().find((window) => window.url() === config.teams[1].url);

        firstServer.should.not.be.null;
        secondServer.should.not.be.null;
    });

    it('should set name of menu item from config file', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
        await mainWindow.click('.TeamDropdownButton');
        const firstMenuItem = await dropdownView.innerText('.TeamDropdown button.TeamDropdown__button:nth-child(1) span');
        const secondMenuItem = await dropdownView.innerText('.TeamDropdown button.TeamDropdown__button:nth-child(2) span');

        firstMenuItem.should.equal(config.teams[0].name);
        secondMenuItem.should.equal(config.teams[1].name);
    });

    it('should only show dropdown when button is clicked', async () => {
        const mainWindow = await this.app.firstWindow();
        const browserWindow = await this.app.browserWindow(mainWindow);
        const mainView = this.app.windows().find((window) => window.url().includes('index'));

        let dropdownHeight = await browserWindow.evaluate((window) => window.getBrowserViews().find((view) => view.webContents.getURL().includes('dropdown')).getBounds().height);
        dropdownHeight.should.equal(0);

        await mainView.click('.TeamDropdownButton');
        dropdownHeight = await browserWindow.evaluate((window) => window.getBrowserViews().find((view) => view.webContents.getURL().includes('dropdown')).getBounds().height);
        dropdownHeight.should.be.greaterThan(0);

        await mainView.click('.TabBar');
        dropdownHeight = await browserWindow.evaluate((window) => window.getBrowserViews().find((view) => view.webContents.getURL().includes('dropdown')).getBounds().height);
        dropdownHeight.should.equal(0);
    });

    it('should show only the selected team', async () => {
        const mainWindow = await this.app.firstWindow();
        const browserWindow = await this.app.browserWindow(mainWindow);

        let firstViewIsAttached = await browserWindow.evaluate((window, url) => Boolean(window.getBrowserViews().find((view) => view.webContents.getURL() === url)), env.mattermostURL);
        firstViewIsAttached.should.be.true;
        let secondViewIsAttached = await browserWindow.evaluate((window) => Boolean(window.getBrowserViews().find((view) => view.webContents.getURL() === 'https://github.com/')));
        secondViewIsAttached.should.be.false;

        const mainView = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
        await mainView.click('.TeamDropdownButton');
        await dropdownView.click('.TeamDropdown button.TeamDropdown__button:nth-child(2)');

        firstViewIsAttached = await browserWindow.evaluate((window, url) => Boolean(window.getBrowserViews().find((view) => view.webContents.getURL() === url)), env.mattermostURL);
        firstViewIsAttached.should.be.false;
        secondViewIsAttached = await browserWindow.evaluate((window) => Boolean(window.getBrowserViews().find((view) => view.webContents.getURL() === 'https://github.com/')));
        secondViewIsAttached.should.be.true;
    });

    it('should open the new server prompt after clicking the add button', async () => {
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
});
