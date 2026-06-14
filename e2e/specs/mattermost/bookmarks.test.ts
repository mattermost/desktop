// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect, type ServerMap} from '../../fixtures/index';
import type {AppConfig} from '../../helpers/config';
import {demoMattermostConfig} from '../../helpers/config';
import {openChannelHeaderMenu, enableBookmarksBar} from '../../helpers/channelMenu';
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

async function loginToOffTopicChannel(serverMap: ServerMap) {
    const firstServer = serverMap[bookmarksConfig.servers[0].name]?.[0]?.win;
    expect(firstServer, 'Mattermost server view should exist').toBeTruthy();
    await loginToMattermost(firstServer!);
    await firstServer!.waitForSelector('#sidebarItem_off-topic', {timeout: 30_000});
    await firstServer!.click('#sidebarItem_off-topic');
    await firstServer!.waitForSelector('#channelHeaderTitle', {timeout: 15_000});
    return firstServer!;
}

test.describe('mattermost/bookmarks', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: bookmarksConfig});
    test.setTimeout(120_000);

    // ── MM-T5600: Bookmarks Bar option in channel dropdown ──────────────
    test('MM-T5600 Bookmarks Bar option IS shown in the channel drop-down menu on Enterprise and Professional licensed servers',
        {tag: ['@P2', '@all']},
        async ({serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const firstServer = await loginToOffTopicChannel(serverMap);

            await openChannelHeaderMenu(firstServer!);

            const bookmarksMenu = await firstServer!.$('[id^="channel-menu-"][id$="-bookmarks"]');
            if (!bookmarksMenu) {
                test.skip(true, 'Bookmarks menu not available on this server license');
                return;
            }

            await firstServer!.waitForSelector('[id^="channel-menu-"][id$="-bookmarks"]', {timeout: 5_000});

            // Close the menu
            await firstServer!.keyboard.press('Escape');
        },
    );

    // ── MM-T5611: Open a bookmark URL/link ────────────────────────────
    test('MM-T5611 Open a bookmark URL/link (External and Internal links)',
        {tag: ['@P2', '@darwin', '@win32']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const firstServer = await loginToOffTopicChannel(serverMap);

            await enableBookmarksBar(firstServer!);

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

            try {
                // Open the channel dropdown → Bookmarks submenu → "Add a link".
                // The submenu trigger and the "Add a link" item have stable ids
                // `channel-menu-<channelId>-bookmarks` and `…-bookmarks-link`
                // (see webapp/channels/src/components/channel_header_menu/menu_items/channel_bookmarks_submenu.tsx).
                // The submenu opens on hover or trigger-click; dispatch mouseenter
                // via the renderer since ServerLocator has no hover helper.
                await openChannelHeaderMenu(firstServer!);
                const bookmarksMenu = await firstServer!.$('[id^="channel-menu-"][id$="-bookmarks"]');
                if (!bookmarksMenu) {
                    test.skip(true, 'Bookmarks menu not available on this server license');
                    return;
                }
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

                const saveClicked = await firstServer!.runInRenderer(`
                    const buttons = Array.from(document.querySelectorAll(
                        '.GenericModal button, .GenericModal .GenericModal__button',
                    ));
                    const save = buttons.find((button) => {
                        const label = (button.textContent || '').trim().toLowerCase();
                        return label === 'save' || label === 'add' || button.getAttribute('type') === 'submit';
                    });
                    if (!save) {
                        return false;
                    }
                    save.click();
                    return true;
                `, true);
                expect(saveClicked, 'Bookmark save button must be clicked').toBe(true);

                await firstServer!.waitForSelector(
                    '[data-testid="channel-bookmarks-container"] [data-testid^="bookmark-item-"]',
                    {timeout: 30_000},
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

                // Verify no in-app server view navigated to the external URL.
                // app.windows() only enumerates BrowserWindows — server panes are
                // WebContentsView instances; query them via global.__e2eTestRefs.
                const serverViewURLs = await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    if (!refs?.ServerManager || !refs?.ViewManager || !refs?.WebContentsManager) {
                        return [] as string[];
                    }
                    const urls: string[] = [];
                    for (const server of refs.ServerManager.getAllServers()) {
                        for (const view of refs.ViewManager.getViewsByServerId(server.id)) {
                            const wcv = refs.WebContentsManager.getView(view.id);
                            const wc = wcv?.webContents;
                            if (wc && !wc.isDestroyed()) {
                                urls.push(wc.getURL() ?? '');
                            }
                        }
                    }
                    return urls;
                });
                expect(
                    serverViewURLs.some((url) => url.includes('mattermost.com')),
                    'No in-app server view should have navigated to the external bookmark URL',
                ).toBe(false);
            } finally {
                // Restore original shell.openExternal even if the test failed,
                // otherwise later specs in the same Electron process see the stub.
                await electronApp.evaluate(({shell}) => {
                    const original = (shell as any).__e2eOriginalOpenExternal;
                    if (original) {
                        shell.openExternal = original;
                    }
                    delete (shell as any).__e2eOpenExternalCalls;
                    delete (shell as any).__e2eOriginalOpenExternal;
                });
            }

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
