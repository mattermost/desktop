// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MainLogger} from 'electron-log';
import log from 'electron-log';

import {getPercentage} from 'main/utils';

import type {DiagnosticStepResponse} from 'types/diagnostics';

import {readFileLineByLine} from './internal/utils';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-8';
const stepDescriptiveName = 'LogHeuristics';

const run = async (logger: MainLogger): Promise<DiagnosticStepResponse> => {
    try {
        const mainLogFilePath = log.transports.file.getFile().path;
        const fileData = await readFileLineByLine(mainLogFilePath);

        const linesCount = fileData.lines.length;
        const percentageOfErrors = getPercentage(fileData.logLevelAmounts.error, linesCount);

        /**
         * Ideally we could define a threshold for the error % for which this step would return an appropriate message
         * and/or return all the errors
         */
        const payload = {
            logLevels: fileData.logLevelAmounts,
            percentageOfErrors,
            linesCount,
        };

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

const Step8 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step8;
