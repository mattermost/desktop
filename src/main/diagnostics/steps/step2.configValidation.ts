// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';

import {ElectronLog} from 'electron-log';
import {DiagnosticStepResponse} from 'types/diagnostics';

import Config from 'common/config';
import * as Validator from 'common/Validator';

import {configPath} from 'main/constants';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-2';
const stepDescriptiveName = 'configValidation';

const run = async (logger: ElectronLog): Promise<DiagnosticStepResponse> => {
    try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // validate based on config file version
        const validData = Validator.validateConfigData(configData);

        if (!validData) {
            throw new Error(`Config validation failed. Config: ${JSON.stringify(Config.data, null, 4)}`);
        }

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

const Step2 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step2;
