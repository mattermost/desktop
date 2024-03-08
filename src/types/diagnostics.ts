// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MainLogger, LogLevel} from 'electron-log';

export type DiagnosticsStepConstructorPayload = {
    name: string;
    retries: number;
    run: (logger: MainLogger) => Promise<DiagnosticStepResponse>;
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

export type AddDurationToFnReturnObject =
    (run: (logger: MainLogger) => Promise<DiagnosticStepResponse>)
    => (logger: MainLogger)
    => Promise<Omit<DiagnosticStepResponse, 'duration'> & {duration: number}>;

export type DiagnosticsReport = DiagnosticsReportObject[];

export type WindowStatus = Array<{
    name: string;
    ok: boolean;
    data?: unknown;
}>;

export type LogFileLineData = {
    text: string;
    logLevel?: LogLevel;
    date?: string;
}

export type LogLevelAmounts = {
    silly: number;
    debug: number;
    verbose: number;
    info: number;
    warn: number;
    error: number;
}

