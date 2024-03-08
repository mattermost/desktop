// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DiagnosticsStepConstructorPayload} from 'types/diagnostics';

import {addDurationToFnReturnObject} from './steps/internal/utils';

const genericStepName = 'diagnostic-step/generic';

class DiagnosticsStep {
    name: DiagnosticsStepConstructorPayload['name'];
    retries: DiagnosticsStepConstructorPayload['retries'];
    run: DiagnosticsStepConstructorPayload['run'];

    constructor({name = genericStepName, retries = 0, run}: DiagnosticsStepConstructorPayload) {
        if (typeof run !== 'function') {
            throw new Error(`"run" function is missing from step ${name}`);
        }
        this.name = name;
        this.retries = retries;
        this.run = addDurationToFnReturnObject(run);
    }
}

export default DiagnosticsStep;
