// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app} from 'electron';
import {ElectronLog} from 'electron-log';

import {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

import loggerHooks from './internal/loggerHooks';

const stepName = 'Step-0';
const stepDescriptiveName = 'logConfig';

const run = async (logger: ElectronLog): Promise<DiagnosticStepResponse> => {
    try {
        const now = new Date();
        const filename = `diagnostics_${now.getDate()}-${now.getMonth()}-${now.getFullYear()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}-${now.getMilliseconds()}.txt`;
        const pathToFile = path.join(app.getAppPath(), `logs/${filename}`);
        logger.transports.file.resolvePath = () => pathToFile;
        logger.transports.file.fileName = filename;

        logger.debug('ConfigureLogger', {filename, pathToFile});

        logger.hooks.push(...loggerHooks(logger));
        logger.transports.file.level = 'silly';
        logger.transports.console.level = 'silly';

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
