// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {clickHistoryMenuItem} from '../../helpers/historyMenu';
import {loginToMattermost} from '../../helpers/login';
import {activateServerEntry, getServerEntry} from '../../helpers/serverContext';
import {buildServerMap} from '../../helpers/serverMap';
import type {ServerView} from '../../helpers/serverView';

async function expectChannelTitle(serverWin: ServerView, title: string): Promise<void> {
    await expect.poll(
        async () => serverWin.$eval('#channelHeaderTitle', (el) => (el as HTMLElement).textContent?.trim()),
        {timeout: 10_000},
    ).toBe(title);
}

test.describe('history_menu', () => {
    test.use({appConfig: demoMattermostConfig});
    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

    test('Click back and forward from history', {tag: ['@P2', '@all']}, async ({electronApp}) => {
        const serverMap = await buildServerMap(electronApp);
        const entry = getServerEntry(serverMap, demoMattermostConfig.servers[0].name);
        await activateServerEntry(electronApp, entry);
        await loginToMattermost(entry.win);
        await entry.win.waitForSelector('#sidebarItem_off-topic');

        await entry.win.click('#sidebarItem_off-topic');
        await expectChannelTitle(entry.win, 'Off-Topic');

        await entry.win.click('#sidebarItem_town-square');
        await expectChannelTitle(entry.win, 'Town Square');
        await entry.win.locator('[aria-label="Back"]').click();

        await entry.win.waitForSelector('#channelHeaderTitle');

        let channelHeaderText = await entry.win.$eval('#channelHeaderTitle', (el) => (el as HTMLElement).textContent?.trim());
        expect(channelHeaderText).toBe('Off-Topic');

        await entry.win.locator('[aria-label="Forward"]').click();

        await entry.win.waitForSelector('#channelHeaderTitle');

        channelHeaderText = await entry.win.$eval('#channelHeaderTitle', (el) => (el as HTMLElement).textContent?.trim());
        expect(channelHeaderText).toBe('Town Square');
    });

    test(
        'MM-T822 History → Back in the Menu Bar navigates to previous page',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const serverMap = await buildServerMap(electronApp);
            const entry = getServerEntry(serverMap, demoMattermostConfig.servers[0].name);
            await activateServerEntry(electronApp, entry);
            await loginToMattermost(entry.win);
            await entry.win.waitForSelector('#sidebarItem_off-topic');

            await entry.win.click('#sidebarItem_off-topic');
            await expectChannelTitle(entry.win, 'Off-Topic');
            const offTopicTitle = await entry.win.$eval('#channelHeaderTitle', (el) => (el as HTMLElement).textContent?.trim());

            await entry.win.click('#sidebarItem_town-square');
            await expectChannelTitle(entry.win, 'Town Square');

            await clickHistoryMenuItem(electronApp, 'Back', entry.webContentsId);

            await expect.poll(
                async () => entry.win.$eval('#channelHeaderTitle', (el) => (el as HTMLElement).textContent?.trim()),
                {timeout: 10_000, message: 'Should navigate back to Off-Topic after History → Back'},
            ).toBe(offTopicTitle);
        },
    );

    test(
        'MM-T823 History → Forward in the Menu Bar navigates to next page',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const serverMap = await buildServerMap(electronApp);
            const entry = getServerEntry(serverMap, demoMattermostConfig.servers[0].name);
            await activateServerEntry(electronApp, entry);
            await loginToMattermost(entry.win);
            await entry.win.waitForSelector('#sidebarItem_off-topic');

            await entry.win.click('#sidebarItem_off-topic');
            await expectChannelTitle(entry.win, 'Off-Topic');
            await entry.win.click('#sidebarItem_town-square');
            await expectChannelTitle(entry.win, 'Town Square');

            await clickHistoryMenuItem(electronApp, 'Back', entry.webContentsId);
            await expectChannelTitle(entry.win, 'Off-Topic');

            await clickHistoryMenuItem(electronApp, 'Forward', entry.webContentsId);
            await expectChannelTitle(entry.win, 'Town Square');
        },
    );
});
