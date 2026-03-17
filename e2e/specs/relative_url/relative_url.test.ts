// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

test.describe('copylink', () => {
    test.use({appConfig: demoMattermostConfig});

    test('MM-T1308 Check that external links dont open in the app', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
        if (!firstServer) {
            test.skip(true, 'No server view available');
            return;
        }

        await loginToMattermost(firstServer);
        await firstServer.waitForSelector('#post_textbox');
        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', 'https://electronjs.org/apps/mattermost');
        await firstServer.press('#post_textbox', 'Enter');
        const newPageWindow = electronApp.windows().find((window) => window.url().includes('apps/mattermost'));
        expect(newPageWindow === undefined).toBeTruthy();
    });
});
