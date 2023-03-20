// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ElectronLog} from 'electron-log';
import {DiagnosticStepResponse} from 'types/diagnostics';

import ServerManager from 'main/server/serverManager';

import DiagnosticsStep from '../DiagnosticStep';

import {isOnline} from './internal/utils';

const stepName = 'Step-3';
const stepDescriptiveName = 'serverConnectivity';

const run = async (logger: ElectronLog): Promise<DiagnosticStepResponse> => {
    try {
        const teams = ServerManager.getAllServers();

        await Promise.all(teams.map(async (team) => {
            logger.debug('Pinging server: ', team.url);

            if (!team.name || !team.url) {
                throw new Error(`Invalid server configuration. Team Url: ${team.url}, team name: ${team.name}`);
            }

            const serverOnline = await isOnline(logger, `${team.url}/api/v4/system/ping`);

            if (!serverOnline) {
                throw new Error(`Server appears to be offline. Team url: ${team.url}`);
            }
        }));

        return {
            message: `${stepName} finished successfully`,
            succeeded: true,
            payload: teams,
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

const Step3 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step3;
