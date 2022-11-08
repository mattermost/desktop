// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DiagnosticStepResponse} from 'types/diagnostics';

export function addDurationToFnReturnObject(fn: () => Promise<DiagnosticStepResponse>): () => Promise<DiagnosticStepResponse & {duration: number}> {
    return async () => {
        const startTime = Date.now();
        const fnReturnValues = await fn();
        return {
            ...fnReturnValues,
            duration: Date.now() - startTime,
        };
    };
}

export function toPromise(fn: () => any) {
    return () => new Promise<any>((resolve, reject) => {
        try {
            const res = fn?.();
            resolve(res);
        } catch (error) {
            reject(error);
        }
    });
}
