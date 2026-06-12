// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

// ── MM-T2023: ALT+ENTER ───────────────────────────────────────────────
// Alt/Option + Enter inserts a newline in the post textbox without
// submitting the message. This is webapp textbox behaviour (implemented
// in the textbox component via MM-14177, merged in v5.24.0).
//
// The desktop app hosts the WebContentsView where this happens. The
// Rainforest test (run 2380512, test 280732) executed on Safari 17
// macOS Ventura and passed in 423s.
//
// Not covered in the webapp E2E suite — keeping in desktop.

test.describe('mattermost/alt_enter', () => {
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
        await firstServer!.waitForSelector('#sidebarItem_off-topic', {timeout: 30_000});
        await firstServer!.click('#sidebarItem_off-topic');
        await firstServer!.waitForSelector('#post_textbox', {timeout: 15_000});
    });

    test('MM-T2023 ALT+ENTER inserts a newline without sending the message',
        {tag: ['@P2', '@all']},
        async ({serverMap}) => {
            const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            // Count existing posts before the test
            const postsBefore = await firstServer!.evaluate(() =>
                document.querySelectorAll('.post-message__text').length,
            );

            // Type text in the post textbox
            await firstServer!.waitForSelector('#post_textbox', {timeout: 10_000});
            await firstServer!.fill('#post_textbox', 'Line one');

            // Press Alt+Enter (Option+Return on macOS) to insert a newline
            const modifierKey = process.platform === 'darwin' ? 'Alt' : 'Alt';
            await firstServer!.press('#post_textbox', `${modifierKey}+Enter`);

            // Type more text on the new line
            await firstServer!.type('#post_textbox', 'Line two');

            // Verify the textbox contains both lines (newline was inserted)
            const textboxValue = await firstServer!.evaluate(() => {
                const textbox = document.querySelector('#post_textbox') as HTMLTextAreaElement;
                return textbox?.value ?? '';
            });
            expect(textboxValue, 'Textbox must contain both lines after Alt+Enter').toContain('Line one');
            expect(textboxValue, 'Textbox must contain second line').toContain('Line two');
            expect(textboxValue, 'Textbox must have a newline between lines').toMatch(/Line one\nLine two/);

            // Verify no new post was created (message was NOT sent)
            const postsAfter = await firstServer!.evaluate(() =>
                document.querySelectorAll('.post-message__text').length,
            );
            expect(postsAfter, 'Alt+Enter must NOT send the message').toBe(postsBefore);

            // Now send with regular Enter to verify the distinction
            await firstServer!.press('#post_textbox', 'Enter');

            // Verify the message was sent with regular Enter
            await expect.poll(
                () => firstServer!.evaluate(() =>
                    document.querySelectorAll('.post-message__text').length,
                ),
                {timeout: 10_000, message: 'Regular Enter must send the message'},
            ).toBeGreaterThan(postsBefore);

            // Verify the sent message contains both lines
            const lastPostText = await firstServer!.evaluate(() => {
                const posts = document.querySelectorAll('.post-message__text');
                const lastPost = posts[posts.length - 1];
                return lastPost?.textContent ?? '';
            });
            expect(lastPostText, 'Sent message must contain both lines').toContain('Line one');
            expect(lastPostText, 'Sent message must contain second line').toContain('Line two');
        },
    );
});
