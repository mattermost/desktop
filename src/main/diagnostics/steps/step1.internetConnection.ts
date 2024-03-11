// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MainLogger} from 'electron-log';

import type {DiagnosticStepResponse} from 'types/diagnostics';

import {isOnline} from './internal/utils';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-1';
const stepDescriptiveName = 'internetConnection';

const run = async (logger: MainLogger): Promise<DiagnosticStepResponse> => {
    try {
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
        logger.warn(`Diagnostics ${stepName} Failure`, {error});
        return {
            message: `${stepName} failed`,
            succeeded: false,
            payload: error,
        };
    }
};

const Step1 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step1;
