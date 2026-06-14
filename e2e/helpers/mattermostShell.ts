// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import type {ServerView} from './serverView';

/**
 * Wait until the Mattermost webapp shell is interactive in a server view.
 */
export async function waitForMattermostShell(
    win: ServerView,
    options?: {channelItem?: string; timeout?: number},
) {
    const channelItem = options?.channelItem ?? '#sidebarItem_town-square';
    const timeout = options?.timeout ?? 60_000;

    await expect.poll(async () => {
        try {
            await win.waitForSelector(channelItem, {timeout: 2_000});
            return true;
        } catch {
            return false;
        }
    }, {timeout, message: `Mattermost shell must expose ${channelItem}`}).toBe(true);
}

/**
 * Return viewport coordinates for a word inside the post textbox.
 * Used for native spell-check context menus, which require clicking on text.
 */
export async function getPostTextboxWordPoint(
    win: ServerView,
    word: string,
): Promise<{x: number; y: number} | null> {
    return win.runInRenderer(`
        const target = ${JSON.stringify(word)};
        const editor = document.querySelector(
            '#post_textbox, [data-testid="post_textbox"], [role="textbox"]',
        );
        if (!editor) {
            return null;
        }

        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
            const text = node.textContent || '';
            const index = text.indexOf(target);
            if (index >= 0) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + target.length);
                const rect = range.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    return {
                        x: Math.round(rect.left + (rect.width / 2)),
                        y: Math.round(rect.top + (rect.height / 2)),
                    };
                }
            }
            node = walker.nextNode();
        }
        return null;
    `);
}
