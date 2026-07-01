// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import type {ServerView} from './serverView';

export const POST_TEXTBOX_CANDIDATES = [
    '[data-slate-editor="true"]',
    '#post_textbox[contenteditable="true"]',
    '[data-testid="post_textbox"][contenteditable="true"]',
    '#post_textbox',
    '[data-testid="post_textbox"]',
    '.post-create__input [contenteditable="true"]',
    '.post-create__input [role="textbox"]',
    '.AdvancedTextEditor [contenteditable="true"]',
    '[role="textbox"][contenteditable="true"]',
    'textarea#post_textbox',
] as const;

export const POST_TEXTBOX_SELECTOR = POST_TEXTBOX_CANDIDATES.join(', ');

const POST_TEXTBOX_CANDIDATES_JSON = JSON.stringify(POST_TEXTBOX_CANDIDATES);

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
 * Reload the server view when the channel shell failed to mount (blank hex background).
 */
export async function recoverServerViewIfNeeded(
    win: ServerView,
    options?: {channelItem?: string},
) {
    const channelItem = options?.channelItem ?? '#sidebarItem_town-square';
    const healthy = await win.runInRenderer(`
        return Boolean(
            document.querySelector('#channelHeaderTitle')
            && document.querySelector(${JSON.stringify(channelItem)}),
        );
    `).catch(() => false);

    if (healthy) {
        return;
    }

    await win.runInRenderer('window.location.reload(); return true;', true);
    await waitForMattermostShell(win, {channelItem});
}

/** Wait until the channel post list finishes its initial load. */
export async function waitForChannelPostListLoaded(
    win: ServerView,
    options?: {timeout?: number},
): Promise<void> {
    const timeout = options?.timeout ?? 15_000;
    await expect.poll(
        async () => win.evaluate(() => !document.querySelector(
            '.post-list__loading, .post-list__dynamic-loading, .loading-screen',
        )),
        {timeout, message: 'Channel post list must finish loading'},
    ).toBe(true);
}

/** Read the current post textbox contents (textarea value or contenteditable text). */
export async function getPostTextboxValue(win: ServerView): Promise<string> {
    return win.runInRenderer(`
        const isVisible = (element) => {
            if (!element || !element.isConnected) {
                return false;
            }
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };

        const candidates = ${POST_TEXTBOX_CANDIDATES_JSON}.map((selector) => document.querySelector(selector)).filter(Boolean);

        for (const candidate of candidates) {
            if (!isVisible(candidate)) {
                continue;
            }
            const root = candidate.matches('[contenteditable="true"], textarea, input')
                ? candidate
                : candidate.querySelector('[contenteditable="true"], textarea, input');
            if (!root || !isVisible(root)) {
                continue;
            }
            if (root instanceof HTMLTextAreaElement || root instanceof HTMLInputElement) {
                return root.value ?? '';
            }
            return root.innerText || root.textContent || '';
        }
        return '';
    `, true) ?? '';
}

/** Press a keyboard shortcut on the post textbox. */
export async function pressPostTextboxKey(win: ServerView, key: string): Promise<void> {
    await win.waitForSelector(POST_TEXTBOX_SELECTOR, {timeout: 10_000});
    await win.press(POST_TEXTBOX_SELECTOR, key);
}

/**
 * Type into the post textbox, preferring DOM insertion so Slate keeps text nodes.
 */
export async function typeIntoPostTextbox(win: ServerView, text: string): Promise<void> {
    await win.waitForSelector(POST_TEXTBOX_SELECTOR, {timeout: 10_000});
    await win.click(POST_TEXTBOX_SELECTOR);

    const inserted = await win.runInRenderer(`
        const value = ${JSON.stringify(text)};

        const isVisible = (element) => {
            if (!element || !element.isConnected) {
                return false;
            }
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };

        const candidates = ${POST_TEXTBOX_CANDIDATES_JSON}.map((selector) => document.querySelector(selector)).filter(Boolean);

        let root = null;
        for (const candidate of candidates) {
            if (!isVisible(candidate)) {
                continue;
            }
            if (candidate.matches('[contenteditable="true"], textarea, input')) {
                root = candidate;
                break;
            }
            const nested = candidate.querySelector('[contenteditable="true"], textarea, input');
            if (nested && isVisible(nested)) {
                root = nested;
                break;
            }
        }

        if (!root) {
            return false;
        }

        root.focus?.();
        root.setAttribute('spellcheck', 'true');

        if (root instanceof HTMLTextAreaElement || root instanceof HTMLInputElement) {
            const descriptor = Object.getOwnPropertyDescriptor(root.constructor.prototype, 'value');
            descriptor?.set?.call(root, value);
            root.dispatchEvent(new Event('input', {bubbles: true}));
            root.dispatchEvent(new Event('change', {bubbles: true}));
            return root.value.includes(value.slice(0, 8));
        }

        const selection = window.getSelection();
        selection?.removeAllRanges();
        document.execCommand('selectAll', false);
        document.execCommand('delete', false);
        const insertedText = document.execCommand('insertText', false, value);
        root.dispatchEvent(new InputEvent('input', {bubbles: true, data: value, inputType: 'insertText'}));
        const content = root.innerText || root.textContent || '';
        return insertedText && content.includes(value.slice(0, 8));
    `, true);

    if (!inserted) {
        const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
        await win.keyboard.press(`${mod}+A`);
        await win.keyboard.press('Backspace');
        await win.keyboard.type(text);
    }
}

/**
 * Select a word in the post textbox and return viewport coordinates for it.
 * Native spell-check menus require the right-click to land on misspelled text.
 */
export async function getPostTextboxWordPoint(
    win: ServerView,
    word: string,
): Promise<{x: number; y: number} | null> {
    return win.runInRenderer(`
        const target = ${JSON.stringify(word)};

        const isVisible = (element) => {
            if (!element || !element.isConnected) {
                return false;
            }
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };

        const resolveEditor = () => {
            const candidates = ${POST_TEXTBOX_CANDIDATES_JSON}.map((selector) => document.querySelector(selector)).filter(Boolean);

            for (const candidate of candidates) {
                if (!isVisible(candidate)) {
                    continue;
                }
                if (candidate.matches('[contenteditable="true"], textarea, input')) {
                    return candidate;
                }
                const nested = candidate.querySelector('[contenteditable="true"], textarea, input');
                if (nested && isVisible(nested)) {
                    return nested;
                }
            }
            return null;
        };

        const getTextareaWordPoint = (textarea, needle) => {
            const text = textarea.value || '';
            const index = text.indexOf(needle);
            if (index < 0) {
                return null;
            }

            textarea.focus();
            textarea.setSelectionRange(index, index + needle.length);

            const mirror = document.createElement('div');
            const properties = [
                'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
                'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
                'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
                'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
                'fontSizeAdjust', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform',
                'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing', 'whiteSpace',
            ];
            const computed = window.getComputedStyle(textarea);
            mirror.style.position = 'absolute';
            mirror.style.visibility = 'hidden';
            mirror.style.top = '0';
            mirror.style.left = '0';
            mirror.style.whiteSpace = 'pre-wrap';
            mirror.style.wordWrap = 'break-word';
            for (const property of properties) {
                mirror.style[property] = computed[property];
            }
            mirror.style.width = computed.width;
            mirror.textContent = text.slice(0, index);
            const marker = document.createElement('span');
            marker.textContent = text.slice(index, index + needle.length) || '.';
            mirror.appendChild(marker);
            document.body.appendChild(mirror);
            const mirrorRect = mirror.getBoundingClientRect();
            const markerRect = marker.getBoundingClientRect();
            const textareaRect = textarea.getBoundingClientRect();
            document.body.removeChild(mirror);

            // markerRect is relative to the mirror (anchored at 0,0 in body coords),
            // so (markerRect - mirrorRect) gives the offset inside the mirror. Add that
            // to the textarea's viewport position and subtract scroll for the final point.
            return {
                x: Math.round(
                    textareaRect.left + (markerRect.left - mirrorRect.left) - textarea.scrollLeft + (markerRect.width / 2),
                ),
                y: Math.round(
                    textareaRect.top + (markerRect.top - mirrorRect.top) - textarea.scrollTop + (markerRect.height / 2),
                ),
            };
        };

        const findRangeInRoot = (root, needle) => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
                const text = node.textContent || '';
                const index = text.indexOf(needle);
                if (index >= 0) {
                    const range = document.createRange();
                    range.setStart(node, index);
                    range.setEnd(node, index + needle.length);
                    const rect = range.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        return {range, rect};
                    }
                }
                node = walker.nextNode();
            }
            return null;
        };

        const root = resolveEditor();
        if (!root) {
            return null;
        }

        root.setAttribute('spellcheck', 'true');

        if (root instanceof HTMLTextAreaElement || root instanceof HTMLInputElement) {
            return getTextareaWordPoint(root, target);
        }

        const match = findRangeInRoot(root, target);
        if (!match) {
            const fullText = root.innerText || root.textContent || '';
            const index = fullText.indexOf(target);
            if (index < 0) {
                return null;
            }

            const rect = root.getBoundingClientRect();
            const ratio = (index + (target.length / 2)) / Math.max(fullText.length, 1);
            root.focus?.();
            return {
                x: Math.round(rect.left + Math.min(rect.width * ratio, Math.max(rect.width - 8, 8))),
                y: Math.round(rect.top + Math.max(rect.height * 0.7, 20)),
            };
        }

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(match.range);
        root.focus?.();

        return {
            x: Math.round(match.rect.left + (match.rect.width / 2)),
            y: Math.round(match.rect.top + (match.rect.height / 2)),
        };
    `, true);
}
