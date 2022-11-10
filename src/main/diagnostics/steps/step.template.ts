// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ElectronLog} from 'electron-log';
import {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

const run = async (logger: ElectronLog): Promise<DiagnosticStepResponse> => {
    try {
        logger.debug('Diagnostics.StepTemplate.run');
        await Promise.resolve();
        return {
            message: 'Step X finished successfully',
            succeeded: true,
        };
    } catch (error) {
        logger.warn('Diagnostics.Step.Failure', {error});
        return {
            message: 'Step X failed',
            succeeded: false,
            payload: error,
        };
    }
};

const StepTemplate = new DiagnosticsStep({
    name: 'diagnostic-step-X/template',
    retries: 0,
    run,
});

export default StepTemplate;
