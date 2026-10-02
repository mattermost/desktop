// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {dialog} from 'electron';

import {setTestField} from 'common/utils/util';

export type OpenDialogResult = {
    canceled?: boolean;
    filePaths: string[];
};

/**
 * Playwright can't interact with the native folder picker, so the download
 * location spec swaps dialog.showOpenDialog for a fake that returns a scripted
 * result and records the options it was called with, which is what lets the
 * spec assert on what the user would have seen.
 *
 * The recorded calls are mirrored onto global (via setTestField) so the spec
 * can read them back through app.evaluate. There is no restore step: the
 * electronApp fixture is test-scoped and tears down via app.exit/close, so a
 * stub can never outlive the test that installed it.
 */
export class MessageBoxStub {
    private openDialogResults: OpenDialogResult[] = [];
    private openDialogIndex = 0;
    private openDialogCalls: unknown[] = [];

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
