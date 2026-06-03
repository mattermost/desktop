// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

type WaitForSelectorOptions = {
    timeout?: number;
    state?: 'attached' | 'detached' | 'visible' | 'hidden';
};

type WaitForFunctionOptions = {
    timeout?: number;
    polling?: number;
};

type ClickOptions = {
    button?: 'left' | 'right';
};

type InputFile = {
    name: string;
    mimeType?: string;
    buffer: Buffer;
};

type LocatorDescriptor = {
    steps: Array<{selector: string}>;
    pick?: 'last' | number;
};

const DOM_UTILS = `
const __mmParseSelector = (rawSelector) => {
    const selector = rawSelector.trim();
    const match = selector.match(/^(.*?):has-text\\((['"])(.*)\\2\\)\\s*$/s);
    if (!match) {
        return {css: selector, text: null};
    }
    const css = match[1].trim() || '*';
    return {css, text: match[3]};
};

const __mmQueryWithin = (root, rawSelector) => {
    const {css, text} = __mmParseSelector(rawSelector);
    let elements = Array.from(root.querySelectorAll(css));
    if (text !== null) {
        elements = elements.filter((element) => (element.textContent || '').includes(text));
    }
    return elements;
};

const __mmResolveAll = (descriptor) => {
    let elements = [document];
    for (const step of descriptor.steps) {
        const next = [];
        for (const root of elements) {
            next.push(...__mmQueryWithin(root, step.selector));
        }
        elements = next;
    }

    if (descriptor.pick === 'last') {
        return elements.length > 0 ? [elements[elements.length - 1]] : [];
    }

    if (typeof descriptor.pick === 'number') {
        return elements.slice(descriptor.pick, descriptor.pick + 1);
    }

    return elements;
};

const __mmResolveOne = (descriptor) => __mmResolveAll(descriptor)[0] || null;

const __mmIsVisible = (element) => {
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

const __mmSetElementValue = (element, value) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        const descriptor = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value');
        descriptor?.set?.call(element, value);
        element.dispatchEvent(new Event('input', {bubbles: true}));
        element.dispatchEvent(new Event('change', {bubbles: true}));
        return;
    }

    if (element.isContentEditable) {
        element.textContent = value;
        element.dispatchEvent(new InputEvent('input', {bubbles: true, data: value, inputType: 'insertText'}));
        return;
    }

    throw new Error('Element does not support text input');
};
`;

function isWaitForFunctionOptions(value: unknown): value is WaitForFunctionOptions {
    if (!value || typeof value !== 'object') {
        return false;
    }

    return 'timeout' in value || 'polling' in value;
}

function isLocatorDescriptor(value: unknown): value is LocatorDescriptor {
    if (!value || typeof value !== 'object') {
        return false;
    }

    return Array.isArray((value as LocatorDescriptor).steps);
}

function keyCodeFor(key: string): string {
    const namedKeys: Record<string, string> = {
        ArrowDown: 'Down',
        ArrowLeft: 'Left',
        ArrowRight: 'Right',
        ArrowUp: 'Up',
        Backspace: 'Backspace',
        Delete: 'Delete',
        Enter: 'Enter',
        Escape: 'Escape',
        Space: 'Space',
        Tab: 'Tab',
    };

    if (namedKeys[key]) {
        return namedKeys[key];
    }

    if (key.length === 1) {
        return key.toUpperCase();
    }

    return key;
}

function parseKeyPress(shortcut: string) {
    const parts = shortcut.split('+');
    const key = parts.pop() ?? shortcut;
    const modifiers = parts.map((part) => {
        if (part === 'Meta' || part === 'Command' || part === 'Cmd') {
            return 'meta';
        }
        if (part === 'Control' || part === 'Ctrl') {
            return 'control';
        }
        if (part === 'Alt' || part === 'Option') {
            return 'alt';
        }
        if (part === 'Shift') {
            return 'shift';
        }
        return part.toLowerCase();
    });

    return {
        key,
        keyCode: keyCodeFor(key),
        modifiers,
    };
}

export class ServerLocator {
    private readonly view: ServerView;
    private readonly descriptor: LocatorDescriptor;

    constructor(view: ServerView, descriptor: LocatorDescriptor) {
        this.view = view;
        this.descriptor = descriptor;
    }

    locator(selector: string) {
        return new ServerLocator(this.view, {
            steps: [...this.descriptor.steps, {selector}],
        });
    }

    last() {
        return new ServerLocator(this.view, {
            ...this.descriptor,
            pick: 'last',
        });
    }

    async click(options?: ClickOptions) {
        const button = options?.button ?? 'left';
        if (button === 'right') {
            const point = await this.view.runInRenderer<{x: number; y: number}>(
                `
                ${DOM_UTILS}
                const descriptor = ${JSON.stringify(this.descriptor)};
                const element = __mmResolveOne(descriptor);
                if (!element) {
                    throw new Error('Element not found for click');
                }

                element.scrollIntoView({block: 'center', inline: 'center'});
                element.focus?.();

                const rect = element.getBoundingClientRect();
                return {
                    x: Math.round(rect.left + (rect.width / 2)),
                    y: Math.round(rect.top + (rect.height / 2)),
                };
                `,
                true,
            );

            await this.view.app.evaluate(({webContents}, payload) => {
                const wc = webContents.fromId(payload.id);
                if (!wc || wc.isDestroyed()) {
                    throw new Error(`webContents ${payload.id} is not available`);
                }

                wc.focus();
                wc.sendInputEvent({type: 'mouseMove', x: payload.x, y: payload.y});
                wc.sendInputEvent({type: 'mouseDown', x: payload.x, y: payload.y, button: 'right', clickCount: 1});
                wc.sendInputEvent({type: 'mouseUp', x: payload.x, y: payload.y, button: 'right', clickCount: 1});
            }, {id: this.view.webContentsId, x: point.x, y: point.y});
            return true;
        }

        return this.view.runInRenderer(
            `
            ${DOM_UTILS}
            const descriptor = ${JSON.stringify(this.descriptor)};
            const element = __mmResolveOne(descriptor);
            if (!element) {
                throw new Error('Element not found for click');
            }

            element.scrollIntoView({block: 'center', inline: 'center'});
            element.focus?.();
            element.click();
            return true;
            `,
            true,
        );
    }

    async count() {
        return this.view.runInRenderer(
            `
            ${DOM_UTILS}
            const descriptor = ${JSON.stringify(this.descriptor)};
            return __mmResolveAll(descriptor).length;
            `,
        );
    }

    async focus() {
        return this.view.runInRenderer(
            `
            ${DOM_UTILS}
            const descriptor = ${JSON.stringify(this.descriptor)};
            const element = __mmResolveOne(descriptor);
            if (!element) {
                throw new Error('Element not found for focus');
            }
            element.focus?.();
            return true;
            `,
        );
    }

    async isVisible() {
        return this.view.runInRenderer(
            `
            ${DOM_UTILS}
            const descriptor = ${JSON.stringify(this.descriptor)};
            const element = __mmResolveOne(descriptor);
            return __mmIsVisible(element);
            `,
        );
    }

    async scrollIntoViewIfNeeded() {
        return this.view.runInRenderer(
            `
            ${DOM_UTILS}
            const descriptor = ${JSON.stringify(this.descriptor)};
            const element = __mmResolveOne(descriptor);
            if (!element) {
                throw new Error('Element not found for scrollIntoViewIfNeeded');
            }
            element.scrollIntoView({block: 'center', inline: 'center'});
            return true;
            `,
        );
    }

    async setInputFiles(files: InputFile | InputFile[]) {
        const normalizedFiles = (Array.isArray(files) ? files : [files]).map((file) => ({
            name: file.name,
            mimeType: file.mimeType,
            buffer: Array.from(file.buffer.values()),
        }));

        return this.view.runInRenderer(
            `
            ${DOM_UTILS}
            const descriptor = ${JSON.stringify(this.descriptor)};
            const files = ${JSON.stringify(normalizedFiles)};
            const element = __mmResolveOne(descriptor);
            if (!(element instanceof HTMLInputElement) || element.type !== 'file') {
                throw new Error('Element is not a file input');
            }

            const dataTransfer = new DataTransfer();
            for (const file of files) {
                dataTransfer.items.add(
                    new File([new Uint8Array(file.buffer)], file.name, {type: file.mimeType || 'application/octet-stream'}),
                );
            }

            element.files = dataTransfer.files;
            element.dispatchEvent(new Event('change', {bubbles: true}));
            return true;
            `,
            true,
        );
    }

    async textContent() {
        return this.view.runInRenderer(
            `
            ${DOM_UTILS}
            const descriptor = ${JSON.stringify(this.descriptor)};
            const element = __mmResolveOne(descriptor);
            return element?.textContent ?? null;
            `,
        );
    }

    toDescriptor() {
        return this.descriptor;
    }
}

export class ServerKeyboard {
    private readonly view: ServerView;

    constructor(view: ServerView) {
        this.view = view;
    }

    async press(shortcut: string) {
        const parsed = parseKeyPress(shortcut);
        await this.view.app.evaluate(({webContents}, payload) => {
            const wc = webContents.fromId(payload.id);
            if (!wc || wc.isDestroyed()) {
                throw new Error(`webContents ${payload.id} is not available`);
            }

            wc.focus();
            wc.sendInputEvent({
                type: 'rawKeyDown',
                keyCode: payload.keyCode,
                modifiers: payload.modifiers,
            });
            if (!payload.modifiers.length && payload.key.length === 1) {
                wc.sendInputEvent({
                    type: 'char',
                    keyCode: payload.key,
                });
            }
            wc.sendInputEvent({
                type: 'keyUp',
                keyCode: payload.keyCode,
                modifiers: payload.modifiers,
            });
        }, {id: this.view.webContentsId, ...parsed});
    }

    async type(text: string) {
        await this.view.app.evaluate(({webContents}, payload) => {
            const wc = webContents.fromId(payload.id);
            if (!wc || wc.isDestroyed()) {
                throw new Error(`webContents ${payload.id} is not available`);
            }

            wc.focus();
            wc.insertText(payload.text);
        }, {id: this.view.webContentsId, text});
    }
}

export class ServerView {
    keyboard: ServerKeyboard;

    constructor(
        readonly app: ElectronApplication,
        readonly webContentsId: number,
    ) {
        this.keyboard = new ServerKeyboard(this);
    }

    async $(selector: string) {
        const locator = this.locator(selector);
        if (await locator.count()) {
            return locator;
        }
        return null;
    }

    async $eval<T>(selector: string, pageFunction: (element: Element) => T) {
        return this.runInRenderer(
            `
            ${DOM_UTILS}
            const selector = ${JSON.stringify(selector)};
            const element = __mmQueryWithin(document, selector)[0];
            if (!element) {
                throw new Error(\`Element not found for selector: \${selector}\`);
            }
            const fn = ${pageFunction.toString()};
            return fn(element);
            `,
        );
    }

    click(selector: string, options?: ClickOptions) {
        return this.locator(selector).click(options);
    }

    async evaluate<T, Arg = undefined>(pageFunction: ((arg: Arg) => T) | string, arg?: Arg) {
        if (typeof pageFunction === 'string') {
            return this.runInRenderer(`return (${pageFunction});`);
        }

        const serializedArg = isLocatorDescriptor(arg) ? {kind: 'locator', descriptor: arg} : {kind: 'value', value: arg};
        return this.runInRenderer(
            `
            ${DOM_UTILS}
            const fn = ${pageFunction.toString()};
            const payload = ${JSON.stringify(serializedArg)};
            const arg = payload.kind === 'locator' ? __mmResolveOne(payload.descriptor) : payload.value;
            return fn(arg);
            `,
        );
    }

    fill(selector: string, value: string) {
        return this.runInRenderer(
            `
            ${DOM_UTILS}
            const selector = ${JSON.stringify(selector)};
            const value = ${JSON.stringify(value)};
            const element = __mmQueryWithin(document, selector)[0];
            if (!element) {
                throw new Error(\`Element not found for selector: \${selector}\`);
            }
            element.focus?.();
            __mmSetElementValue(element, value);
            return true;
            `,
            true,
        );
    }

    focus(selector: string) {
        return this.locator(selector).focus();
    }

    inputValue(selector: string) {
        return this.runInRenderer(
            `
            ${DOM_UTILS}
            const selector = ${JSON.stringify(selector)};
            const element = __mmQueryWithin(document, selector)[0];
            if (!element) {
                throw new Error(\`Element not found for selector: \${selector}\`);
            }
            if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
                throw new Error('Element does not have an input value');
            }
            return element.value;
            `,
        );
    }

    isVisible(selector: string) {
        return this.locator(selector).isVisible();
    }

    locator(selector: string) {
        return new ServerLocator(this, {steps: [{selector}]});
    }

    async press(selector: string, shortcut: string) {
        await this.focus(selector);
        await this.keyboard.press(shortcut);
    }

    runInRenderer<T>(body: string, userGesture = false) {
        return this.app.evaluate(async ({webContents}, payload) => {
            const wc = webContents.fromId(payload.id);
            if (!wc || wc.isDestroyed()) {
                throw new Error(`webContents ${payload.id} is not available`);
            }
            const result = await wc.executeJavaScript(`
                (() => {
                    try {
                        return {__e2eResult: (() => {${payload.body}})()};
                    } catch (error) {
                        return {
                            __e2eError: error instanceof Error ? error.message : String(error),
                            __e2eStack: error instanceof Error ? error.stack : '',
                        };
                    }
                })()
            `, payload.userGesture);

            if (result && typeof result === 'object' && '__e2eError' in result) {
                throw new Error(`${result.__e2eError}${result.__e2eStack ? `\n${result.__e2eStack}` : ''}`);
            }

            return result?.__e2eResult;
        }, {id: this.webContentsId, body, userGesture}) as Promise<T>;
    }

    async type(selector: string, text: string) {
        await this.focus(selector);
        await this.keyboard.type(text);
    }

    async url() {
        return this.app.evaluate(({webContents}, id) => {
            const wc = webContents.fromId(id);
            return wc?.getURL() ?? '';
        }, this.webContentsId);
    }

    async waitForFunction<T>(
        pageFunction: ((arg?: unknown) => T) | string,
        argOrOptions?: unknown,
        maybeOptions?: WaitForFunctionOptions,
    ) {
        let arg: unknown;
        let options: WaitForFunctionOptions | undefined;

        if (isWaitForFunctionOptions(argOrOptions)) {
            options = argOrOptions;
        } else {
            arg = argOrOptions;
            options = maybeOptions;
        }

        const timeout = options?.timeout ?? 30_000;
        const polling = options?.polling ?? 100;
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            try {
                const result = typeof pageFunction === 'string' ?
                    await this.runInRenderer<boolean>(
                        `
                        ${DOM_UTILS}
                        const arg = ${JSON.stringify(arg)};
                        return Boolean((${pageFunction})(arg));
                        `,
                    ) :
                    await this.runInRenderer<boolean>(
                        `
                        ${DOM_UTILS}
                        const fn = ${pageFunction.toString()};
                        const payload = ${JSON.stringify(arg instanceof ServerLocator ? {kind: 'locator', descriptor: arg.toDescriptor()} : {kind: 'value', value: arg})};
                        const arg = payload.kind === 'locator' ? __mmResolveOne(payload.descriptor) : payload.value;
                        return Boolean(fn(arg));
                        `,
                    );

                if (result) {
                    return;
                }
            } catch {
                // Retry until timeout. The renderer can still be navigating.
            }

            await sleep(polling);
        }

        throw new Error(`Timed out waiting for function after ${timeout}ms`);
    }

    async waitForSelector(selector: string, options?: WaitForSelectorOptions) {
        const locator = this.locator(selector);
        const timeout = options?.timeout ?? 30_000;
        const state = options?.state ?? 'visible';
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            try {
                const count = await locator.count();
                const visible = count > 0 ? await locator.isVisible() : false;

                if (state === 'attached' && count > 0) {
                    return locator;
                }
                if (state === 'visible' && visible) {
                    return locator;
                }
                if (state === 'hidden' && (!count || !visible)) {
                    return locator;
                }
                if (state === 'detached' && count === 0) {
                    return locator;
                }
            } catch {
                if (state === 'hidden' || state === 'detached') {
                    return locator;
                }
            }

            await sleep(100);
        }

        throw new Error(`Timed out waiting for selector "${selector}" to be ${state}`);
    }

    async waitForURL(
        matcher: RegExp | string | ((url: URL) => boolean),
        options?: {timeout?: number},
    ) {
        const timeout = options?.timeout ?? 30_000;
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const currentURL = await this.url();
            if (currentURL) {
                const parsedURL = new URL(currentURL);
                if (typeof matcher === 'string' && currentURL.includes(matcher)) {
                    return;
                }
                if (matcher instanceof RegExp && matcher.test(currentURL)) {
                    return;
                }
                if (typeof matcher === 'function' && matcher(parsedURL)) {
                    return;
                }
            }

            await sleep(100);
        }

        throw new Error(`Timed out waiting for URL after ${timeout}ms`);
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
