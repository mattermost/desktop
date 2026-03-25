// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execSync} from 'child_process';

import {test, expect} from '../../fixtures/index';
import {mattermostURL, demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

// Use a real Mattermost server config so serverMap.example points to localhost:8065
test.use({appConfig: demoMattermostConfig});

test(
    'deep link navigates to correct server while app is running',
    {tag: ['@P1', '@darwin', '@win32']},
    async ({serverMap}) => {
        if (process.platform === 'linux') {
            test.skip(true, 'Deep link not supported on Linux');
            return;
        }

        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverWin = serverMap.example?.[0]?.win;
        if (!serverWin) {
            test.skip(true, 'No server view available');
            return;
        }

        await loginToMattermost(serverWin);
        await serverWin.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});

        // Trigger deep link from the OS
        const channelName = 'town-square';
        const deepLink = `mattermost://${new URL(mattermostURL).host}/channels/${channelName}`;

        if (process.platform === 'darwin') {
            execSync(`open "${deepLink}"`);
        } else if (process.platform === 'win32') {
            execSync(`start "" "${deepLink}"`);
        }

        // Wait for navigation to the linked channel
        await expect.poll(
            () => serverWin!.url(),
            {
                timeout: 15_000,
                message: `Server view should navigate to ${channelName}`,
            },
        ).toContain(channelName);
    },
);
