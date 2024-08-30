// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';

import type {Event} from 'electron';

import type {Logger} from 'common/log';
import {getLevel} from 'common/log';

enum ConsoleMessageLevel {
    Verbose,
    Info,
    Warning,
    Error
}

export const generateHandleConsoleMessage = (log: Logger) => (_: Event, level: number, message: string, line: number, sourceId: string) => {
    const wcLog = log.withPrefix('renderer');
    let logFn = wcLog.debug;
    switch (level) {
    case ConsoleMessageLevel.Error:
        logFn = wcLog.error;
        break;
    case ConsoleMessageLevel.Warning:
        logFn = wcLog.warn;
        break;
    }

    // Only include line entries if we're debugging
    const entries = [message];
    if (['debug', 'silly'].includes(getLevel())) {
        entries.push(`(${path.basename(sourceId)}:${line})`);
    }

    logFn(...entries);
};
