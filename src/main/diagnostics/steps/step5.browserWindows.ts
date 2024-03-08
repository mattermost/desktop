// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MainLogger} from 'electron-log';

import MainWindow from 'main/windows/mainWindow';

import type {DiagnosticStepResponse} from 'types/diagnostics';

import {browserWindowVisibilityStatus, webContentsCheck} from './internal/utils';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-5';
const stepDescriptiveName = 'BrowserWindowsChecks';

const run = async (logger: MainLogger): Promise<DiagnosticStepResponse> => {
    try {
        /** Main window check */
        if (!MainWindow.isReady) {
            throw new Error('Main window not ready');
        }
        const mainWindowVisibilityStatus = browserWindowVisibilityStatus('mainWindow', MainWindow.get());
        const webContentsOk = webContentsCheck(MainWindow.get()?.webContents);

        if (mainWindowVisibilityStatus.some((status) => !status.ok) || !webContentsOk) {
            return {
                message: `${stepName} failed`,
                succeeded: false,
                payload: {
                    message: 'Some checks failed for main window',
                    data: {
                        mainWindowVisibilityStatus,
                        webContentsOk,
                    },
                },
            };
        }

        return {
            message: `${stepName} finished successfully`,
            succeeded: true,
            payload: {
                mainWindowVisibilityStatus,
                webContentsOk,
            },
        };
    } catch (error) {
        logger.warn(`Diagnostics ${stepName} Failure`, {error});
        return {
            message: `${stepName} failed`,
            succeeded: false,
            payload: error,
        };
    }
};

const Step5 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step5;
