// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {electronBinaryPath, appDir, demoMattermostConfig, writeConfigFile, cmdOrCtrl} from '../../helpers/config';
import {waitForAppReady} from '../../helpers/appReadiness';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

const windowMenuConfig = {
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
    minimizeToTray: true,
    alwaysMinimize: true,
};

test.describe('Menu/window_menu', () => {
    test.describe('MM-T826 should switch to servers when keyboard shortcuts are pressed', () => {
        test('MM-T826_1 should show the second server', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            const {mkdirSync} = await import('fs');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, windowMenuConfig as any);
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });
            try {
                await waitForAppReady(app);
                const serverMap = await buildServerMap(app);
                const mmServer = serverMap[windowMenuConfig.servers[0].name][0].win;
                await loginToMattermost(mmServer);
                const mainWindow = app.windows().find((window) => window.url().includes('index'))!;

                let dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton');
                expect(dropdownButtonText).toContain('example');

                await mainWindow.keyboard.press(process.platform === 'darwin' ? 'Meta+Control+2' : 'Control+Shift+2');
                dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton:has-text("github")');
                expect(dropdownButtonText).toContain('github');
            } finally {
                await app.close();
            }
        });

        test('MM-T826_2 should show the third server', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            const {mkdirSync} = await import('fs');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, windowMenuConfig as any);
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });
            try {
                await waitForAppReady(app);
                const serverMap = await buildServerMap(app);
                const mmServer = serverMap[windowMenuConfig.servers[0].name][0].win;
                await loginToMattermost(mmServer);
                const mainWindow = app.windows().find((window) => window.url().includes('index'))!;

                // Switch to second then third
                await mainWindow.keyboard.press(process.platform === 'darwin' ? 'Meta+Control+2' : 'Control+Shift+2');
                await mainWindow.keyboard.press(process.platform === 'darwin' ? 'Meta+Control+3' : 'Control+Shift+3');
                const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton:has-text("google")');
                expect(dropdownButtonText).toContain('google');
            } finally {
                await app.close();
            }
        });

        test('MM-T826_3 should show the first server', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            const {mkdirSync} = await import('fs');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, windowMenuConfig as any);
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });
            try {
                await waitForAppReady(app);
                const serverMap = await buildServerMap(app);
                const mmServer = serverMap[windowMenuConfig.servers[0].name][0].win;
                await loginToMattermost(mmServer);
                const mainWindow = app.windows().find((window) => window.url().includes('index'))!;

                // Switch to second then back to first
                await mainWindow.keyboard.press(process.platform === 'darwin' ? 'Meta+Control+2' : 'Control+Shift+2');
                await mainWindow.keyboard.press(process.platform === 'darwin' ? 'Meta+Control+1' : 'Control+Shift+1');
                const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton:has-text("example")');
                expect(dropdownButtonText).toContain('example');
            } finally {
                await app.close();
            }
        });
    });

    test.describe('MM-T4385 select tab from menu', () => {
        test('MM-T4385_1 should show the second tab', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            const {mkdirSync} = await import('fs');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, windowMenuConfig as any);
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });
            try {
                await waitForAppReady(app);
                const serverMap = await buildServerMap(app);
                const mmServer = serverMap[windowMenuConfig.servers[0].name][0].win;
                await loginToMattermost(mmServer);
                const mainView = app.windows().find((window) => window.url().includes('index'))!;

                await mainView.click('#newTabButton');
                await mainView.click('#newTabButton');

                const updatedServerMap = await buildServerMap(app);

                const secondTab = await mainView.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15000});
                await secondTab.click();
                const secondView = updatedServerMap[windowMenuConfig.servers[0].name][1].win;
                await secondView.waitForSelector('#sidebarItem_off-topic', {timeout: 15000});
                await secondView.click('#sidebarItem_off-topic');

                const thirdTab = await mainView.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 15000});
                await thirdTab.click();
                const thirdView = updatedServerMap[windowMenuConfig.servers[0].name][2].win;
                await thirdView.waitForSelector('#sidebarItem_town-square', {timeout: 15000});
                await thirdView.click('#sidebarItem_town-square');

                let tabViewButton = await mainView.innerText('.active');
                expect(tabViewButton).toContain('Town Square');

                await mainView.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+2`);
                tabViewButton = await mainView.innerText('.active');
                expect(tabViewButton).toContain('Off-Topic');
            } finally {
                await app.close();
            }
        });

        test('MM-T4385_2 should show the third tab', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            const {mkdirSync} = await import('fs');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, windowMenuConfig as any);
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });
            try {
                await waitForAppReady(app);
                const serverMap = await buildServerMap(app);
                const mmServer = serverMap[windowMenuConfig.servers[0].name][0].win;
                await loginToMattermost(mmServer);
                const mainView = app.windows().find((window) => window.url().includes('index'))!;

                await mainView.click('#newTabButton');
                await mainView.click('#newTabButton');

                const updatedServerMap = await buildServerMap(app);

                const secondTab = await mainView.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15000});
                await secondTab.click();
                const secondView = updatedServerMap[windowMenuConfig.servers[0].name][1].win;
                await secondView.waitForSelector('#sidebarItem_off-topic', {timeout: 15000});
                await secondView.click('#sidebarItem_off-topic');

                const thirdTab = await mainView.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 15000});
                await thirdTab.click();
                const thirdView = updatedServerMap[windowMenuConfig.servers[0].name][2].win;
                await thirdView.waitForSelector('#sidebarItem_town-square', {timeout: 15000});
                await thirdView.click('#sidebarItem_town-square');

                // Switch to second tab first, then third
                await mainView.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+2`);
                await mainView.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+3`);
                const tabViewButton = await mainView.innerText('.active');
                expect(tabViewButton).toContain('Town Square');
            } finally {
                await app.close();
            }
        });

        test('MM-T4385_3 should show the first tab', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            const {mkdirSync} = await import('fs');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, windowMenuConfig as any);
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });
            try {
                await waitForAppReady(app);
                const serverMap = await buildServerMap(app);
                const mmServer = serverMap[windowMenuConfig.servers[0].name][0].win;
                await loginToMattermost(mmServer);
                const mainView = app.windows().find((window) => window.url().includes('index'))!;

                await mainView.click('#newTabButton');
                await mainView.click('#newTabButton');

                const updatedServerMap = await buildServerMap(app);

                const secondTab = await mainView.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15000});
                await secondTab.click();
                const secondView = updatedServerMap[windowMenuConfig.servers[0].name][1].win;
                await secondView.waitForSelector('#sidebarItem_off-topic', {timeout: 15000});
                await secondView.click('#sidebarItem_off-topic');

                const thirdTab = await mainView.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 15000});
                await thirdTab.click();
                const thirdView = updatedServerMap[windowMenuConfig.servers[0].name][2].win;
                await thirdView.waitForSelector('#sidebarItem_town-square', {timeout: 15000});
                await thirdView.click('#sidebarItem_town-square');

                // Switch to second, then back to first
                await mainView.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+2`);
                await mainView.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+1`);
                const tabViewButton = await mainView.innerText('.active');
                expect(tabViewButton).toContain('Town Square');
            } finally {
                await app.close();
            }
        });
    });

    test('MM-T827 select next/previous tab', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
        const {mkdirSync} = await import('fs');
        mkdirSync(userDataDir, {recursive: true});
        writeConfigFile(userDataDir, windowMenuConfig as any);
        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });
        try {
            await waitForAppReady(app);
            const serverMap = await buildServerMap(app);
            const mmServer = serverMap[windowMenuConfig.servers[0].name][0].win;
            await loginToMattermost(mmServer);
            const mainView = app.windows().find((window) => window.url().includes('index'))!;

            await mainView.click('#newTabButton');
            const updatedServerMap = await buildServerMap(app);

            const secondTab = await mainView.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
            await secondTab.click();
            const secondView = updatedServerMap[windowMenuConfig.servers[0].name][1].win;
            await secondView.waitForSelector('#sidebarItem_off-topic', {timeout: 10000});
            await secondView.click('#sidebarItem_off-topic', {force: true});

            let tabViewButton = await mainView.innerText('.active');
            expect(tabViewButton).toContain('Off-Topic');

            await mainView.keyboard.press('Control+Tab');
            tabViewButton = await mainView.innerText('.active');
            expect(tabViewButton).toContain('Town Square');

            await mainView.keyboard.press('Control+Shift+Tab');
            tabViewButton = await mainView.innerText('.active');
            expect(tabViewButton).toContain('Off-Topic');
        } finally {
            await app.close();
        }
    });

    test('MM-T824 should be minimized when keyboard shortcuts are pressed', {tag: ['@P2', '@darwin', '@win32']}, async ({}, testInfo) => {
        if (process.platform === 'linux') {
            test.skip(true, 'Linux not supported');
            return;
        }
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
        const {mkdirSync} = await import('fs');
        mkdirSync(userDataDir, {recursive: true});
        writeConfigFile(userDataDir, windowMenuConfig as any);
        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });
        try {
            await waitForAppReady(app);
            const serverMap = await buildServerMap(app);
            const mmServer = serverMap[windowMenuConfig.servers[0].name][0].win;
            await loginToMattermost(mmServer);
            const mainWindow = app.windows().find((window) => window.url().includes('index'))!;
            const browserWindow = await app.browserWindow(mainWindow);

            if (process.platform === 'darwin') {
                await mainWindow.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+m`);
            } else {
                await mainWindow.click('button.three-dot-menu');
                await mainWindow.keyboard.press('w');
                await mainWindow.keyboard.press('m');
                await mainWindow.keyboard.press('Enter');
            }

            const isMinimized = await browserWindow.evaluate((window) => (window as any).isMinimized());
            expect(isMinimized).toBe(true);
        } finally {
            await app.close();
        }
    });

    test('MM-T825 should be hidden when keyboard shortcuts are pressed', {tag: ['@P2', '@darwin', '@win32']}, async ({}, testInfo) => {
        if (process.platform === 'linux') {
            test.skip(true, 'Linux not supported');
            return;
        }
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
        const {mkdirSync} = await import('fs');
        mkdirSync(userDataDir, {recursive: true});
        writeConfigFile(userDataDir, windowMenuConfig as any);
        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });
        try {
            await waitForAppReady(app);
            const serverMap = await buildServerMap(app);
            const mmServer = serverMap[windowMenuConfig.servers[0].name][0].win;
            await loginToMattermost(mmServer);
            const mainWindow = app.windows().find((window) => window.url().includes('index'))!;
            const browserWindow = await app.browserWindow(mainWindow);

            // send Shift + Command + W on mac, CmdOrCtrl+W on others
            if (process.platform === 'darwin') {
                await mainWindow.keyboard.press('Meta+Shift+w');
            } else {
                await mainWindow.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+w`);
            }

            const isVisible = await browserWindow.evaluate((window) => (window as any).isVisible());
            expect(isVisible).toBe(false);
            const isDestroyed = await browserWindow.evaluate((window) => (window as any).isDestroyed());
            expect(isDestroyed).toBe(false);
        } finally {
            await app.close();
        }
    });
});
