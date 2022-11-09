// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ElectronLog} from 'electron-log';
import {DiagnosticStepResponse} from 'types/diagnostics';

import {LOGS_MAX_STRING_LENGTH} from 'common/constants';

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
