// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';

import {ElectronLog} from 'electron-log';
import {DiagnosticStepResponse} from 'types/diagnostics';

import Config from 'common/config';
import * as Validator from 'main/Validator';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-2';
const stepDescriptiveName = 'configValidation';

const run = async (logger: ElectronLog): Promise<DiagnosticStepResponse> => {
    try {
        logger.debug(`Diagnostics ${stepName} run`);

        const configData = JSON.parse(fs.readFileSync(Config.configFilePath, 'utf8'));

        // validate based on config file version
        const validData = Validator.validateConfigData(configData);

        if (!validData) {
            throw new Error(`Config validation failed. Config: ${JSON.stringify(Config.combinedData, null, 4)}`);
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

const StepTemplate = new DiagnosticsStep({
    name: `diagnostic-${stepName}/${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default StepTemplate;
