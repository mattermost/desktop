// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ElectronLog} from 'electron-log';
import {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';
import {isOnline} from '../utils';

const stepName = 'Step-2';
const stepDescriptiveName = 'internetConnection';

const run = async (logger: ElectronLog): Promise<DiagnosticStepResponse> => {
    try {
        logger.debug(`Diagnostics.${stepName}.run`);
        const success = await isOnline(logger);
        if (success) {
            return {
                message: `${stepName} finished successfully`,
                succeeded: true,
            };
        }
        return {
            message: `${stepName} failed`,
            succeeded: false,
        };
    } catch (error) {
        logger.warn(`Diagnostics.${stepName}.Failure`, {error});
        return {
            message: `${stepName} failed`,
            succeeded: false,
            payload: error,
        };
    }
};

const Step2 = new DiagnosticsStep({
    name: `diagnostic-${stepName}/${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step2;
