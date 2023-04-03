// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log, {LevelOption, LogFunctions} from 'electron-log';

import Util from 'common/utils/util';

export class Logger {
    error = log.error;
    warn = log.warn;
    info = log.info;
    verbose = log.verbose;
    debug = log.debug;
    silly = log.silly;
    log = log.log;

    private get logFunctions() {
        return {
            error: this.error,
            warn: this.warn,
            info: this.info,
            verbose: this.verbose,
            debug: this.debug,
            silly: this.silly,
            log: this.log,
        } as LogFunctions;
    }

    private appendToLog = (...params: any[]): LogFunctions => {
        const functionKeys = Object.keys(this.logFunctions) as Array<keyof LogFunctions>;
        return functionKeys.reduce((funcs, key) => {
            const func = this.logFunctions[key];
            funcs[key] = (...args: any[]) => func(...params, ...args);
            return funcs;
        }, {} as LogFunctions);
    };

    withPrefix = (...prefixes: string[]) => {
        return this.appendToLog(...prefixes.map((prefix) => `[${Util.shorten(prefix)}]`));
    };

    setLoggingLevel = (level: string) => {
        if (log.transports.file.level === level) {
            return;
        }
        this.withPrefix('Logger').error('Log level set to:', level);

        log.transports.console.level = level as LevelOption;
        log.transports.file.level = level as LevelOption;
    };
}

const logger = new Logger();
export default logger;
