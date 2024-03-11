// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MainLogger} from 'electron-log';

import type {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-X';
const stepDescriptiveName = 'Template';

// COPY & PASTE this file to create a new step

const run = async (logger: MainLogger): Promise<DiagnosticStepResponse> => {
    try {
        await Promise.resolve();
        return {
            message: `${stepName} finished successfully`,
            succeeded: true,
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

const StepTemplate = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default StepTemplate;
