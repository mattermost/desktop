// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {session} from 'electron';
import type {MainLogger} from 'electron-log';

import {COOKIE_NAME_AUTH_TOKEN, COOKIE_NAME_CSRF, COOKIE_NAME_USER_ID} from 'common/constants';

import type {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-4';
const stepDescriptiveName = 'sessionDataValidation';

const run = async (logger: MainLogger): Promise<DiagnosticStepResponse> => {
    try {
        const cookies = await session.defaultSession.cookies.get({});
        if (!cookies) {
            logger.error(`${stepName}: No cookies found`);
            throw new Error('No cookies found');
        }

        const userId = cookies.find((cookie) => cookie.name === COOKIE_NAME_USER_ID);
        const csrf = cookies.find((cookie) => cookie.name === COOKIE_NAME_CSRF);
        const authToken = cookies.find((cookie) => cookie.name === COOKIE_NAME_AUTH_TOKEN);

        if (!userId || !csrf || !authToken) {
            const errMessage = `Not all required cookies found. "userId": ${Boolean(userId)}, "csrf": ${Boolean(csrf)}, "authToken": ${Boolean(authToken)}`;
            logger.error(`${stepName}: ${errMessage}`);
            throw new Error(errMessage);
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

const Step4 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step4;
