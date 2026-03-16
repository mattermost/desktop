// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {electronBinaryPath, appDir, demoMattermostConfig, writeConfigFile} from '../../helpers/config';
import {waitForAppReady} from '../../helpers/appReadiness';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

if (!process.env.MM_TEST_SERVER_URL) {
    test.skip(true, 'MM_TEST_SERVER_URL required');
}

const config = demoMattermostConfig;

async function launchWithMattermostConfig(testInfo: {outputDir: string}) {
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
    await waitForAppReady(app);
    const serverMap = await buildServerMap(app);
    const mmServer = serverMap[config.servers[0].name][0].win;
    await loginToMattermost(mmServer);
    const mainWindow = app.windows().find((w) => w.url().includes('index'))!;
    return {app, serverMap, mainWindow};
}

test.describe('server_management/tab_management', () => {
    test.describe('MM-TXXXX should be able to close server tabs', () => {
        test('MM-TXXXX_1 should close a server tab when clicking the x button', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app, serverMap, mainWindow} = await launchWithMattermostConfig(testInfo);
            try {
                await mainWindow.click('#newTabButton');

                await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');

                let updatedServerMap = await buildServerMap(app);
                const serverName = config.servers[0].name;
                if (!updatedServerMap[serverName] || updatedServerMap[serverName].length < 2) {
                    updatedServerMap = await buildServerMap(app);
                }

                const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
                await secondTab.click();

                const secondView = updatedServerMap[serverName][1].win;
                await secondView.waitForSelector('#sidebarItem_off-topic');
                await secondView.click('#sidebarItem_off-topic');

                const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
                const secondTabEl = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
                expect(firstTab).toBeDefined();
                expect(secondTabEl).toBeDefined();

                const secondTabCloseButton = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2) .serverTabItem__close');
                await secondTabCloseButton.click();

                const remainingTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
                const thirdTab = await mainWindow.$('.TabBar li.serverTabItem:nth-child(2)');
                expect(remainingTab).toBeDefined();
                expect(thirdTab).toBeNull();
            } finally {
                await app.close();
            }
        });
    });

    test.describe('MM-TXXXX main tab for a server cannot be closed', () => {
        test('MM-TXXXX_2 should not show close button on the main tab when there is only one tab', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app, mainWindow} = await launchWithMattermostConfig(testInfo);
            try {
                const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
                const secondTab = await mainWindow.$('.TabBar li.serverTabItem:nth-child(2)');
                expect(firstTab).toBeDefined();
                expect(secondTab).toBeNull();

                const closeButton = await mainWindow.$('.TabBar li.serverTabItem .serverTabItem__close');
                expect(closeButton).toBeNull();
            } finally {
                await app.close();
            }
        });

        test('MM-TXXXX_3 should show close button on the main tab when there are multiple tabs', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app, mainWindow} = await launchWithMattermostConfig(testInfo);
            try {
                await mainWindow.click('#newTabButton');

                const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
                const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
                const thirdTab = await mainWindow.$('.TabBar li.serverTabItem:nth-child(3)');
                expect(firstTab).toBeDefined();
                expect(secondTab).toBeDefined();
                expect(thirdTab).toBeNull();

                const firstTabCloseButton = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1) .serverTabItem__close');
                const secondTabCloseButton = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2) .serverTabItem__close');
                expect(firstTabCloseButton).toBeDefined();
                expect(secondTabCloseButton).toBeDefined();

                await secondTabCloseButton.click();

                const remainingTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
                const secondTabAfterClose = await mainWindow.$('.TabBar li.serverTabItem:nth-child(2)');
                expect(remainingTab).toBeDefined();
                expect(secondTabAfterClose).toBeNull();
            } finally {
                await app.close();
            }
        });
    });
});
