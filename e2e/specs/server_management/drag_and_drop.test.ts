// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoMattermostConfig, writeConfigFile} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

if (!process.env.MM_TEST_SERVER_URL) {
    test.skip(true, 'MM_TEST_SERVER_URL required');
}

const config = {
    ...demoMattermostConfig,
    servers: [
        ...demoMattermostConfig.servers,
        {
            name: 'google',
            url: 'https://google.com/',
            order: 2,
        },
    ],
    lastActiveServer: 0,
};

test.describe('server_management/drag_and_drop', () => {
    test.describe('MM-T2635 should be able to drag and drop tabs', () => {
        test('MM-T2635_1 should be in the original order', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {mkdirSync} = await import('fs');
            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, config);
            const {_electron: electron} = await import('playwright');
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });
            try {
                await waitForAppReady(app);
                const serverMap = await buildServerMap(app);
                const mmServer = serverMap[config.servers[0].name][0].win;
                await loginToMattermost(mmServer);
                const mainWindow = app.windows().find((w) => w.url().includes('index'))!;

                await mainWindow.click('#newTabButton');
                await mainWindow.click('#newTabButton');

                await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15000});
                await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 15000});

                const serverName = config.servers[0].name;
                let updatedServerMap = await buildServerMap(app);
                if (!updatedServerMap[serverName] || updatedServerMap[serverName].length < 3) {
                    updatedServerMap = await buildServerMap(app);
                }

                const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 10000});
                await secondTab.click();
                const secondView = updatedServerMap[serverName][1].win;
                await secondView.waitForSelector('#sidebarItem_off-topic', {timeout: 15000});
                await secondView.click('#sidebarItem_off-topic');

                const thirdTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 10000});
                await thirdTab.click();
                const thirdView = updatedServerMap[serverName][2].win;
                await thirdView.waitForSelector('#sidebarItem_town-square', {timeout: 15000});
                await thirdView.click('#sidebarItem_town-square');

                const firstTabEl = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
                const firstTabText = await firstTabEl.innerText();
                expect(firstTabText).toContain('Town Square');
                const secondTabEl = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
                const secondTabText = await secondTabEl.innerText();
                expect(secondTabText).toContain('Off-Topic');
                const thirdTabEl = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)');
                const thirdTabText = await thirdTabEl.innerText();
                expect(thirdTabText).toContain('Town Square');
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test('MM-T2635_2 after moving the tab to the right, the tab should be in the new order', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {mkdirSync} = await import('fs');
            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, config);
            const {_electron: electron} = await import('playwright');
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });
            try {
                await waitForAppReady(app);
                const serverMap = await buildServerMap(app);
                const mmServer = serverMap[config.servers[0].name][0].win;
                await loginToMattermost(mmServer);
                const mainWindow = app.windows().find((w) => w.url().includes('index'))!;

                await mainWindow.click('#newTabButton');
                await mainWindow.click('#newTabButton');

                await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15000});
                await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 15000});

                const serverName = config.servers[0].name;
                let updatedServerMap = await buildServerMap(app);
                if (!updatedServerMap[serverName] || updatedServerMap[serverName].length < 3) {
                    updatedServerMap = await buildServerMap(app);
                }

                const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 10000});
                await secondTab.click();
                const secondView = updatedServerMap[serverName][1].win;
                await secondView.waitForSelector('#sidebarItem_off-topic', {timeout: 15000});
                await secondView.click('#sidebarItem_off-topic');

                const thirdTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 10000});
                await thirdTab.click();
                const thirdView = updatedServerMap[serverName][2].win;
                await thirdView.waitForSelector('#sidebarItem_town-square', {timeout: 15000});
                await thirdView.click('#sidebarItem_town-square');

                // Move first tab to the right
                let firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
                await firstTab.focus();
                await mainWindow.keyboard.press(' ');
                await mainWindow.keyboard.press('ArrowRight');
                await mainWindow.keyboard.press(' ');

                firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
                const firstTabText = await firstTab.innerText();
                expect(firstTabText).toContain('Off-Topic');
                const secondTabEl = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
                const secondTabText = await secondTabEl.innerText();
                expect(secondTabText).toContain('Town Square');
                const thirdTabEl = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)');
                const thirdTabText = await thirdTabEl.innerText();
                expect(thirdTabText).toContain('Town Square');
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });
    });

    test.describe('MM-T2634 should be able to drag and drop servers in the dropdown menu', () => {
        test('MM-T2634_1 should appear the original order', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {mkdirSync} = await import('fs');
            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, config);
            const {_electron: electron} = await import('playwright');
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });
            try {
                await waitForAppReady(app);
                const mainWindow = app.windows().find((w) => w.url().includes('index'))!;
                const dropdownView = app.windows().find((w) => w.url().includes('dropdown'))!;
                await mainWindow.click('.ServerDropdownButton');

                const firstMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(1) .ServerDropdown__draggable-handle');
                const firstMenuItemText = await firstMenuItem.innerText();
                expect(firstMenuItemText).toBe('example');
                const secondMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(2) .ServerDropdown__draggable-handle');
                const secondMenuItemText = await secondMenuItem.innerText();
                expect(secondMenuItemText).toBe('github');
                const thirdMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(3) .ServerDropdown__draggable-handle');
                const thirdMenuItemText = await thirdMenuItem.innerText();
                expect(thirdMenuItemText).toBe('google');
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test('MM-T2634_2 after dragging the server down, should appear in the new order', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {mkdirSync} = await import('fs');
            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, config);
            const {_electron: electron} = await import('playwright');
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });
            try {
                await waitForAppReady(app);
                const mainWindow = app.windows().find((w) => w.url().includes('index'))!;
                const dropdownView = app.windows().find((w) => w.url().includes('dropdown'))!;
                await mainWindow.click('.ServerDropdownButton');

                const initialMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(1) .ServerDropdown__draggable-handle');
                await initialMenuItem.focus();
                await dropdownView.keyboard.press(' ');
                await dropdownView.keyboard.press('ArrowDown');
                await dropdownView.keyboard.press(' ');

                await mainWindow.keyboard.press('Escape');
                await mainWindow.click('.ServerDropdownButton');

                const firstMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(1) .ServerDropdown__draggable-handle');
                const firstMenuItemText = await firstMenuItem.innerText();
                expect(firstMenuItemText).toBe('github');
                const secondMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(2) .ServerDropdown__draggable-handle');
                const secondMenuItemText = await secondMenuItem.innerText();
                expect(secondMenuItemText).toBe('example');
                const thirdMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(3) .ServerDropdown__draggable-handle');
                const thirdMenuItemText = await thirdMenuItem.innerText();
                expect(thirdMenuItemText).toBe('google');
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test('MM-T2634_3 should update the config file', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {mkdirSync} = await import('fs');
            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, config);
            const {_electron: electron} = await import('playwright');
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });
            try {
                await waitForAppReady(app);
                const mainWindow = app.windows().find((w) => w.url().includes('index'))!;
                const dropdownView = app.windows().find((w) => w.url().includes('dropdown'))!;
                await mainWindow.click('.ServerDropdownButton');

                const initialMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(1) .ServerDropdown__draggable-handle');
                await initialMenuItem.focus();
                await dropdownView.keyboard.press(' ');
                await dropdownView.keyboard.press('ArrowDown');
                await dropdownView.keyboard.press(' ');

                // Wait for config to be written
                const configPath = path.join(userDataDir, 'config.json');
                await expect.poll(() => {
                    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    const order0 = cfg.servers.find((s: {name: string}) => s.name === 'github');
                    return order0?.order;
                }, {timeout: 10000}).toBe(0);

                const newConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                const order0 = newConfig.servers.find((s: {name: string; order: number}) => s.name === 'github');
                expect(order0.order).toBe(0);
                const order1 = newConfig.servers.find((s: {name: string; order: number}) => s.name === 'example');
                expect(order1.order).toBe(1);
                const order2 = newConfig.servers.find((s: {name: string; order: number}) => s.name === 'google');
                expect(order2.order).toBe(2);
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });
    });
});
