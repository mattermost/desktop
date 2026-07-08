// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerView} from './serverView';

export const WEBAPP_MENU_ITEM_SELECTOR = '[role="menuitem"], .MenuItem';

export const RHS_THREAD_MENU_BUTTON_SELECTOR = [
    '.ThreadViewer button[aria-label*="menu" i]',
    '.sidebar-right button[aria-label*="menu" i]',
    'button[aria-label*="more actions" i]',
].join(', ');

export const THREADS_LIST_MENU_BUTTON_SELECTOR = [
    '.ThreadPane button[aria-label*="menu" i]',
    '.threads-list button[aria-label*="menu" i]',
].join(', ');

type LabelPattern = string | RegExp;

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializeLabelPattern(label: LabelPattern): {source: string; flags: string} {
    if (label instanceof RegExp) {
        return {source: label.source, flags: label.flags};
    }
    return {source: escapeRegExp(label), flags: 'i'};
}

function labelMatchJs(label: LabelPattern, textExpression: string): string {
    const pattern = serializeLabelPattern(label);
    return `new RegExp(${JSON.stringify(pattern.source)}, ${JSON.stringify(pattern.flags)}).test(${textExpression})`;
}

/** Click a visible webapp menu item whose label matches `label`. Assumes a menu is already open. */
export async function clickWebappMenuItemByLabel(
    win: ServerView,
    label: LabelPattern,
    options?: {menuItemSelector?: string},
): Promise<boolean> {
    const menuItemSelector = options?.menuItemSelector ?? WEBAPP_MENU_ITEM_SELECTOR;
    const matchJs = labelMatchJs(label, '(item.textContent || \'\').trim()');

    return win.runInRenderer<boolean>(`
        const items = Array.from(document.querySelectorAll(${JSON.stringify(menuItemSelector)}));
        const visible = items.filter((item) => {
            const rect = item.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        const target = visible.find((item) => ${matchJs});
        if (!target) {
            return false;
        }
        target.click();
        return true;
    `, true);
}

/**
 * Open a webapp menu via `menuButtonSelector`, then click the item matching `label`.
 */
export async function openMenuAndClickLabeledItem(
    win: ServerView,
    menuButtonSelector: string,
    label: LabelPattern,
    options?: {pickLastMenuButton?: boolean; menuItemSelector?: string},
): Promise<boolean> {
    const menuItemSelector = options?.menuItemSelector ?? WEBAPP_MENU_ITEM_SELECTOR;
    const pickLast = options?.pickLastMenuButton ?? false;
    const matchJs = labelMatchJs(label, '(item.textContent || \'\').trim()');

    return win.runInRenderer<boolean>(`
        const menus = document.querySelectorAll(${JSON.stringify(menuButtonSelector)});
        const menuButton = menus.length ? menus[${pickLast ? 'menus.length - 1' : '0'}] : null;
        if (!menuButton) {
            return false;
        }
        menuButton.click();
        const items = Array.from(document.querySelectorAll(${JSON.stringify(menuItemSelector)}));
        const visible = items.filter((item) => {
            const rect = item.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        const openItem = visible.find((item) => ${matchJs});
        if (!openItem) {
            return false;
        }
        openItem.click();
        return true;
    `, true);
}

/** Click "Open in New Window" in an already-open channel or sidebar menu. */
export async function clickOpenInNewWindowMenuItem(win: ServerView): Promise<boolean> {
    return win.runInRenderer<boolean>(`
        const items = Array.from(document.querySelectorAll('[role="menuitem"], .MenuItem'));
        const visible = items.filter((item) => {
            const rect = item.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        const matches = visible.filter((item) => /open in new window/i.test((item.textContent || '').trim()));
        const target = matches[matches.length - 1];
        if (!target) {
            return false;
        }
        target.click();
        return true;
    `, true);
}

/** Open the RHS thread menu and choose "Open in New Window". */
export async function clickOpenInNewWindowFromRhsThreadMenu(win: ServerView): Promise<boolean> {
    return openMenuAndClickLabeledItem(win, RHS_THREAD_MENU_BUTTON_SELECTOR, /open in new window/i, {
        pickLastMenuButton: true,
    });
}

/** Open the global threads list menu and choose "Open in New Window". */
export async function clickOpenInNewWindowFromThreadsListMenu(win: ServerView): Promise<boolean> {
    return openMenuAndClickLabeledItem(win, THREADS_LIST_MENU_BUTTON_SELECTOR, /open in new window/i);
}
