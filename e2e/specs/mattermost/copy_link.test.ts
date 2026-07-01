// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';

test.describe('copylink', () => {
    test.use({appConfig: demoMattermostConfig});
    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');
    test.skip(process.platform === 'linux', 'Not supported on Linux');

    test('MM-T125 Copy Link can be used from channel LHS', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
        const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
        if (!firstServer) {
            throw new Error('No server view available');
        }

        await loginToMattermost(firstServer);
        await prepareMattermostServerView(electronApp, firstServer.webContentsId);

        // Clear clipboard to prevent pollution from other tests
        await electronApp.evaluate(({clipboard}) => {
            clipboard.writeText('');
        });

        // "Copy Link" for a channel lives in the webapp's channel options ("⋮") menu,
        // which is a normal DOM menu we can drive. It is NOT in the desktop app's native
        // right-click context menu — that is a native Electron Menu, invisible to DOM
        // queries, which is why right-clicking and waiting for the item never worked.
        await firstServer.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});

        // The channel options ("⋮") button is only rendered/shown while the row is
        // hovered, so dispatch hover events on the row first. The ServerView click path
        // uses a synthetic element.click(), which fires the handler even if the button
        // is still visually hidden — so we only need the button present in the DOM.
        await firstServer.evaluate(`(() => {
            const el = document.querySelector('#sidebarItem_town-square');
            if (!el) {
                return;
            }
            for (const type of ['pointerover', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']) {
                el.dispatchEvent(new MouseEvent(type, {bubbles: true, cancelable: true}));
            }
        })()`);

        // Open the channel options menu. Markup varies across webapp versions, so match
        // by aria-label/class with fallbacks; wait for "attached" (not "visible") since
        // the button can be hover-gated by CSS opacity.
        const menuButtonSelector = [
            '#sidebarItem_town-square button[aria-label*="channel menu" i]',
            '#sidebarItem_town-square button[aria-label*="channel options" i]',
            '#sidebarItem_town-square button[aria-label*="options" i]',
            '#sidebarItem_town-square button.SidebarMenu_menuButton',
            '#sidebarItem_town-square .SidebarMenu button',
        ].join(', ');
        await firstServer.waitForSelector(menuButtonSelector, {state: 'attached', timeout: 15_000});
        await firstServer.click(menuButtonSelector);

        // Click "Copy Link" in the opened menu. The custom selector engine only supports
        // a single trailing :has-text, so try each candidate (id / role+text / button+text,
        // both capitalizations) separately until one resolves.
        const copyLinkCandidates = [
            '#channelCopyLink',
            '[role="menuitem"]:has-text("Copy Link")',
            '[role="menuitem"]:has-text("Copy link")',
            'button:has-text("Copy Link")',
            'button:has-text("Copy link")',
            'a:has-text("Copy Link")',
            'a:has-text("Copy link")',
        ];
        let copyLinkClicked = false;
        const copyLinkDeadline = Date.now() + 15_000;
        while (!copyLinkClicked && Date.now() < copyLinkDeadline) {
            for (const selector of copyLinkCandidates) {
                // ServerView.$ returns the locator only when at least one node matches,
                // and null otherwise — so a non-null result means the item is present.
                const candidate = await firstServer.$(selector);
                if (candidate) {
                    await firstServer.click(selector);
                    copyLinkClicked = true;
                    break;
                }
            }
            if (!copyLinkClicked) {
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
        }
        if (!copyLinkClicked) {
            throw new Error('"Copy Link" item not found in the channel options menu');
        }

        await expect.poll(async () => electronApp.evaluate(({clipboard}) => clipboard.readText()), {
            timeout: 10_000,
            message: 'Copy Link should populate the clipboard with the channel URL',
        }).toContain('/channels/town-square');
    });
});
