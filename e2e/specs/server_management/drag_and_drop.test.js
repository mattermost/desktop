// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('server_management/drag_and_drop', function desc() {
    this.timeout(30000);

    const config = {
        ...env.demoConfig,
        teams: [
            ...env.demoConfig.teams,
            {
                name: 'google',
                url: 'https://google.com/',
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
                        isOpen: true,
                    },
                    {
                        name: 'TAB_PLAYBOOKS',
                        order: 2,
                        isOpen: true,
                    },
                ],
                lastActiveTab: 0,
            },
        ],
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
        await env.clearElectronInstances();
    });

    it('MM-T2634 should be able to drag and drop servers in the dropdown menu', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
        await mainWindow.click('.TeamDropdownButton');

        // Verify the original order
        let firstMenuItem = await dropdownView.waitForSelector('.TeamDropdown button.TeamDropdown__button:nth-child(1) .TeamDropdown__draggable-handle');
        let firstMenuItemText = await firstMenuItem.innerText();
        firstMenuItemText.should.equal('example');
        let secondMenuItem = await dropdownView.waitForSelector('.TeamDropdown button.TeamDropdown__button:nth-child(2) .TeamDropdown__draggable-handle');
        let secondMenuItemText = await secondMenuItem.innerText();
        secondMenuItemText.should.equal('github');
        let thirdMenuItem = await dropdownView.waitForSelector('.TeamDropdown button.TeamDropdown__button:nth-child(3) .TeamDropdown__draggable-handle');
        let thirdMenuItemText = await thirdMenuItem.innerText();
        thirdMenuItemText.should.equal('google');

        // Move the first server down, then re-open the dropdown
        await firstMenuItem.focus();
        await dropdownView.keyboard.down(' ');
        await dropdownView.keyboard.down('ArrowDown');
        await dropdownView.keyboard.down(' ');
        await asyncSleep(1000);
        await mainWindow.keyboard.press('Escape');
        await mainWindow.click('.TeamDropdownButton');

        // Verify that the new order persists
        firstMenuItem = await dropdownView.waitForSelector('.TeamDropdown button.TeamDropdown__button:nth-child(1) .TeamDropdown__draggable-handle');
        firstMenuItemText = await firstMenuItem.innerText();
        firstMenuItemText.should.equal('github');
        secondMenuItem = await dropdownView.waitForSelector('.TeamDropdown button.TeamDropdown__button:nth-child(2) .TeamDropdown__draggable-handle');
        secondMenuItemText = await secondMenuItem.innerText();
        secondMenuItemText.should.equal('example');
        thirdMenuItem = await dropdownView.waitForSelector('.TeamDropdown button.TeamDropdown__button:nth-child(3) .TeamDropdown__draggable-handle');
        thirdMenuItemText = await thirdMenuItem.innerText();
        thirdMenuItemText.should.equal('google');

        // Verify config is updated
        const newConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
        const order0 = newConfig.teams.find((team) => team.name === 'github');
        order0.order.should.equal(0);
        const order1 = newConfig.teams.find((team) => team.name === 'example');
        order1.order.should.equal(1);
        const order2 = newConfig.teams.find((team) => team.name === 'google');
        order2.order.should.equal(2);
    });

    it('MM-T2635 should be able to drag and drop tabs', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));

        // Verify the original order
        let firstTab = await mainWindow.waitForSelector('.TabBar li.teamTabItem:nth-child(1)');
        let firstTabText = await firstTab.innerText();
        firstTabText.should.equal('Channels');
        let secondTab = await mainWindow.waitForSelector('.TabBar li.teamTabItem:nth-child(2)');
        let secondTabText = await secondTab.innerText();
        secondTabText.should.equal('Boards');
        let thirdTab = await mainWindow.waitForSelector('.TabBar li.teamTabItem:nth-child(3)');
        let thirdTabText = await thirdTab.innerText();
        thirdTabText.should.equal('Playbooks');

        // Move the first tab to the right
        await firstTab.focus();
        await mainWindow.keyboard.down(' ');
        await mainWindow.keyboard.down('ArrowRight');
        await mainWindow.keyboard.down(' ');
        await asyncSleep(1000);

        // Verify that the new order is visible
        firstTab = await mainWindow.waitForSelector('.TabBar li.teamTabItem:nth-child(1)');
        firstTabText = await firstTab.innerText();
        firstTabText.should.equal('Boards');
        secondTab = await mainWindow.waitForSelector('.TabBar li.teamTabItem:nth-child(2)');
        secondTabText = await secondTab.innerText();
        secondTabText.should.equal('Channels');
        thirdTab = await mainWindow.waitForSelector('.TabBar li.teamTabItem:nth-child(3)');
        thirdTabText = await thirdTab.innerText();
        thirdTabText.should.equal('Playbooks');

        // Verify config is updated
        const newConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
        const firstTeam = newConfig.teams.find((team) => team.name === 'example');
        const order0 = firstTeam.tabs.find((tab) => tab.name === 'TAB_FOCALBOARD');
        order0.order.should.equal(0);
        const order1 = firstTeam.tabs.find((tab) => tab.name === 'TAB_MESSAGING');
        order1.order.should.equal(1);
        const order2 = firstTeam.tabs.find((tab) => tab.name === 'TAB_PLAYBOOKS');
        order2.order.should.equal(2);
    });
});
