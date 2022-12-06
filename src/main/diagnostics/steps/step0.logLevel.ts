// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app} from 'electron';
import {ElectronLog} from 'electron-log';

import {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

import loggerHooks from './internal/loggerHooks';
import {dateTimeInFilename} from './internal/utils';

const stepName = 'Step-0';
const stepDescriptiveName = 'logConfig';

const run = async (logger: ElectronLog): Promise<DiagnosticStepResponse> => {
    try {
        const filename = `diagnostics_${dateTimeInFilename()}.txt`;
        const pathToFile = path.join(app.getPath('userData'), `diagnostics/${filename}`);
        logger.transports.file.resolvePath = () => pathToFile;
        logger.transports.file.fileName = filename;

        logger.hooks.push(...loggerHooks(logger));
        logger.transports.file.level = 'silly';
        logger.transports.console.level = 'silly';

        logger.debug('ConfigureLogger', {filename, pathToFile});
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

const Step0 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step0;
