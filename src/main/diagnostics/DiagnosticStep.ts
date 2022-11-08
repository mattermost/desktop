// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DiagnosticsStepConstructorPayload, DiagnosticsStepState} from 'types/diagnostics';

import {addDurationToFnReturnObject, toPromise} from './utils';

const genericStepName = 'diagnostic-stepX/generic';

class DiagnosticsStep {
    name: DiagnosticsStepState['name'];
    retries: DiagnosticsStepState['retries'];
    run: DiagnosticsStepState['run'];

    constructor({name = genericStepName, retries = 0, run}: DiagnosticsStepConstructorPayload) {
        if (typeof run !== 'function') {
            throw new Error(`"run" and "onFailure" are missing from step ${name}`);
        }
        this.name = name;
        this.retries = retries;
        this.run = addDurationToFnReturnObject(toPromise(run));
    }
}

export default DiagnosticsStep;
