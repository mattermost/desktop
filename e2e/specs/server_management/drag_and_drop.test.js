// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('server_management/drag_and_drop', function desc() {
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
        lastActiveTeam: 2,
    };

    const beforeFunc = async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
    };

    const afterFunc = async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    };

    this.timeout(30000);

    describe('MM-T2634 should be able to drag and drop servers in the dropdown menu', async () => {
        let mainWindow;
        let dropdownView;

        before(async () => {
            await beforeFunc();
            mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
            await mainWindow.click('.ServerDropdownButton');
        });
        after(afterFunc);

        it('MM-T2634_1 should appear the original order', async () => {
            const firstMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(1) .ServerDropdown__draggable-handle');
            const firstMenuItemText = await firstMenuItem.innerText();
            firstMenuItemText.should.equal('example');
            const secondMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(2) .ServerDropdown__draggable-handle');
            const secondMenuItemText = await secondMenuItem.innerText();
            secondMenuItemText.should.equal('github');
            const thirdMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(3) .ServerDropdown__draggable-handle');
            const thirdMenuItemText = await thirdMenuItem.innerText();
            thirdMenuItemText.should.equal('google');
        });

        it('MM-T2634_2 after dragging the server down, should appear in the new order', async () => {
            // Move the first server down, then re-open the dropdown
            const initialMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(1) .ServerDropdown__draggable-handle');
            await initialMenuItem.focus();
            await dropdownView.keyboard.down(' ');
            await dropdownView.keyboard.down('ArrowDown');
            await dropdownView.keyboard.down(' ');
            await asyncSleep(1000);
            await mainWindow.keyboard.press('Escape');
            await mainWindow.click('.ServerDropdownButton');

            // Verify that the new order persists
            const firstMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(1) .ServerDropdown__draggable-handle');
            const firstMenuItemText = await firstMenuItem.innerText();
            firstMenuItemText.should.equal('github');
            const secondMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(2) .ServerDropdown__draggable-handle');
            const secondMenuItemText = await secondMenuItem.innerText();
            secondMenuItemText.should.equal('example');
            const thirdMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(3) .ServerDropdown__draggable-handle');
            const thirdMenuItemText = await thirdMenuItem.innerText();
            thirdMenuItemText.should.equal('google');
        });

        it('MM-T2634_3 should update the config file', () => {
            // Verify config is updated
            const newConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
            const order0 = newConfig.teams.find((team) => team.name === 'github');
            order0.order.should.equal(0);
            const order1 = newConfig.teams.find((team) => team.name === 'example');
            order1.order.should.equal(1);
            const order2 = newConfig.teams.find((team) => team.name === 'google');
            order2.order.should.equal(2);
        });
    });

    describe('MM-T2635 should be able to drag and drop tabs', async () => {
        let mainWindow;
        before(async () => {
            await beforeFunc();
            mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        });
        after(afterFunc);

        it('MM-T2635_1 should be in the original order', async () => {
            // Verify the original order
            const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const firstTabText = await firstTab.innerText();
            firstTabText.should.equal('Channels');
            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
            const secondTabText = await secondTab.innerText();
            secondTabText.should.equal('Boards');
            const thirdTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)');
            const thirdTabText = await thirdTab.innerText();
            thirdTabText.should.equal('Playbooks');
        });

        it('MM-T2635_2 after moving the tab to the right, the tab should be in the new order', async () => {
            // Move the first tab to the right
            let firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            await firstTab.focus();
            await mainWindow.keyboard.down(' ');
            await mainWindow.keyboard.down('ArrowRight');
            await mainWindow.keyboard.down(' ');
            await asyncSleep(1000);

            // Verify that the new order is visible
            firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const firstTabText = await firstTab.innerText();
            firstTabText.should.equal('Boards');
            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
            const secondTabText = await secondTab.innerText();
            secondTabText.should.equal('Channels');
            const thirdTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)');
            const thirdTabText = await thirdTab.innerText();
            thirdTabText.should.equal('Playbooks');
        });

        it('MM-T2635_3 should update the config file', () => {
            // Verify config is updated
            const newConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
            const firstTeam = newConfig.teams.find((team) => team.name === 'google');
            const order0 = firstTeam.tabs.find((tab) => tab.name === 'TAB_FOCALBOARD');
            order0.order.should.equal(0);
            const order1 = firstTeam.tabs.find((tab) => tab.name === 'TAB_MESSAGING');
            order1.order.should.equal(1);
            const order2 = firstTeam.tabs.find((tab) => tab.name === 'TAB_PLAYBOOKS');
            order2.order.should.equal(2);
        });
    });
});
