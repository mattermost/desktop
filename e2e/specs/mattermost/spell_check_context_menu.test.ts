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
                if (!wc || wc.isDestroyed()) {
                    return;
                }
                wc.session.setSpellCheckerEnabled(true);
                wc.session.setSpellCheckerLanguages(['en-US']);
            }, serverEntry!.webContentsId);

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

            const textboxSelector = '#post_textbox, [data-testid="post_textbox"], [role="textbox"]';
            await firstServer!.waitForSelector(textboxSelector, {timeout: 10_000});
            await firstServer!.click(textboxSelector);
            await firstServer!.keyboard.type('Thiss is a mispelled worrd');

            const point = await firstServer!.evaluate(() => {
                const el = document.querySelector('#post_textbox, [data-testid="post_textbox"], [role="textbox"]');
                if (!el) {
                    return null;
                }
                const rect = el.getBoundingClientRect();
                return {
                    x: Math.round(rect.left + (rect.width / 2)),
                    y: Math.round(rect.top + (rect.height / 2)),
                };
            });
            expect(point, 'Post textbox must be on screen for spell-check context menu').toBeTruthy();

            await electronApp.evaluate(({webContents}, payload) => {
                const wc = webContents.fromId(payload.id);
                if (!wc || wc.isDestroyed()) {
                    throw new Error(`webContents ${payload.id} is not available`);
                }
                wc.focus();
                wc.sendInputEvent({type: 'mouseMove', x: payload.x, y: payload.y});
                wc.sendInputEvent({
                    type: 'mouseDown',
                    x: payload.x,
                    y: payload.y,
                    button: 'right',
                    clickCount: 1,
                });
                wc.sendInputEvent({
                    type: 'mouseUp',
                    x: payload.x,
                    y: payload.y,
                    button: 'right',
                    clickCount: 1,
                });
            }, {id: serverEntry!.webContentsId, ...point!});

            await expect.poll(
                async () => {
                    const menu = await electronApp.evaluate(() => (global as any).__e2eSpellCheckMenu);
                    if (!menu) {
                        return false;
                    }
                    if (menu.misspelledWord) {
                        return true;
                    }
                    return Array.isArray(menu.suggestions) && menu.suggestions.length > 0;
                },
                {timeout: 15_000, message: 'Native spell-check context menu must expose suggestions'},
            ).toBe(true);

            await firstServer!.fill(textboxSelector, '');
        },
    );
});
