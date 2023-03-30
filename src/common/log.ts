// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log, {LevelOption, LogFunctions} from 'electron-log';

import Util from 'common/utils/util';

const logFunctions = {
    error: log.error,
    warn: log.warn,
    info: log.info,
    verbose: log.verbose,
    debug: log.debug,
    silly: log.silly,
    log: log.log,
} as LogFunctions;

const appendToLog = (...params: any[]): LogFunctions => {
    const functionKeys = Object.keys(logFunctions) as Array<keyof LogFunctions>;
    return functionKeys.reduce((funcs, key) => {
        const func = logFunctions[key];
        funcs[key] = (...args: any[]) => func(...params, ...args);
        return funcs;
    }, {} as LogFunctions);
};

const withPrefix = (...prefixes: string[]) => {
    return appendToLog(prefixes.map((prefix) => `[${Util.shorten(prefix)}]`).join(''));
};

export const setLoggingLevel = (level: LevelOption) => {
    if (log.transports.file.level === level) {
        return;
    }
    withPrefix('Logger').error('Log level set to:', level);

    log.transports.console.level = level;
    log.transports.file.level = level;
};

export default {
    ...log,
    withPrefix,
};
