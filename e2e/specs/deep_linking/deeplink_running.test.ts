// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execSync} from 'child_process';

import {test, expect} from '../../fixtures/index';
import {mattermostURL} from '../../helpers/config';

test(
    'deep link navigates to correct server while app is running',
    {tag: ['@P1', '@darwin', '@win32']},
    async ({serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverWin = serverMap.example?.[0]?.win;
        if (!serverWin) {
            test.skip(true, 'No server view available');
            return;
        }

        const channelName = 'town-square';
        const deepLink = `mattermost://${new URL(mattermostURL).host}/channels/${channelName}`;

        // Trigger deep link from the OS
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
