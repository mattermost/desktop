// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {POST_TEXTBOX_SELECTOR, typeIntoPostTextbox} from '../../helpers/mattermostShell';

test.describe('macos_only/cmd_enter', () => {
    test.use({appConfig: demoMattermostConfig});

    test(
        'MM-T2949 CMD+Enter inserts newline on macOS post textbox',
        {tag: ['@P2', '@darwin']},
        async ({serverMap}) => {
            test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

            const serverWin = serverMap[demoMattermostConfig.servers[0].name][0].win;
            await loginToMattermost(serverWin);
            await serverWin.click('#sidebarItem_off-topic');
            await serverWin.waitForSelector(POST_TEXTBOX_SELECTOR, {timeout: 15_000});
            await typeIntoPostTextbox(serverWin, 'mac line');
            await serverWin.keyboard.press('Meta+Enter');
            await serverWin.keyboard.type('two');

            const value = await serverWin.evaluate((selector) => {
                const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
                return el?.value ?? (el as HTMLElement | null)?.textContent ?? '';
            }, POST_TEXTBOX_SELECTOR);
            expect(value).toMatch(/mac line[\s\S]*two/);
        },
    );
});
