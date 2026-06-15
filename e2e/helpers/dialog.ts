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

export async function clearCertificateErrorCallbacks(app: ElectronApplication): Promise<void> {
    await app.evaluate(() => {
        const clear = (global as any).__e2eClearCertificateErrorCallbacks as (() => void) | undefined;
        clear?.();
    });
}

export async function setAutoTrustCertificate(app: ElectronApplication, enabled: boolean): Promise<void> {
    await app.evaluate((_electron, value) => {
        const setAutoTrust = (global as any).__e2eSetAutoTrustCertificate as ((enabled: boolean) => void) | undefined;
        if (!setAutoTrust) {
            throw new Error('__e2eSetAutoTrustCertificate not exposed (NODE_ENV must be test)');
        }
        setAutoTrust(value);
    }, enabled);
}
