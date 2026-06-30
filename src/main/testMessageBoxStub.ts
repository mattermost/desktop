// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {dialog} from 'electron';

type MessageBoxResponse = {
    response: number;
    checkboxChecked?: boolean;
};

let restoreMessageBox: typeof dialog.showMessageBox | undefined;

export function installMessageBoxStub(responses: MessageBoxResponse[]) {
    if (responses.length === 0) {
        throw new Error('installMessageBoxStub requires at least one response');
    }

    if (!restoreMessageBox) {
        restoreMessageBox = dialog.showMessageBox.bind(dialog);
    }

    let index = 0;
    dialog.showMessageBox = async () => {
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
