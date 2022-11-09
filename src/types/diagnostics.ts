// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ElectronLog} from 'electron-log';

export type DiagnosticsStepConstructorPayload = {
    name: string;
    retries: number;
    run: (logger: ElectronLog) => Promise<DiagnosticStepResponse>;
}

export type DiagnosticStepResponse = {
    succeeded: boolean;
    message?: string;
    payload?: unknown;
    duration?: number;
}

export type DiagnosticsReportObject = DiagnosticStepResponse & {
    step: number;
    name: DiagnosticsStepConstructorPayload['name'];
}

export type DiagnosticsReport = DiagnosticsReportObject[];
