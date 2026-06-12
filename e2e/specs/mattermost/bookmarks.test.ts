// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import type {AppConfig} from '../../helpers/config';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

// ── Notes on scope ─────────────────────────────────────────────────────
// Bookmarks CRUD (add, edit, delete, reorder, file upload, favicon change,
// search integration, permissions, archived-channel restrictions) is covered
// in the Mattermost webapp Cypress E2E suite:
//   cypress/tests/integration/channels/channel/channel_bookmarks_spec.ts
//   cypress/tests/integration/channels/enterprise/permissions/bookmark_permissions_spec.ts
//
// The two desktop-relevant cases kept here are:
//   MM-T5611 – clicking an external bookmark link must open the system
//              browser (shell.openExternal), not an in-app window.
//   MM-T5600 – the "Bookmarks Bar" toggle must appear in the channel
//              dropdown menu (desktop renders the webapp menu; the menu
//              item presence is a server-feature gate the desktop must
//              not break).

const EXTERNAL_BOOKMARK_URL = 'https://mattermost.com/';

const bookmarksConfig: AppConfig = {
    ...demoMattermostConfig,
    servers: demoMattermostConfig.servers.filter((server) => !server.url.includes('github.com')),
};

test.describe('mattermost/bookmarks', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: bookmarksConfig});
    test.setTimeout(120_000);

    test.beforeAll(async ({serverMap}) => {
        // This gate matches the canonical pattern in external_links.test.ts
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const firstServer = serverMap[bookmarksConfig.servers[0].name]?.[0]?.win;
        expect(firstServer, 'Mattermost server view should exist').toBeTruthy();

        await loginToMattermost(firstServer!);
        await firstServer!.waitForSelector('#sidebarItem_off-topic', {timeout: 30_000});
        await firstServer!.click('#sidebarItem_off-topic');
        await firstServer!.waitForSelector('#channelHeaderTitle', {timeout: 15_000});
    });

    // ── MM-T5600: Bookmarks Bar option in channel dropdown ──────────────
    test('MM-T5600 Bookmarks Bar option IS shown in the channel drop-down menu on Enterprise and Professional licensed servers',
        {tag: ['@P2', '@all']},
        async ({serverMap}) => {
            const firstServer = serverMap[bookmarksConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Mattermost server view should exist').toBeTruthy();

            // Open the channel header dropdown
            await firstServer!.click('#channelHeaderDropdownButton');

            // The webapp renders the Bookmarks submenu with id `channel-menu-<channelId>-bookmarks`
            // (see webapp/channels/src/components/channel_header_menu/menu_items/channel_bookmarks_submenu.tsx).
            await firstServer!.waitForSelector('[id^="channel-menu-"][id$="-bookmarks"]', {timeout: 5_000});

            // Close the menu
            await firstServer!.keyboard.press('Escape');
        },
    );

    // ── MM-T5611: Open a bookmark URL/link ────────────────────────────
    test('MM-T5611 Open a bookmark URL/link (External and Internal links)',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (process.platform === 'linux') {
                test.skip(true, 'Linux not supported for external link interception');
                return;
            }

            const firstServer = serverMap[bookmarksConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Mattermost server view should exist').toBeTruthy();

            // Intercept shell.openExternal — canonical pattern from external_links.test.ts
            await electronApp.evaluate(({shell}) => {
                (shell as any).__e2eOpenExternalCalls = [];
                const originalOpenExternal = shell.openExternal.bind(shell);
                (shell as any).__e2eOriginalOpenExternal = originalOpenExternal;
                shell.openExternal = ((url: string) => {
                    (shell as any).__e2eOpenExternalCalls.push(url);
                    return Promise.resolve();
                }) as typeof shell.openExternal;
            });

            // Open the channel dropdown → Bookmarks submenu → "Add a link".
            // The submenu trigger and the "Add a link" item have stable ids
            // `channel-menu-<channelId>-bookmarks` and `…-bookmarks-link`
            // (see webapp/channels/src/components/channel_header_menu/menu_items/channel_bookmarks_submenu.tsx).
            // The submenu opens on hover or trigger-click; dispatch mouseenter
            // via the renderer since ServerLocator has no hover helper.
            await firstServer!.click('#channelHeaderDropdownButton');
            await firstServer!.waitForSelector('[id^="channel-menu-"][id$="-bookmarks"]', {timeout: 5_000});
            await firstServer!.evaluate(() => {
                const trigger = document.querySelector('[id^="channel-menu-"][id$="-bookmarks"]') as HTMLElement | null;
                trigger?.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
                trigger?.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            });
            await firstServer!.waitForSelector('[id^="channel-menu-"][id$="-bookmarks-link"]', {timeout: 5_000});
            await firstServer!.click('[id^="channel-menu-"][id$="-bookmarks-link"]');

            // Bookmark create modal — fields have stable data-testids
            // (see webapp/channels/src/components/channel_bookmarks/{channel_bookmarks_create_modal,create_modal_name_input}.tsx).
            await firstServer!.waitForSelector('[data-testid="linkInput"]', {timeout: 5_000});
            await firstServer!.fill('[data-testid="linkInput"]', EXTERNAL_BOOKMARK_URL);
            await firstServer!.fill('[data-testid="titleInput"]', 'E2E External Bookmark');
            await firstServer!.click('.GenericModal .GenericModal__button.confirm');

            // Modal closes and bookmark appears in the container
            await firstServer!.waitForSelector('[data-testid="linkInput"]', {state: 'detached', timeout: 5_000});
            await firstServer!.waitForSelector(
                '[data-testid="channel-bookmarks-container"] [data-testid^="bookmark-item-"]',
                {timeout: 10_000},
            );

            // Click the bookmark link
            await firstServer!.click(
                '[data-testid="channel-bookmarks-container"] [data-testid^="bookmark-item-"] a',
            );

            // Verify shell.openExternal was called with the bookmark URL
            await expect.poll(
                () => electronApp.evaluate(
                    ({shell}) => (shell as any).__e2eOpenExternalCalls ?? [],
                ),
                {timeout: 10_000},
            ).toContain(EXTERNAL_BOOKMARK_URL);

            // Verify no in-app window was opened for the external URL
            const internalWindowOpened = electronApp.windows().some((window) => {
                try {
                    return window.url().includes('mattermost.com');
                } catch {
                    return false;
                }
            });
            expect(internalWindowOpened, 'External bookmark must not open an in-app window').toBe(false);

            // Restore original shell.openExternal
            await electronApp.evaluate(({shell}) => {
                const original = (shell as any).__e2eOriginalOpenExternal;
                if (original) {
                    shell.openExternal = original;
                }
                delete (shell as any).__e2eOpenExternalCalls;
                delete (shell as any).__e2eOriginalOpenExternal;
            });

            // Cleanup: open the per-bookmark dot menu and click Delete. Both have
            // stable element ids that don't depend on locale (see
            // webapp/channels/src/components/channel_bookmarks/bookmark_dot_menu.tsx):
            //   trigger: id="channelBookmarksDotMenuButton-<bookmarkId>"
            //   delete item: id="channelBookmarksDelete"
            await firstServer!.evaluate(() => {
                const item = document.querySelector(
                    '[data-testid="channel-bookmarks-container"] [data-testid^="bookmark-item-"]',
                ) as HTMLElement | null;
                item?.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
                item?.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            });
            await firstServer!.click('[id^="channelBookmarksDotMenuButton-"]');
            await firstServer!.click('#channelBookmarksDelete');
            await firstServer!.click('.GenericModal .GenericModal__button.delete, .GenericModal .GenericModal__button.confirm');
            await firstServer!.waitForSelector(
                '[data-testid="channel-bookmarks-container"] [data-testid^="bookmark-item-"]',
                {state: 'detached', timeout: 5_000},
            );
        },
    );
});
