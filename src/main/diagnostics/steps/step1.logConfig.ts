// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ElectronLog} from 'electron-log';

import {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-1';
const stepDescriptiveName = 'logConfig';

const run = async (logger: ElectronLog): Promise<DiagnosticStepResponse> => {
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

const Step1 = new DiagnosticsStep({
    name: `diagnostic-${stepName}/${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step1;
