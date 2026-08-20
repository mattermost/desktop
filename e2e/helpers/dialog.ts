// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

type MessageBoxResponse = {
    response: number;
    checkboxChecked?: boolean;
};

export async function stubMessageBoxResponses(
    app: ElectronApplication,
    responses: MessageBoxResponse[],
): Promise<void> {
    if (responses.length === 0) {
        throw new Error('stubMessageBoxResponses requires at least one response');
    }

    await app.evaluate((_electron, value) => {
        const stub = (global as any).__e2eStubMessageBoxResponses as ((responses: MessageBoxResponse[]) => void) | undefined;
        if (!stub) {
            throw new Error('__e2eStubMessageBoxResponses is not available');
        }
        stub(value);
    }, responses);
}

export async function restoreMessageBox(app: ElectronApplication): Promise<void> {
    await app.evaluate(() => {
        const restore = (global as any).__e2eRestoreMessageBox as (() => void) | undefined;
        if (restore) {
            restore();
        }
    });
}

export type OpenDialogResult = {
    canceled?: boolean;
    filePaths: string[];
};

export async function stubOpenDialogResults(
    app: ElectronApplication,
    results: OpenDialogResult[],
): Promise<void> {
    if (results.length === 0) {
        throw new Error('stubOpenDialogResults requires at least one result');
    }

    await app.evaluate((_electron, value) => {
        const stub = (global as any).__e2eStubOpenDialogResults as ((results: OpenDialogResult[]) => void) | undefined;
        if (!stub) {
            throw new Error('__e2eStubOpenDialogResults is not available');
        }
        stub(value);
    }, results);
}

export async function restoreOpenDialog(app: ElectronApplication): Promise<void> {
    await app.evaluate(() => {
        const restore = (global as any).__e2eRestoreOpenDialog as (() => void) | undefined;
        if (restore) {
            restore();
        }
    }).catch(() => {});
}

export async function getMessageBoxCalls(app: ElectronApplication): Promise<unknown[]> {
    return app.evaluate(() => (global as any).__e2eMessageBoxCalls ?? []);
}

export async function getOpenDialogCallCount(app: ElectronApplication): Promise<number> {
    return app.evaluate(() => ((global as any).__e2eOpenDialogCalls as unknown[] | undefined)?.length ?? 0);
}

export async function clearCertificateErrorCallbacks(app: ElectronApplication): Promise<void> {
    await app.evaluate(() => {
        const clear = (global as any).__e2eClearCertificateErrorCallbacks as (() => void) | undefined;
        clear?.();
    });
}
