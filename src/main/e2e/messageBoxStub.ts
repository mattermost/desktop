// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {dialog} from 'electron';

import {setTestField} from 'common/utils/util';

type MessageBoxResponse = {
    response: number;
    checkboxChecked?: boolean;
};

export type OpenDialogResult = {
    canceled?: boolean;
    filePaths: string[];
};

/**
 * Playwright can't interact with native dialogs, so specs that need to go
 * through one (protocol trust, cert trust, clear-all-data, download folder
 * picker) swap dialog.showMessageBox / showOpenDialog for fakes that return a
 * scripted response and record the options they were called with, which is
 * what lets the specs assert on what the user would have seen.
 *
 * The recorded calls are mirrored onto global (via setTestField) so the specs
 * can read them back through app.evaluate. There is no restore step: the
 * electronApp fixture is test-scoped and tears down via app.exit/close, so a
 * stub can never outlive the test that installed it.
 */
export class MessageBoxStub {
    private messageBoxResponses: MessageBoxResponse[] = [];
    private messageBoxIndex = 0;
    private messageBoxCalls: unknown[] = [];

    private openDialogResults: OpenDialogResult[] = [];
    private openDialogIndex = 0;
    private openDialogCalls: unknown[] = [];

    installMessageBoxStub = (responses: MessageBoxResponse[]) => {
        if (responses.length === 0) {
            throw new Error('installMessageBoxStub requires at least one response');
        }

        this.messageBoxResponses = responses;
        this.messageBoxIndex = 0;
        this.messageBoxCalls = [];
        setTestField('__e2eMessageBoxCalls', this.messageBoxCalls);

        dialog.showMessageBox = async (...args: unknown[]) => {
            const options = args.length >= 2 ? args[1] : args[0];
            this.messageBoxCalls.push(options);
            const next = this.messageBoxResponses[this.messageBoxIndex] ?? this.messageBoxResponses[this.messageBoxResponses.length - 1];
            this.messageBoxIndex += 1;
            return {
                response: next.response,
                checkboxChecked: next.checkboxChecked ?? false,
            };
        };
    };

    installOpenDialogStub = (results: OpenDialogResult[]) => {
        if (results.length === 0) {
            throw new Error('installOpenDialogStub requires at least one result');
        }

        this.openDialogResults = results;
        this.openDialogIndex = 0;
        this.openDialogCalls = [];
        setTestField('__e2eOpenDialogCalls', this.openDialogCalls);

        dialog.showOpenDialog = (async (...args: unknown[]) => {
            this.openDialogCalls.push(args);
            const next = this.openDialogResults[Math.min(this.openDialogIndex, this.openDialogResults.length - 1)];
            this.openDialogIndex += 1;
            return {
                canceled: next.canceled ?? next.filePaths.length === 0,
                filePaths: next.filePaths,
            };
        }) as typeof dialog.showOpenDialog;
    };
}

const messageBoxStub = new MessageBoxStub();
export default messageBoxStub;
