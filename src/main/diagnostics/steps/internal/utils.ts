// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import https from 'https';

import log, {ElectronLog} from 'electron-log';
import {DiagnosticStepResponse} from 'types/diagnostics';

import {IS_ONLINE_ENDPOINT, LOGS_MAX_STRING_LENGTH} from 'common/constants';

export function addDurationToFnReturnObject(run: (logger: ElectronLog) => Promise<DiagnosticStepResponse>): (logger: ElectronLog) => Promise<DiagnosticStepResponse & {duration: number}> {
    return async (logger) => {
        const startTime = Date.now();
        const runReturnValues = await run(logger);
        return {
            ...runReturnValues,
            duration: Date.now() - startTime,
        };
    };
}

export function truncateString(str: string, maxLength = LOGS_MAX_STRING_LENGTH): string {
    if (typeof str === 'string') {
        const length = str.length;
        if (length >= maxLength) {
            return `${str.substring(0, 4)}...${str.substring(length - 2, length)}`;
        }
    }
    return str;
}

export async function isOnline(logger: ElectronLog = log): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        https.get(IS_ONLINE_ENDPOINT, (resp) => {
            let data = '';

            // A chunk of data has been received.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                const respBody = JSON.parse(data);
                if (respBody.status === 'OK') {
                    resolve(true);
                    return;
                }
                resolve(false);
            });
        }).on('error', (err) => {
            logger.error('diagnostics isOnline Error', {err});
            resolve(false);
        });
    });
}
