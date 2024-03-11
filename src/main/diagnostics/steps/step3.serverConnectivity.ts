// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MainLogger} from 'electron-log';

import ServerManager from 'common/servers/serverManager';
import {parseURL} from 'common/utils/url';

import type {DiagnosticStepResponse} from 'types/diagnostics';

import {isOnline} from './internal/utils';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-3';
const stepDescriptiveName = 'serverConnectivity';

const run = async (logger: MainLogger): Promise<DiagnosticStepResponse> => {
    try {
        const servers = ServerManager.getAllServers();

        await Promise.all(servers.map(async (server) => {
            logger.debug('Pinging server: ', server.url);

            if (!server.name || !server.url) {
                throw new Error(`Invalid server configuration. Server Url: ${server.url}, server name: ${server.name}`);
            }

            const serverOnline = await isOnline(logger, parseURL(`${server.url}/api/v4/system/ping`)?.toString());

            if (!serverOnline) {
                throw new Error(`Server appears to be offline. Server url: ${server.url}`);
            }
        }));

        return {
            message: `${stepName} finished successfully`,
            succeeded: true,
            payload: servers,
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
