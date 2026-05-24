// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    installRawSlashCommandShortcut,
    setRawSlashCommandShortcutEnabled,
} from './rawSlashCommandShortcut';

type FetchResponse = {
    ok: boolean;
    status?: number;
};

describe('rawSlashCommandShortcut', () => {
    const globalWithWindow = global as unknown as {window?: Window};
    const originalWindow = globalWithWindow.window;
    let keydownListener: ((event: KeyboardEvent) => void) | undefined;

    const makeTextbox = (props: Partial<HTMLTextAreaElement> = {}) => ({
        id: 'post_textbox',
        value: '',
        disabled: false,
        readOnly: false,
        dispatchEvent: jest.fn(),
        ...props,
    }) as unknown as HTMLTextAreaElement;

    const addReactFiber = (textbox: HTMLTextAreaElement, memoizedProps: Record<string, string>, returnFiber?: Record<string, unknown>) => {
        Object.defineProperty(textbox, '__reactFiber$test', {
            value: {
                memoizedProps,
                return: returnFiber,
            },
        });
    };

    const installShortcut = (platform: NodeJS.Platform = 'darwin', response: FetchResponse = {ok: true}) => {
        keydownListener = undefined;
        const fetch = jest.fn().mockResolvedValue(response);
        globalWithWindow.window = {
            addEventListener: jest.fn((eventName: string, listener: (event: KeyboardEvent) => void) => {
                if (eventName === 'keydown') {
                    keydownListener = listener;
                }
            }),
            fetch,
        } as unknown as Window;

        installRawSlashCommandShortcut(platform);

        return fetch;
    };

    const dispatchShortcut = async (textbox: HTMLTextAreaElement, eventOverrides: Partial<KeyboardEvent> = {}) => {
        const event = {
            key: 'Enter',
            metaKey: true,
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn(),
            target: textbox,
            ...eventOverrides,
        } as unknown as KeyboardEvent;

        expect(keydownListener).toBeDefined();
        keydownListener?.(event);
        await Promise.resolve();
        await Promise.resolve();

        return event;
    };

    afterEach(() => {
        if (originalWindow) {
            globalWithWindow.window = originalWindow;
        } else {
            delete globalWithWindow.window;
        }
    });

    it('should send an enabled slash message through the posts API', async () => {
        const fetch = installShortcut();
        setRawSlashCommandShortcutEnabled(true);

        const textbox = makeTextbox({value: '/openclaw status'});
        addReactFiber(textbox, {
            channelId: 'channel-id',
            rootId: '',
        });

        const event = await dispatchShortcut(textbox);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopImmediatePropagation).toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith('/api/v4/posts', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                channel_id: 'channel-id',
                message: '/openclaw status',
            }),
        });
        expect(textbox.value).toBe('');
        expect(textbox.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({type: 'input'}));
    });

    it('should only handle enabled modifier-enter events on slash messages', async () => {
        const fetch = installShortcut();
        const textbox = makeTextbox({value: '/openclaw status'});
        addReactFiber(textbox, {
            channelId: 'channel-id',
            rootId: '',
        });

        await dispatchShortcut(textbox);
        expect(fetch).not.toHaveBeenCalled();

        setRawSlashCommandShortcutEnabled(true);
        textbox.value = 'hello';
        await dispatchShortcut(textbox);
        expect(fetch).not.toHaveBeenCalled();

        textbox.value = '/openclaw status';
        await dispatchShortcut(textbox, {metaKey: false});
        expect(fetch).not.toHaveBeenCalled();
    });

    it('should support Ctrl+Enter on non-macOS and preserve thread root IDs', async () => {
        const fetch = installShortcut('win32');
        setRawSlashCommandShortcutEnabled(true);

        const textbox = makeTextbox({
            id: 'reply_textbox',
            value: '/hermes summarize',
        });
        addReactFiber(textbox, {}, {
            memoizedProps: {
                channelId: 'channel-id',
                rootId: 'root-id',
            },
        });

        await dispatchShortcut(textbox, {
            ctrlKey: true,
            metaKey: false,
        });

        expect(fetch).toHaveBeenCalledWith('/api/v4/posts', expect.objectContaining({
            body: JSON.stringify({
                channel_id: 'channel-id',
                message: '/hermes summarize',
                root_id: 'root-id',
            }),
        }));
    });

    it('should not bypass webapp handling when a draft has unsupported state', async () => {
        const fetch = installShortcut();
        setRawSlashCommandShortcutEnabled(true);

        const form = {
            querySelector: jest.fn().mockReturnValue({}),
        };
        const textbox = makeTextbox({
            value: '/openclaw status',
            closest: jest.fn().mockReturnValue(form),
        });
        addReactFiber(textbox, {
            channelId: 'channel-id',
            rootId: '',
        });

        const event = await dispatchShortcut(textbox);

        expect(form.querySelector).toHaveBeenCalledWith('.file-preview__container, .AdvancedTextEditor__labels');
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('should keep the textbox contents when the posts API fails', async () => {
        const fetch = installShortcut('darwin', {ok: false, status: 403});
        const warn = jest.spyOn(console, 'warn').mockImplementation();
        setRawSlashCommandShortcutEnabled(true);

        const textbox = makeTextbox({value: '/hermes summarize'});
        addReactFiber(textbox, {
            channelId: 'channel-id',
            rootId: '',
        });

        await dispatchShortcut(textbox);

        expect(fetch).toHaveBeenCalled();
        expect(textbox.value).toBe('/hermes summarize');
        expect(warn).toHaveBeenCalledWith('Failed to send raw slash command message', expect.any(Error));

        warn.mockRestore();
    });
});
