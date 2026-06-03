// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

test.describe('history_menu', () => {
    test.use({appConfig: demoMattermostConfig});
    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

    test('Click back and forward from history', {tag: ['@P2', '@all']}, async ({electronApp}) => {
        const serverMap = await buildServerMap(electronApp);
        const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        await loginToMattermost(firstServer);
        await firstServer.waitForSelector('#sidebarItem_off-topic');

        // Click on Off-Topic channel
        await firstServer.click('#sidebarItem_off-topic');

        // Click on Town Square channel
        await firstServer.click('#sidebarItem_town-square');
        await firstServer.locator('[aria-label="Back"]').click();

        // Wait for navigation
        await firstServer.waitForSelector('#channelHeaderTitle');

        // Get channel header text
        let channelHeaderText = await firstServer.$eval('#channelHeaderTitle', (el) => (el as HTMLElement).textContent?.trim());
        expect(channelHeaderText).toBe('Off-Topic');

        await firstServer.locator('[aria-label="Forward"]').click();

        // Wait for navigation
        await firstServer.waitForSelector('#channelHeaderTitle');

        channelHeaderText = await firstServer.$eval('#channelHeaderTitle', (el) => (el as HTMLElement).textContent?.trim());
        expect(channelHeaderText).toBe('Town Square');
    });
});
