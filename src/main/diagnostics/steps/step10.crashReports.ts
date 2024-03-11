// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';
import path from 'path';

import {app} from 'electron';
import type {MainLogger} from 'electron-log';

import type {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-10';
const stepDescriptiveName = 'CrashReports';

const run = async (logger: MainLogger): Promise<DiagnosticStepResponse> => {
    try {
        const pathOfCrashReports = app.getPath('userData');
        const allDirFiles = await fs.promises.readdir(pathOfCrashReports);
        const crashReportFiles = allDirFiles.filter((fileName) => fileName.startsWith('uncaughtException-'));

        const crashReportData = await Promise.all(crashReportFiles.map(async (fileName) => {
            return {
                data: await fs.promises.readFile(path.join(pathOfCrashReports, fileName), {encoding: 'utf-8'}),
                fileName,
            };
        }));

        const payload = {
            pathOfCrashReports,
            crashReportData,
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

const Step10 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step10;
