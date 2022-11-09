// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ElectronLog} from 'electron-log';
import {DiagnosticStepResponse} from 'types/diagnostics';

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
