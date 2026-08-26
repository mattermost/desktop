// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

type MessageBoxResponse = {
    response: number;
    checkboxChecked?: boolean;
};

export type OpenDialogResult = {
    canceled?: boolean;
    filePaths: string[];
};

/**
 * Globals installed in the app's main process by src/main/e2e/hooks.ts, read
 * back here through app.evaluate. Kept in sync manually with that file.
 */
type E2eDialogGlobals = {
    __e2eStubMessageBoxResponses?: (responses: MessageBoxResponse[]) => void;
    __e2eStubOpenDialogResults?: (results: OpenDialogResult[]) => void;
    __e2eMessageBoxCalls?: unknown[];
    __e2eOpenDialogCalls?: unknown[];
    __e2eClearCertificateErrorCallbacks?: () => void;
};

export async function stubMessageBoxResponses(
    app: ElectronApplication,
    responses: MessageBoxResponse[],
): Promise<void> {
    if (responses.length === 0) {
        throw new Error('stubMessageBoxResponses requires at least one response');
    }

    await app.evaluate((_electron, value) => {
        const stub = (global as E2eDialogGlobals).__e2eStubMessageBoxResponses;
        if (!stub) {
            throw new Error('__e2eStubMessageBoxResponses is not available');
        }
        stub(value);
    }, responses);
}

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

export async function getMessageBoxCalls(app: ElectronApplication): Promise<unknown[]> {
    return app.evaluate(() => (global as E2eDialogGlobals).__e2eMessageBoxCalls ?? []);
}

export async function getOpenDialogCallCount(app: ElectronApplication): Promise<number> {
    return app.evaluate(() => (global as E2eDialogGlobals).__e2eOpenDialogCalls?.length ?? 0);
}

export async function clearCertificateErrorCallbacks(app: ElectronApplication): Promise<void> {
    await app.evaluate(() => {
        (global as E2eDialogGlobals).__e2eClearCertificateErrorCallbacks?.();
    });
}
