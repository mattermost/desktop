// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import https from 'https';

import log, {ElectronLog} from 'electron-log';
import {AddDurationToFnReturnObject} from 'types/diagnostics';

import {IS_ONLINE_ENDPOINT, LOGS_MAX_STRING_LENGTH} from 'common/constants';

export const addDurationToFnReturnObject: AddDurationToFnReturnObject = (run) => {
    return async (logger) => {
        const startTime = Date.now();
        const runReturnValues = await run(logger);
        return {
            ...runReturnValues,
            duration: Date.now() - startTime,
        };
    };
};

export function truncateString(str: string, maxLength = LOGS_MAX_STRING_LENGTH): string {
    if (typeof str === 'string') {
        const length = str.length;
        if (length >= maxLength) {
            return `${str.substring(0, 4)}...${str.substring(length - 2, length)}`;
        }
    }
    return str;
}

export async function isOnline(logger: ElectronLog = log, url = IS_ONLINE_ENDPOINT): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        https.get(url, (resp) => {
            let data = '';

            // A chunk of data has been received.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                logger.debug('resp.on.end', {data});
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
