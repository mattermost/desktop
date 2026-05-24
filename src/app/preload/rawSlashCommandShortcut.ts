// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type Platform = NodeJS.Platform;

export function setRawSlashCommandShortcutEnabled(enabled: boolean) {
    const enabledKey = '__mattermostDesktopRawSlashCommandShortcutEnabled';
    (window as unknown as Record<string, boolean>)[enabledKey] = enabled;
}

export function installRawSlashCommandShortcut(platform: Platform) {
    const enabledKey = '__mattermostDesktopRawSlashCommandShortcutEnabled';
    const installedKey = '__mattermostDesktopRawSlashCommandShortcutInstalled';
    const postTextboxId = 'post_textbox';
    const replyTextboxId = 'reply_textbox';
    const reactFiberKeyPrefix = '__reactFiber$';
    const state = window as unknown as Record<string, boolean>;

    if (state[installedKey]) {
        return;
    }
    state[installedKey] = true;
    state[enabledKey] = false;

    type MainWorldReactFiber = {
        memoizedProps?: {
            channelId?: string;
            rootId?: string;
        };
        return?: MainWorldReactFiber | null;
    };

    const isTextbox = (element: unknown): element is HTMLTextAreaElement => Boolean(
        element &&
        typeof element === 'object' &&
        'id' in element &&
        'value' in element,
    );

    const hasUnsupportedDraftState = (textbox: HTMLTextAreaElement) => {
        const form = textbox.closest?.('form');
        return Boolean(form?.querySelector('.file-preview__container, .AdvancedTextEditor__labels'));
    };

    const isMattermostComposeTextbox = (textbox: HTMLTextAreaElement) => (
        (textbox.id === postTextboxId || textbox.id === replyTextboxId) &&
        !textbox.disabled &&
        !textbox.readOnly &&
        !hasUnsupportedDraftState(textbox)
    );

    const isCmdOrCtrlEnter = (event: KeyboardEvent) => {
        if (event.key !== 'Enter') {
            return false;
        }

        return platform === 'darwin' ? event.metaKey : event.ctrlKey;
    };

    const getReactFiber = (element: HTMLTextAreaElement): MainWorldReactFiber | undefined => {
        const fiberKey = Object.getOwnPropertyNames(element).find((key) => key.startsWith(reactFiberKeyPrefix));
        if (!fiberKey) {
            return undefined;
        }

        return (element as unknown as Record<string, MainWorldReactFiber | undefined>)[fiberKey];
    };

    const getPostContextFromTextbox = (textbox: HTMLTextAreaElement) => {
        let fiber = getReactFiber(textbox);
        while (fiber) {
            const {channelId, rootId = ''} = fiber.memoizedProps ?? {};
            if (channelId) {
                return {channelId, rootId};
            }
            fiber = fiber.return ?? undefined;
        }

        return null;
    };

    const clearTextbox = (textbox: HTMLTextAreaElement) => {
        textbox.value = '';
        textbox.dispatchEvent(new Event('input', {bubbles: true}));
    };

    const submitRawSlashCommandFromTextbox = async (textbox: HTMLTextAreaElement, context: {channelId: string; rootId: string}) => {
        const post: Record<string, string> = {
            channel_id: context.channelId,
            message: textbox.value,
        };
        if (context.rootId) {
            post.root_id = context.rootId;
        }

        const response = await window.fetch('/api/v4/posts', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(post),
        });

        if (!response.ok) {
            throw new Error(`Unable to send raw slash command message: ${response.status ?? 'unknown'}`);
        }

        clearTextbox(textbox);
    };

    window.addEventListener('keydown', (event) => {
        const textbox = isTextbox(event.target) ? event.target : null;
        if (!state[enabledKey] ||
            !textbox ||
            !isMattermostComposeTextbox(textbox) ||
            !textbox.value.startsWith('/') ||
            !isCmdOrCtrlEnter(event)) {
            return;
        }

        const context = getPostContextFromTextbox(textbox);
        if (!context) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        submitRawSlashCommandFromTextbox(textbox, context).catch((error) => {
            console.warn('Failed to send raw slash command message', error);
        });
    }, true);
}
