// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {mattermostURL, demoMattermostConfig, type AppConfig} from '../../helpers/config';
import {mattermostDeepLinkUrl, openDeepLinkInApp} from '../../helpers/deeplink';
import {loginToMattermost} from '../../helpers/login';

// Use a real Mattermost server config so serverMap.example points to localhost:8065
test.use({appConfig: demoMattermostConfig});

test(
    'deep link navigates to correct server while app is running',
    {tag: ['@P1', '@darwin', '@win32']},
    async ({electronApp, serverMap}) => {
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
        const deepLink = mattermostDeepLinkUrl(`${new URL(mattermostURL).host}/channels/${channelName}`);

        await openDeepLinkInApp(electronApp, deepLink);

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

test.describe('deep link server URL without trailing slash', () => {
    const serverUrlWithoutSlash = mattermostURL.replace(/\/$/, '');
    const configWithoutTrailingSlash: AppConfig = {
        ...demoMattermostConfig,
        servers: demoMattermostConfig.servers.map((server, index) => (
            index === 0 ? {...server, url: serverUrlWithoutSlash} : server
        )),
    };

    test.use({appConfig: configWithoutTrailingSlash});

    test(
        'DL-01 deep link navigates when configured server URL has no trailing slash',
        {tag: ['@P1', '@darwin', '@win32']},
        async ({electronApp, serverMap}) => {
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

            const channelName = 'off-topic';
            const deepLink = mattermostDeepLinkUrl(`${new URL(serverUrlWithoutSlash).host}/channels/${channelName}`);

            await openDeepLinkInApp(electronApp, deepLink);

            await expect.poll(
                () => serverWin!.url(),
                {
                    timeout: 15_000,
                    message: `Server view should navigate to ${channelName} without double-slash path corruption`,
                },
            ).toContain(channelName);
        },
    );
});
