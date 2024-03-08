// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {session} from 'electron';
import type {MainLogger} from 'electron-log';

import type {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-11';
const stepDescriptiveName = 'AuthSSO';

const run = async (logger: MainLogger): Promise<DiagnosticStepResponse> => {
    try {
        const cookies = await session.defaultSession.cookies.get({});

        if (!cookies) {
            throw new Error('No cookies found');
        }

        const payload = cookies.map((cookie) => {
            return {
                name: cookie?.name,
                expirationDate: cookie?.expirationDate,
                session: cookie?.session,
            };
        });

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

const Step11 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step11;
