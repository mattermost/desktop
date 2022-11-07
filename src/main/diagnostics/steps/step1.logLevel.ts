// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log from 'electron-log';
import {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

const run = (): DiagnosticStepResponse => {
    try {
        log.debug('Diagnostics.Step1.run');
        return {
            message: 'Step 1 finished successfully',
            succeeded: true,
        };
    } catch (error) {
        log.warn('Diagnostics.Step1.Failure', {error});
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
