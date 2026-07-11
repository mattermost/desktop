// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {ServerView} from './serverView';
import {evaluateInMainProcessWithArg} from './testRefs';

export const SETTINGS_MODAL_KEY = 'settingsModal';

type ModalLookupOptions = {
    urlIncludes: string;
};

type ModalLookupResult = {
    webContentsId: number;
    url: string;
};

export async function lookupModalByUrl(
    app: ElectronApplication,
    options: ModalLookupOptions,
): Promise<ModalLookupResult | null> {
    return evaluateInMainProcessWithArg(app, ({webContents}, payload) => {
        for (const wc of webContents.getAllWebContents()) {
            if (wc.isDestroyed()) {
                continue;
            }
            try {
                const url = wc.getURL();
                if (url.includes(payload.urlIncludes)) {
                    return {webContentsId: wc.id, url};
                }
            } catch {
                // Ignore webContents that disappear while iterating.
            }
        }
        return null;
    }, options);
}

export async function waitForModalView(
    app: ElectronApplication,
    options: ModalLookupOptions & {timeout?: number},
): Promise<ServerView> {
    const timeout = options.timeout ?? 15_000;
    let modalView: ServerView | undefined;

    await expect.poll(async () => {
        const modal = await lookupModalByUrl(app, {urlIncludes: options.urlIncludes});
        if (!modal) {
            return null;
        }
        modalView = new ServerView(app, modal.webContentsId);
        return modalView;
    }, {
        timeout,
        message: `WebContents with URL containing "${options.urlIncludes}" must be available`,
    }).not.toBeNull();

    return modalView!;
}
