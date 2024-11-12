// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LevelOption} from 'electron-log';
import log from 'electron-log';

import Util from 'common/utils/util';

// Turn off sync logging to prevent blocking the main thread
// One downside to this is that some logs may not be written to the log file when the app closes
log.transports.file.sync = false;

export const setLoggingLevel = (level: string) => {
    if (log.transports.file.level === level) {
        return;
    }
    log.error('Logger', 'Log level set to:', level);

    log.transports.console.level = level as LevelOption;
    log.transports.file.level = level as LevelOption;
};

// Start on info by default
setLoggingLevel('info');

export const getLevel = () => log.transports.file.level as string;

export class Logger {
    private prefixes: string[];

    constructor(...prefixes: string[]) {
        this.prefixes = this.shortenPrefixes(...prefixes);
    }

    withPrefix = (...prefixes: string[]) => {
        return {
            error: this.prefixed(log.error, ...prefixes),
            warn: this.prefixed(log.warn, ...prefixes),
            info: this.prefixed(log.info, ...prefixes),
            verbose: this.prefixed(log.verbose, ...prefixes),
            debug: this.prefixed(log.debug, ...prefixes),
            silly: this.prefixed(log.silly, ...prefixes),
            log: this.prefixed(log.log, ...prefixes),
        };
    };

    private prefixed = (func: (...args: any[]) => void, ...additionalPrefixes: string[]) => {
        return (...args: any[]) => func(...this.prefixes, ...this.shortenPrefixes(...additionalPrefixes), ...args);
    };

    private shortenPrefixes = (...prefixes: string[]) => {
        return prefixes.map((prefix) => `[${Util.shorten(prefix)}]`);
    };

    error = this.prefixed(log.error);
    warn = this.prefixed(log.warn);
    info = this.prefixed(log.info);
    verbose = this.prefixed(log.verbose);
    debug = this.prefixed(log.debug);
    silly = this.prefixed(log.silly);
    log = this.prefixed(log.log);
}
