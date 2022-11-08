// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type DiagnosticsStepConstructorPayload = {
    name: string;
    retries: number;
    run: DiagnosticStepRun<DiagnosticStepResponse>;
}

export type DiagnosticsStepState = Omit<DiagnosticsStepConstructorPayload, 'run'> & {
    run: DiagnosticStepRun<Promise<DiagnosticStepResponse>>;
}

export type DiagnosticStepResponse = {
    succeeded: boolean;
    message?: string;
    payload?: unknown;
    duration?: number;
}

export type DiagnosticStepRun<T> = () => T;

export type DiagnosticsReportObject = DiagnosticStepResponse & {
    step: number;
    name: DiagnosticsStepState['name'];
}

export type DiagnosticsReport = DiagnosticsReportObject[];
