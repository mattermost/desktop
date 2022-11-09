// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ElectronLog} from 'electron-log';
import {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

// to be removed
const sleep = (ms = 200) => {
    return new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
};

const run = async (logger: ElectronLog): Promise<DiagnosticStepResponse> => {
    try {
        logger.debug('Diagnostics.Step1.run');
        await sleep(10);
        return {
            message: 'Step 1 finished successfully',
            succeeded: true,
        };
    } catch (error) {
        logger.warn('Diagnostics.Step1.Failure', {error});
        return {
            message: 'Step 1 failed',
            succeeded: false,
            payload: error,
        };
    }
};

const Step1 = new DiagnosticsStep({
    name: 'diagnostic-step-1/logLevel',
    retries: 0,
    run,
});

export default Step1;
