// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

// ── MM-T829: Desktop App shows spell check options when you right click ─
// The desktop app enables Chromium's built-in spell checker via the
// Config.useSpellChecker setting. When enabled, right-clicking in a text
// input should show spelling suggestions in the context menu.
//
// This is desktop-relevant because the desktop controls whether the spell
// checker is enabled (via Config and the settings toggle). The webapp
// itself does not control Chromium's spell check.
//
// NOT covered in webapp E2E suite — keeping in desktop.

test.describe('mattermost/spell_check_context_menu', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test.beforeAll(async ({serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
        expect(firstServer, 'Mattermost server view should exist').toBeTruthy();

        await loginToMattermost(firstServer!);
        await firstServer!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
    });

    test('MM-T829 Desktop App shows spell check options when you right click',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            // Verify spell checker is enabled in config
            const spellCheckEnabled = await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const Config = refs?.Config;
                return Config ? Config.get('useSpellChecker') === true : false;
            });
            expect(spellCheckEnabled, 'Spell checker must be enabled in config').toBe(true);

            // Type a misspelled word in the post textbox
            await firstServer!.waitForSelector('#post_textbox', {timeout: 10_000});
            await firstServer!.fill('#post_textbox', 'Thiss is a mispelled worrd');

            // Right-click the textbox to open the context menu
            await firstServer!.click('#post_textbox', {button: 'right'});

            // The context menu should appear. Chromium's spell check adds
            // spelling suggestions to the context menu when right-clicking
            // a misspelled word.
            const contextMenuAppeared = await firstServer!.waitForSelector('.Menu .MenuItem', {timeout: 5_000}).then(() => true).catch(() => false);
            expect(contextMenuAppeared, 'Context menu must appear on right-click in textbox').toBe(true);

            // Verify spell check suggestions are present in the menu.
            // Chromium adds menu items like "Thiss" → "This", "miss" etc.
            const hasSpellSuggestions = await firstServer!.evaluate(() => {
                const items = document.querySelectorAll('.Menu .MenuItem');
                // Spell check suggestions typically appear as the first items
                // in the context menu, before Cut/Copy/Paste
                const firstItems = Array.from(items).slice(0, 5);
                return firstItems.some((item) => {
                    const text = (item.textContent ?? '').trim();
                    // Spelling suggestions are single words that differ from the
                    // misspelled input — they won't be "Cut", "Copy", "Paste", etc.
                    return text.length > 0 &&
                        !['cut', 'copy', 'paste', 'select all', 'undo', 'redo'].includes(text.toLowerCase());
                });
            });
            expect(hasSpellSuggestions, 'Spell check suggestions must appear in right-click context menu').toBe(true);

            // Close the context menu
            await firstServer!.click('#channelHeaderTitle');

            // Clear the textbox
            await firstServer!.fill('#post_textbox', '');
        },
    );
});
