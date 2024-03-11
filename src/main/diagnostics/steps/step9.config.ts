// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MainLogger} from 'electron-log';

import config from 'common/config';

import type {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-9';
const stepDescriptiveName = 'Config';

const run = async (logger: MainLogger): Promise<DiagnosticStepResponse> => {
    try {
        const payload = config.data;

        return {
            message: `${stepName} finished successfully`,
            succeeded: true,
            payload,
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

const Step9 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step9;
