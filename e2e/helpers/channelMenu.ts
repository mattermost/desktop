// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerView} from './serverView';

const CHANNEL_HEADER_MENU_TRIGGER = [
    'button[aria-label*="channel menu" i]',
    '#channelHeaderDropdownButton',
    'button[aria-controls="channelHeaderDropdownMenu"]',
    '#channelHeaderTitle button',
].join(', ');

const COPY_LINK_SELECTORS = [
    '#channelCopyLink',
    '[role="menuitem"]:has-text("Copy Link")',
    '[role="menuitem"]:has-text("Copy link")',
    'button:has-text("Copy Link")',
    'button:has-text("Copy link")',
    'a:has-text("Copy Link")',
    'a:has-text("Copy link")',
];

/**
 * Open the channel header ("⋮") menu for the current channel.
 * The webapp migrated from #channelHeaderDropdownButton to Menu.Button
 * with an aria-label like "off-topic channel menu".
 */
export async function openChannelHeaderMenu(win: ServerView): Promise<void> {
    await win.waitForSelector(CHANNEL_HEADER_MENU_TRIGGER, {state: 'visible', timeout: 15_000});
    await win.click(CHANNEL_HEADER_MENU_TRIGGER);
    await win.waitForSelector('#channelHeaderDropdownMenu, .a11y__popup', {timeout: 5_000});
}

/**
 * Open the per-channel sidebar options ("⋮") menu for a sidebar row.
 * The trigger is hover-gated in the webapp, so dispatch pointer events first.
 */
export async function openSidebarChannelMenu(win: ServerView, channelItemSelector: string): Promise<void> {
    await win.waitForSelector(channelItemSelector, {timeout: 15_000});
    await win.evaluate((selector: string) => {
        const el = document.querySelector(selector);
        if (!el) {
            return;
        }
        for (const type of ['pointerover', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']) {
            el.dispatchEvent(new MouseEvent(type, {bubbles: true, cancelable: true}));
        }
    }, channelItemSelector);

    const menuButtonSelector = [
        `${channelItemSelector} button[aria-label*="channel menu" i]`,
        `${channelItemSelector} button[aria-label*="channel options" i]`,
        `${channelItemSelector} button[aria-label*="options" i]`,
        `${channelItemSelector} button.SidebarMenu_menuButton`,
        `${channelItemSelector} .SidebarMenu button`,
    ].join(', ');

    await win.waitForSelector(menuButtonSelector, {state: 'attached', timeout: 15_000});
    await win.click(menuButtonSelector);
    await waitForCopyLinkInMenu(win);
}

/** Poll until a Copy Link item is present in the open webapp menu. */
export async function waitForCopyLinkInMenu(win: ServerView): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        for (const selector of COPY_LINK_SELECTORS) {
            const candidate = await win.$(selector);
            if (candidate) {
                return;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('"Copy Link" item not found in the channel menu');
}

/** Click Copy Link in an already-open channel menu. */
export async function clickCopyLinkInMenu(win: ServerView): Promise<void> {
    await waitForCopyLinkInMenu(win);
    for (const selector of COPY_LINK_SELECTORS) {
        const candidate = await win.$(selector);
        if (candidate) {
            await win.click(selector);
            return;
        }
    }
}
