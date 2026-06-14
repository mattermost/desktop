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
    await app.evaluate(({dialog}, payload) => {
        const original = dialog.showMessageBox.bind(dialog);
        (global as any).__e2eRestoreMessageBox = original;
        let index = 0;
        dialog.showMessageBox = async () => {
            const next = payload.responses[index] ?? payload.responses[payload.responses.length - 1];
            index += 1;
            return {
                response: next.response,
                checkboxChecked: next.checkboxChecked ?? false,
            };
        };
    }, {responses});
}

export async function restoreMessageBox(app: ElectronApplication): Promise<void> {
    await app.evaluate(({dialog}) => {
        const original = (global as any).__e2eRestoreMessageBox as typeof dialog.showMessageBox | undefined;
        if (original) {
            dialog.showMessageBox = original;
            delete (global as any).__e2eRestoreMessageBox;
        }
    });
}
