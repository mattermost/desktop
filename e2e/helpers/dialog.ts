// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {expect} from '../fixtures/index';

import {waitForWindow} from './electronApp';

const MESSAGE_MODAL_URL_FRAGMENT = 'message.html';

export type OpenDialogResult = {
    canceled?: boolean;
    filePaths: string[];
};

/**
 * Globals installed in the app's main process by src/main/e2e/hooks.ts, read
 * back here through app.evaluate. Kept in sync manually with that file.
 */
type E2eDialogGlobals = {
    __e2eStubOpenDialogResults?: (results: OpenDialogResult[]) => void;
    __e2eOpenDialogCalls?: unknown[];
    __e2eClearCertificateErrorCallbacks?: () => void;
};

export async function stubOpenDialogResults(
    app: ElectronApplication,
    results: OpenDialogResult[],
): Promise<void> {
    if (results.length === 0) {
        throw new Error('stubOpenDialogResults requires at least one result');
    }

    await app.evaluate((_electron, value) => {
        const stub = (global as E2eDialogGlobals).__e2eStubOpenDialogResults;
        if (!stub) {
            throw new Error('__e2eStubOpenDialogResults is not available');
        }
        stub(value);
    }, results);
}

export async function getOpenDialogCallCount(app: ElectronApplication): Promise<number> {
    return app.evaluate(() => (global as E2eDialogGlobals).__e2eOpenDialogCalls?.length ?? 0);
}

export async function clearCertificateErrorCallbacks(app: ElectronApplication): Promise<void> {
    await app.evaluate(() => {
        (global as E2eDialogGlobals).__e2eClearCertificateErrorCallbacks?.();
    });
}

/**
 * The former native message boxes are now custom modals rendered as a
 * WebContentsView (mattermost-desktop://renderer/message.html). Its footer
 * buttons render in declaration order, so `response` is the zero-based index of
 * the button to click, matching the old dialog.showMessageBox response index.
 */
export async function answerMessageModal(app: ElectronApplication, response: number, timeout = 10_000): Promise<void> {
    const modal = await waitForWindow(app, MESSAGE_MODAL_URL_FRAGMENT, timeout);
    const button = modal.locator('.Modal__button').nth(response);
    await button.waitFor({state: 'visible', timeout});

    // Clicking dismisses the modal, which tears down its WebContentsView. Fire a
    // DOM click rather than a Playwright click so we don't race actionability
    // retries against the fade-in/teardown ("element is not stable" followed by
    // "Target page has been closed").
    await button.evaluate((el) => (el as HTMLElement).click());

    // Wait until this modal's page is fully gone before returning, so a following
    // answerMessageModal (e.g. the certificate flow's two sequential modals) can't
    // re-grab this closing modal instead of the next one.
    await expect.poll(() => modal.isClosed(), {timeout}).toBe(true);
}

export function isMessageModalOpen(app: ElectronApplication): boolean {
    return app.windows().some((window) => {
        try {
            return window.url().includes(MESSAGE_MODAL_URL_FRAGMENT);
        } catch {
            return false;
        }
    });
}
