// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import type {ServerView} from './serverView';

const CHANNEL_HEADER_MENU_TRIGGER = [
    'button[aria-label*="channel menu" i]',
    '#channelHeaderDropdownButton',
    'button[aria-controls="channelHeaderDropdownMenu"]',
    '#channelHeaderTitle button',
].join(', ');

export const COPY_LINK_SELECTORS = [
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

const SIDEBAR_CHANNEL_MENU_BUTTON = (channelItemSelector: string) => [
    `${channelItemSelector} button[aria-label*="channel menu" i]`,
    `${channelItemSelector} button[aria-label*="channel options" i]`,
    `${channelItemSelector} button[aria-label*="options" i]`,
    `${channelItemSelector} button.SidebarMenu_menuButton`,
    `${channelItemSelector} .SidebarMenu button`,
    `${channelItemSelector} [data-testid="channel-options-dropdown"]`,
].join(', ');

/**
 * Open the per-channel sidebar options ("⋮") menu for a sidebar row.
 * The trigger is hover-gated in the webapp; use native mouseMove so Electron
 * updates :hover state (synthetic dispatchEvent is ignored on macOS/Windows).
 */
export async function openSidebarChannelMenu(win: ServerView, channelItemSelector: string): Promise<void> {
    await win.waitForSelector(channelItemSelector, {timeout: 15_000});

    const menuButtonSelector = SIDEBAR_CHANNEL_MENU_BUTTON(channelItemSelector);

    const hoverPoint = await win.runInRenderer(`
        const el = document.querySelector(${JSON.stringify(channelItemSelector)});
        if (!el) {
            return null;
        }
        el.scrollIntoView({block: 'center', inline: 'center'});
        const rect = el.getBoundingClientRect();
        return {
            x: Math.round(rect.right - 8),
            y: Math.round(rect.top + (rect.height / 2)),
        };
    `, true);
    expect(hoverPoint, `Channel sidebar item must exist: ${channelItemSelector}`).toBeTruthy();

    await win.app.evaluate(({webContents}, payload) => {
        const wc = webContents.fromId(payload.id);
        if (!wc || wc.isDestroyed()) {
            throw new Error(`webContents ${payload.id} is not available`);
        }
        wc.focus();
        wc.sendInputEvent({type: 'mouseMove', x: payload.x, y: payload.y});
    }, {id: win.webContentsId, ...hoverPoint!});

    await win.waitForSelector(menuButtonSelector, {state: 'visible', timeout: 15_000});
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
    throw new Error('"Copy Link" item became unavailable before it could be clicked');
}

/**
 * Enable the channel bookmarks bar via the channel header menu.
 * Bookmarks saved while the bar is hidden may not appear in the bar UI.
 *
 * The bar container is not rendered until at least one bookmark exists, so this
 * helper only toggles the preference — callers wait for bookmark items later.
 */
export async function enableBookmarksBar(win: ServerView): Promise<void> {
    const alreadyVisible = await win.runInRenderer(`
        const container = document.querySelector('[data-testid="channel-bookmarks-container"]');
        if (!container) {
            return false;
        }
        const rect = container.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    `);
    if (alreadyVisible) {
        return;
    }

    await openChannelHeaderMenu(win);
    const toggled = await win.runInRenderer(`
        const items = Array.from(document.querySelectorAll(
            '[role="menuitem"], .MenuItem, [id^="channel-menu-"]',
        ));
        const barItem = items.find((item) => /bookmarks bar/i.test((item.textContent || '').trim()));
        if (!barItem) {
            return false;
        }
        const label = (barItem.textContent || '').trim().toLowerCase();
        const checked = barItem.getAttribute('aria-checked');
        if (label.includes('hide') || checked === 'true') {
            return true;
        }
        if (!label.includes('show') && checked !== 'false') {
            return false;
        }
        barItem.click();
        return true;
    `, true);
    if (!toggled) {
        throw new Error('Bookmarks Bar menu item not found in channel header menu');
    }
    await win.keyboard.press('Escape');
}

export const TEAM_SIDEBAR_BUTTON = [
    '#teamSidebarWrapper [id$="TeamButton"]',
    '#teamSidebar button[class*="TeamButton"]',
    'button[aria-label$=" team"]',
].join(', ');

const TEAM_MENU_ITEM_SELECTORS = [
    '.Menu .MenuItem',
    '[role="menuitem"]',
    '.dropdown-menu .MenuItem',
    '#teamMenu .MenuItem',
];

/**
 * Right-click a team sidebar button using native input events.
 * Desktop app shows Chromium's native context menu here (not webapp .Menu).
 */
export async function openTeamSidebarContextMenu(
    win: ServerView,
    app: ElectronApplication,
    webContentsId: number,
): Promise<void> {
    await win.waitForSelector(TEAM_SIDEBAR_BUTTON, {timeout: 15_000});
    const point = await win.runInRenderer(`
        const selectors = ${JSON.stringify(TEAM_SIDEBAR_BUTTON.split(', '))};
        let buttons = [];
        for (const selector of selectors) {
            buttons = Array.from(document.querySelectorAll(selector));
            if (buttons.length > 0) {
                break;
            }
        }
        // Prefer the second match when multiple team buttons exist: the first is
        // usually the active team or add-team control; ensureMultipleTeams adds a
        // second team whose native context menu this spec exercises.
        const target = buttons.length > 1 ? buttons[1] : buttons[0];
        if (!target) {
            return null;
        }
        target.scrollIntoView({block: 'center', inline: 'center'});
        const rect = target.getBoundingClientRect();
        return {
            x: Math.round(rect.left + (rect.width / 2)),
            y: Math.round(rect.top + (rect.height / 2)),
        };
    `, true);
    expect(point, 'Team sidebar button must be available for context menu').toBeTruthy();

    await app.evaluate(({webContents}, payload) => {
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
    }, {id: webContentsId, ...point!});
}

/** Register a listener for Chromium's native context-menu event on a server view. */
export async function listenForNativeContextMenu(
    app: ElectronApplication,
    webContentsId: number,
): Promise<void> {
    await app.evaluate(({webContents}, id) => {
        const wc = webContents.fromId(id);
        if (!wc || wc.isDestroyed()) {
            return;
        }
        delete (global as any).__e2eNativeContextMenu;

        const previousListener = (global as any).__e2eNativeContextMenuListener as
            | ((event: unknown, params: unknown) => void)
            | undefined;
        if (previousListener) {
            wc.off('context-menu', previousListener);
        }

        const listener = (_event: unknown, params: unknown) => {
            (global as any).__e2eNativeContextMenu = params;
        };
        (global as any).__e2eNativeContextMenuListener = listener;
        wc.on('context-menu', listener);
    }, webContentsId);
}

/** Poll until Chromium reports a native context menu for the server view. */
export async function waitForNativeContextMenu(app: ElectronApplication): Promise<void> {
    await expect.poll(async () => app.evaluate(() => {
        const params = (global as any).__e2eNativeContextMenu;
        return Boolean(params);
    }), {timeout: 10_000, message: 'Native context menu must open on team right-click'}).toBe(true);
}

/** Poll until a webapp menu item is visible (channel sidebar menus). */
export async function waitForWebappContextMenu(win: ServerView): Promise<void> {
    await expect.poll(async () => win.runInRenderer(`
        const selectors = ${JSON.stringify(TEAM_MENU_ITEM_SELECTORS)};
        return selectors.some((selector) => {
            const items = Array.from(document.querySelectorAll(selector));
            return items.some((item) => {
                const rect = item.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
        });
    `), {timeout: 10_000, message: 'Webapp context menu must appear'}).toBe(true);
}

/** Selectors for channel bookmark bar items (webapp varies by version). */
export const BOOKMARK_BAR_LINK_SELECTORS = [
    'a[href*="utm_content=channel_bookmarks.item"]',
    '[data-testid="channel-bookmarks-container"] [data-testid^="bookmark-item-"] a',
    '[data-testid="channel-bookmarks-container"] a[href]',
    '#channelBookmarksContainer a[href]',
];

export const BOOKMARK_BAR_ITEM_SELECTORS = [
    'a[href*="utm_content=channel_bookmarks.item"]',
    '[data-testid="channel-bookmarks-container"] [data-testid^="bookmark-item-"]',
    '[data-testid="channel-bookmarks-container"] a[href]',
    '#channelBookmarksContainer [data-testid^="bookmark-item-"]',
];

/** Poll until a bookmark item appears in the channel bookmarks bar. */
export async function waitForBookmarkInBar(win: ServerView, urlPart?: string): Promise<void> {
    await expect.poll(async () => win.runInRenderer(`
        const selectors = ${JSON.stringify(BOOKMARK_BAR_LINK_SELECTORS)};
        const needle = ${JSON.stringify(urlPart ?? '')};
        const links = [];
        for (const selector of selectors) {
            links.push(...document.querySelectorAll(selector));
        }
        const visible = links.filter((link) => {
            const rect = link.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        if (!needle) {
            return visible.length > 0;
        }
        return visible.some((link) => link.href.includes(needle));
    `), {timeout: 30_000, message: 'Bookmark item must appear in the channel bookmarks bar'}).toBe(true);
}

/** Click a bookmark link in the channel bookmarks bar. */
export async function clickBookmarkInBar(win: ServerView, urlPart: string): Promise<void> {
    const clicked = await win.runInRenderer(`
        const needle = ${JSON.stringify(urlPart)};
        const selectors = ${JSON.stringify(BOOKMARK_BAR_LINK_SELECTORS)};
        const links = [];
        for (const selector of selectors) {
            links.push(...document.querySelectorAll(selector));
        }
        const target = [...links].reverse().find((link) => {
            const rect = link.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && link.href.includes(needle);
        });
        if (!target) {
            return false;
        }
        target.scrollIntoView({block: 'center', inline: 'center'});
        target.click();
        return true;
    `, true);
    expect(clicked, `Bookmark link containing "${urlPart}" must be clickable`).toBe(true);
}

/** Delete every bookmark currently shown in the channel bookmarks bar. */
export async function deleteAllBookmarksInBar(win: ServerView): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const hasBookmark = await win.runInRenderer(`
            const selectors = ${JSON.stringify(BOOKMARK_BAR_LINK_SELECTORS)};
            return selectors.some((selector) => document.querySelector(selector));
        `);
        if (!hasBookmark) {
            return;
        }

        // The dot-menu trigger is only rendered while the bookmark item is hovered.
        // Between `hoverBookmarkInBar()` and `win.click(...)` the renderer can unmount
        // the trigger (hover lost, animation, or stale React subtree from a previous
        // delete), producing "Element not found for click". Re-hover and click within
        // a single renderer round-trip so the element can't disappear between the
        // existence check and the click; on transient failure, retry the loop and
        // re-check `hasBookmark` — if the item is already gone, we're done.
        const clicked = await win.runInRenderer(`
            const selectors = ${JSON.stringify(BOOKMARK_BAR_ITEM_SELECTORS)};
            let item = null;
            for (const selector of selectors) {
                item = document.querySelector(selector);
                if (item) {
                    break;
                }
            }
            if (!item) {
                return false;
            }
            item.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
            item.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            const trigger = document.querySelector('[id^="channelBookmarksDotMenuButton-"]');
            if (!trigger) {
                return false;
            }
            trigger.click();
            return true;
        `, true);
        if (!clicked) {
            await sleep(200);
            continue;
        }

        try {
            await win.waitForSelector('#channelBookmarksDelete', {state: 'visible', timeout: 5_000});
            await win.click('#channelBookmarksDelete');
            await win.waitForSelector('.GenericModal', {state: 'visible', timeout: 5_000});
            await win.click('button:has-text("Yes, delete")');
            await win.waitForSelector('.GenericModal', {state: 'hidden', timeout: 5_000}).catch(() => {});
        } catch {
            // Menu/modal closed before we could finish the chain — re-loop and let
            // the `hasBookmark` probe decide whether the bookmark was actually deleted.
            await sleep(200);
        }
    }

    throw new Error('Failed to delete all bookmarks in the channel bookmarks bar after 10 attempts');
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Hover the first bookmark item so its dot-menu trigger is reachable. */
export async function hoverBookmarkInBar(win: ServerView): Promise<void> {
    await win.runInRenderer(`
        const selectors = ${JSON.stringify(BOOKMARK_BAR_ITEM_SELECTORS)};
        let item = null;
        for (const selector of selectors) {
            item = document.querySelector(selector);
            if (item) {
                break;
            }
        }
        if (!item) {
            return false;
        }
        item.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
        item.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        return true;
    `, true);
}

export async function submitBookmarkModal(win: ServerView): Promise<void> {
    await expect.poll(async () => win.runInRenderer(`
        const buttons = Array.from(document.querySelectorAll(
            '.GenericModal button, .GenericModal .GenericModal__button',
        ));
        const save = buttons.find((button) => {
            const label = (button.textContent || '').trim().toLowerCase();
            return label.includes('add bookmark')
                || (label.includes('save') && !label.includes('cancel'));
        });
        return Boolean(save && (!(save instanceof HTMLButtonElement) || !save.disabled));
    `), {timeout: 15_000, message: 'Bookmark modal save button must become enabled'}).toBe(true);

    const clicked = await win.runInRenderer(`
        const buttons = Array.from(document.querySelectorAll(
            '.GenericModal button, .GenericModal .GenericModal__button',
        ));
        const save = buttons.find((button) => {
            const label = (button.textContent || '').trim().toLowerCase();
            return label.includes('add bookmark')
                || (label.includes('save') && !label.includes('cancel'));
        });
        if (!save || (save instanceof HTMLButtonElement && save.disabled)) {
            return false;
        }
        save.click();
        return true;
    `, true);
    expect(clicked, 'Bookmark modal save button must be clicked').toBe(true);
    await win.waitForSelector('[data-testid="linkInput"]', {state: 'detached', timeout: 15_000});
}
