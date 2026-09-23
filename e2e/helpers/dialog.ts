// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {expect} from '../fixtures/index';

import {waitForWindow} from './electronApp';

const MESSAGE_MODAL_URL_FRAGMENT = 'message.html';

function isTargetClosedDuringClick(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('Target page, context or browser has been closed') ||
        message.includes('Target closed');
}

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

    // Clicking dismisses the modal and tears down its WebContentsView. Use a DOM
    // click so Playwright does not retry actionability against that teardown.
    // evaluate(click) can still throw after a successful click if hide() closes
    // the page before the result is serialized (macOS T6176). Swallow only that
    // target-closed error; other failures still throw.
    try {
        await button.evaluate((el) => (el as HTMLElement).click());
    } catch (error) {
        if (!isTargetClosedDuringClick(error)) {
            throw error;
        }
    }

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
