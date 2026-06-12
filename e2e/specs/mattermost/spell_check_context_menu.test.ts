// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

// ── MM-T829: Desktop App shows spell check options when you right click ─
// Spell-check suggestions are rendered in Chromium's native context menu,
// not the webapp's `.Menu` components. Listen for the `context-menu` event
// on the server webContents and inspect dictionarySuggestions there.

test.describe('mattermost/spell_check_context_menu', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test('MM-T829 Desktop App shows spell check options when you right click',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            const firstServer = serverEntry?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            await loginToMattermost(firstServer!);
            await firstServer!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});

            const spellCheckEnabled = await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const Config = refs?.Config;
                return Config ? Config.useSpellChecker === true : false;
            });
            expect(spellCheckEnabled, 'Spell checker must be enabled in config').toBe(true);

            await electronApp.evaluate(({webContents}, id) => {
                const wc = webContents.fromId(id);
                delete (global as any).__e2eSpellCheckMenu;
                wc?.removeAllListeners('context-menu');
                wc?.on('context-menu', (_event, params) => {
                    (global as any).__e2eSpellCheckMenu = {
                        misspelledWord: params.misspelledWord,
                        suggestions: params.dictionarySuggestions ?? [],
                    };
                });
            }, serverEntry!.webContentsId);

            await firstServer!.waitForSelector('#post_textbox', {timeout: 10_000});
            await firstServer!.fill('#post_textbox', 'Thiss is a mispelled worrd');
            await firstServer!.click('#post_textbox', {button: 'right'});

            await expect.poll(
                async () => {
                    const menu = await electronApp.evaluate(() => (global as any).__e2eSpellCheckMenu);
                    return Array.isArray(menu?.suggestions) && menu.suggestions.length > 0;
                },
                {timeout: 10_000, message: 'Native spell-check context menu must expose suggestions'},
            ).toBe(true);

            await firstServer!.fill('#post_textbox', '');
        },
    );
});
