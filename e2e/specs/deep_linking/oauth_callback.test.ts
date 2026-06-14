// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {demoConfig} from '../../helpers/config';
import {mattermostDeepLinkUrl, openDeepLinkInApp} from '../../helpers/deeplink';
import {buildServerMap} from '../../helpers/serverMap';

test(
    'DL-03 OAuth callback deep link navigates the active server view',
    {tag: ['@P1', '@all']},
    async ({electronApp}) => {
        await waitForAppReady(electronApp);

        const serverName = demoConfig.servers[0].name;
        const oauthPath = '/oauth/authorize?client_id=desktop&response_type=code&state=e2e-test';
        const deepLink = mattermostDeepLinkUrl(`example.com${oauthPath}`);

        await openDeepLinkInApp(electronApp, deepLink);

        await expect.poll(async () => {
            const serverMap = await buildServerMap(electronApp);
            const view = serverMap[serverName]?.[0]?.win;
            return view?.url() ?? '';
        }, {
            timeout: 30_000,
            message: 'OAuth callback deep link should navigate the example server view',
        }).toContain('example.com/oauth/authorize');

        const mainWindow = electronApp.windows().find((window) => window.url().includes('index'));
        expect(mainWindow).toBeDefined();
        await expect.poll(
            () => mainWindow!.innerText('.ServerDropdownButton'),
            {timeout: 15_000},
        ).toBe(serverName);
    },
);
