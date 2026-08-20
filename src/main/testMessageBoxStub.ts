// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {dialog} from 'electron';

type MessageBoxResponse = {
    response: number;
    checkboxChecked?: boolean;
};

export type OpenDialogResult = {
    canceled?: boolean;
    filePaths: string[];
};

let restoreMessageBox: typeof dialog.showMessageBox | undefined;
let restoreOpenDialog: typeof dialog.showOpenDialog | undefined;

function recordMessageBoxCall(args: unknown[]) {
    const options = args.length >= 2 ? args[1] : args[0];
    const calls = ((global as any).__e2eMessageBoxCalls as unknown[] | undefined) ?? [];
    calls.push(options);
    (global as any).__e2eMessageBoxCalls = calls;
}

export function installMessageBoxStub(responses: MessageBoxResponse[]) {
    if (responses.length === 0) {
        throw new Error('installMessageBoxStub requires at least one response');
    }

    if (!restoreMessageBox) {
        restoreMessageBox = dialog.showMessageBox.bind(dialog);
    }

    (global as any).__e2eMessageBoxCalls = [];
    let index = 0;
    dialog.showMessageBox = async (...args: unknown[]) => {
        recordMessageBoxCall(args);
        const next = responses[index] ?? responses[responses.length - 1];
        index += 1;
        return {
            response: next.response,
            checkboxChecked: next.checkboxChecked ?? false,
        };
    };
}

export function restoreMessageBoxStub() {
    if (restoreMessageBox) {
        dialog.showMessageBox = restoreMessageBox;
        restoreMessageBox = undefined;
    }
}

export function installOpenDialogStub(results: OpenDialogResult[]) {
    if (results.length === 0) {
        throw new Error('installOpenDialogStub requires at least one result');
    }

    if (!restoreOpenDialog) {
        restoreOpenDialog = dialog.showOpenDialog.bind(dialog);
    }

    (global as any).__e2eOpenDialogCalls = [];
    let index = 0;
    dialog.showOpenDialog = (async (...args: unknown[]) => {
        const calls = ((global as any).__e2eOpenDialogCalls as unknown[] | undefined) ?? [];
        calls.push(args);
        (global as any).__e2eOpenDialogCalls = calls;

        const next = results[Math.min(index, results.length - 1)];
        index += 1;
        return {
            canceled: next.canceled ?? next.filePaths.length === 0,
            filePaths: next.filePaths,
        };
    }) as typeof dialog.showOpenDialog;
}

export function restoreOpenDialogStub() {
    if (restoreOpenDialog) {
        dialog.showOpenDialog = restoreOpenDialog;
        restoreOpenDialog = undefined;
    }
}
