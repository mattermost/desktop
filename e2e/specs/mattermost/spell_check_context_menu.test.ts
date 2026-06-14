// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {getPostTextboxWordPoint, POST_TEXTBOX_SELECTOR, recoverServerViewIfNeeded, typeIntoPostTextbox, waitForMattermostShell} from '../../helpers/mattermostShell';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';

// ── MM-T829: Desktop App shows spell check options when you right click ─
// Spell-check suggestions are rendered in Chromium's native context menu,
// not the webapp's `.Menu` components. Listen for the `context-menu` event
// on the server webContents and inspect dictionarySuggestions there.

const MISSPELLED_TEXT = 'Thiss is a mispelled worrd';
const TARGET_WORD = 'mispelled';

test.describe('mattermost/spell_check_context_menu', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test('MM-T829 Desktop App shows spell check options when you right click',
        {tag: ['@P2', '@darwin', '@win32']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }
            if (process.platform === 'linux') {
                test.skip(true, 'Native spell-check dictionaries are unavailable in Linux CI');
                return;
            }

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            const firstServer = serverEntry?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await loginToMattermost(firstServer!);
            await waitForMattermostShell(firstServer!);
            await recoverServerViewIfNeeded(firstServer!);
            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);

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

            const textboxSelector = POST_TEXTBOX_SELECTOR;
            await typeIntoPostTextbox(firstServer!, MISSPELLED_TEXT);

            await expect.poll(
                async () => firstServer!.runInRenderer(`
                    const editor = document.querySelector('[data-slate-editor="true"], #post_textbox, [data-testid="post_textbox"]');
                    const text = editor instanceof HTMLTextAreaElement
                        ? editor.value
                        : (editor?.textContent || '');
                    return text.includes(${JSON.stringify(TARGET_WORD)});
                `),
                {timeout: 15_000, message: 'Misspelled text must be present in the post textbox'},
            ).toBe(true);

            await expect.poll(
                () => getPostTextboxWordPoint(firstServer!, TARGET_WORD),
                {timeout: 15_000, message: 'Misspelled word must render in the post textbox'},
            ).not.toBeNull();

            const point = await getPostTextboxWordPoint(firstServer!, TARGET_WORD);
            expect(point, 'Misspelled word must be on screen for spell-check context menu').toBeTruthy();

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);

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
                    button: 'left',
                    clickCount: 2,
                });
                wc.sendInputEvent({
                    type: 'mouseUp',
                    x: payload.x,
                    y: payload.y,
                    button: 'left',
                    clickCount: 2,
                });
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
