// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {
    ensureChannelReady,
    isChannelPostListLoaded,
    isChannelViewLoaded,
    isComposerInteractive,
    prepareInteractiveChannel,
    recoverChannelViewIfNeeded,
    recoverInteractiveChannel,
    recoverServerViewIfNeeded,
    waitForChannelPostListLoaded,
    waitForInteractiveChannel,
    waitForMattermostShell,
    waitForMattermostShellReady,
} from './channelReadiness';
import {
    POST_TEXTBOX_CANDIDATES,
    POST_TEXTBOX_RESOLVER_JS,
    POST_TEXTBOX_SELECTOR,
} from './rendererUtils';
import type {ServerView} from './serverView';

export {
    ensureChannelReady,
    isChannelPostListLoaded,
    isChannelViewLoaded,
    isComposerInteractive,
    prepareInteractiveChannel,
    recoverChannelViewIfNeeded,
    recoverInteractiveChannel,
    recoverServerViewIfNeeded,
    waitForChannelPostListLoaded,
    waitForInteractiveChannel,
    waitForMattermostShell,
    waitForMattermostShellReady,
};

export {POST_TEXTBOX_CANDIDATES, POST_TEXTBOX_SELECTOR};

/** Read the current post textbox contents (textarea value or contenteditable text). */
export async function getPostTextboxValue(win: ServerView): Promise<string> {
    const value = await win.runInRenderer(`
        ${POST_TEXTBOX_RESOLVER_JS}

        const root = __mmResolvePostTextboxRoot();
        if (!root) {
            return '';
        }
        if (root instanceof HTMLTextAreaElement || root instanceof HTMLInputElement) {
            return root.value ?? '';
        }
        return root.innerText || root.textContent || '';
    `, true);

    return (value as string | undefined) ?? '';
}

/** Press a keyboard shortcut on the post textbox. */
export async function pressPostTextboxKey(win: ServerView, key: string): Promise<void> {
    const focused = await win.runInRenderer(`
        ${POST_TEXTBOX_RESOLVER_JS}

        const root = __mmResolvePostTextboxRoot();
        if (!root) {
            return false;
        }
        root.focus?.();
        return true;
    `, true);

    if (!focused) {
        throw new Error('Post textbox not found');
    }

    await win.keyboard.press(key);
}

/**
 * Type into the post textbox, preferring DOM insertion so Slate keeps text nodes.
 */
export async function typeIntoPostTextbox(win: ServerView, text: string): Promise<void> {
    await win.waitForSelector(POST_TEXTBOX_SELECTOR, {timeout: 10_000});
    await win.click(POST_TEXTBOX_SELECTOR);

    const inserted = await win.runInRenderer(`
        const value = ${JSON.stringify(text)};

        ${POST_TEXTBOX_RESOLVER_JS}

        const root = __mmResolvePostTextboxRoot();
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

        ${POST_TEXTBOX_RESOLVER_JS}

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

        const root = __mmResolvePostTextboxRoot();
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

export async function rightClickAtPoint(
    app: ElectronApplication,
    webContentsId: number,
    point: {x: number; y: number},
): Promise<void> {
    await app.evaluate(({webContents}, payload) => {
        const wc = webContents.fromId(payload.id);
        if (!wc || wc.isDestroyed()) {
            throw new Error(`webContents ${payload.id} is not available`);
        }
        wc.focus();
        wc.sendInputEvent({type: 'mouseMove', x: payload.x, y: payload.y});
        wc.sendInputEvent({type: 'mouseDown', x: payload.x, y: payload.y, button: 'right', clickCount: 1});
        wc.sendInputEvent({type: 'mouseUp', x: payload.x, y: payload.y, button: 'right', clickCount: 1});
    }, {id: webContentsId, ...point});
}

export async function listenForNativeContextMenu(app: ElectronApplication, webContentsId: number): Promise<void> {
    await app.evaluate(({webContents}, id) => {
        const previousListener = (global as any).__e2eNativeContextMenuListener as
            | ((event: unknown, params: unknown) => void)
            | undefined;
        const previousWebContentsId = (global as any).__e2eNativeContextMenuListenerWebContentsId as number | undefined;
        if (previousListener && previousWebContentsId != null) {
            const previousWc = webContents.fromId(previousWebContentsId);
            if (previousWc && !previousWc.isDestroyed()) {
                previousWc.off('context-menu', previousListener);
            }
        }

        const wc = webContents.fromId(id);
        if (!wc || wc.isDestroyed()) {
            return;
        }
        delete (global as any).__e2eNativeContextMenu;

        const listener = (_event: unknown, params: unknown) => {
            (global as any).__e2eNativeContextMenu = params;
        };
        (global as any).__e2eNativeContextMenuListener = listener;
        (global as any).__e2eNativeContextMenuListenerWebContentsId = id;
        wc.on('context-menu', listener);
    }, webContentsId);
}

export async function waitForNativeContextMenu(app: ElectronApplication): Promise<Record<string, unknown>> {
    await expect.poll(async () => app.evaluate(() => {
        const params = (global as any).__e2eNativeContextMenu;
        return Boolean(params);
    }), {timeout: 10_000, message: 'Native context menu must open'}).toBe(true);

    return app.evaluate(() => (global as any).__e2eNativeContextMenu as Record<string, unknown>);
}

export async function applySpellcheckSuggestion(
    app: ElectronApplication,
    webContentsId: number,
    suggestion: string,
): Promise<void> {
    await app.evaluate(({webContents}, payload) => {
        const wc = webContents.fromId(payload.id);
        if (!wc || wc.isDestroyed()) {
            throw new Error(`webContents ${payload.id} is not available`);
        }
        wc.replaceMisspelling(payload.suggestion);
    }, {id: webContentsId, suggestion});
}
