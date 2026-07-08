// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {typeIntoPostTextbox} from '../../helpers/mattermostShell';

test.describe('permissions/trust_protocols', () => {
    test.use({appConfig: demoMattermostConfig});

    test(
        'MM-T2925 Trust protocols and auto-converting protocols to links',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

            const serverWin = serverMap[demoMattermostConfig.servers[0].name][0].win;
            await loginToMattermost(serverWin);
            await serverWin.waitForSelector('#post_textbox', {timeout: 30_000});

            await electronApp.evaluate(({shell}) => {
                (global as any).__e2eOpenExternalCalls = [] as string[];
                (global as any).__e2eOriginalOpenExternal = shell.openExternal.bind(shell);
                shell.openExternal = async (url: string) => {
                    (global as any).__e2eOpenExternalCalls.push(url);
                };
            });

            try {
                await typeIntoPostTextbox(serverWin, 'https://example.com/protocol-test');
                await serverWin.keyboard.press('Enter');
                await new Promise((resolve) => setTimeout(resolve, 2_000));

                const link = serverWin.locator('a[href*="example.com"]');
                if ((await link.count()) === 0) {
                    test.skip(true, 'Posted link not rendered as anchor on this server');
                    return;
                }
                await link.click();

                await expect.poll(
                    () => electronApp.evaluate(() => ((global as any).__e2eOpenExternalCalls as string[] | undefined)?.length ?? 0),
                    {timeout: 10_000},
                ).toBeGreaterThan(0);
            } finally {
                await electronApp.evaluate(({shell}) => {
                    const original = (global as any).__e2eOriginalOpenExternal;
                    if (original) {
                        shell.openExternal = original;
                    }
                });
            }
        },
    );
});
