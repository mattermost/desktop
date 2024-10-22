// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';
import https from 'https';
import readline from 'readline';

import type {BrowserWindow, Rectangle, WebContents} from 'electron';
import type {MainLogger, LogLevel} from 'electron-log';
import log from 'electron-log';

import {IS_ONLINE_ENDPOINT, LOGS_MAX_STRING_LENGTH, REGEX_LOG_FILE_LINE} from 'common/constants';

import type {AddDurationToFnReturnObject, LogFileLineData, LogLevelAmounts, WindowStatus} from 'types/diagnostics';

export function dateTimeInFilename(date?: Date) {
    const now = date ?? new Date();
    return `${now.getDate()}-${now.getMonth()}-${now.getFullYear()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}-${now.getMilliseconds()}`;
}

export function boundsOk(bounds?: Rectangle, strict = false): boolean {
    if (!bounds) {
        return false;
    }
    if (typeof bounds !== 'object') {
        return false;
    }

    const propertiesOk = ['x', 'y', 'width', 'height'].every((key) => Object.prototype.hasOwnProperty.call(bounds, key));
    const valueTypesOk = Object.values(bounds).every((value) => typeof value === 'number');

    if (!propertiesOk || !valueTypesOk) {
        return false;
    }

    if (strict) {
        return bounds.height > 0 && bounds.width > 0 && bounds.x >= 0 && bounds.y >= 0;
    }

    return bounds.height >= 0 && bounds.width >= 0 && bounds.x >= 0 && bounds.y >= 0;
}

export const addDurationToFnReturnObject: AddDurationToFnReturnObject = (run) => {
    return async (logger) => {
        const startTime = Date.now();
        const runReturnValues = await run(logger);
        return {
            ...runReturnValues,
            duration: Date.now() - startTime,
        };
    };
};

export function truncateString(str: string, maxLength = LOGS_MAX_STRING_LENGTH): string {
    if (typeof str === 'string') {
        const length = str.length;
        if (length >= maxLength) {
            return `${str.substring(0, 4)}...${str.substring(length - 2, length)}`;
        }
    }
    return str;
}

export async function isOnline(logger: MainLogger = log, url = IS_ONLINE_ENDPOINT): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        https.get(url, (resp) => {
            let data = '';

            // A chunk of data has been received.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                logger.debug('resp.on.end', {data, url});
                if (data.length) {
                    try {
                        const respBody = JSON.parse(data);
                        if (respBody.status === 'OK') {
                            resolve(true);
                            return;
                        }
                    } catch (e) {
                        logger.error('Cannot parse response');
                    }
                }
                resolve(false);
            });
        }).on('error', (err) => {
            logger.error('diagnostics isOnline Error', {err});
            resolve(false);
        });
    });
}

export function browserWindowVisibilityStatus(name: string, bWindow?: BrowserWindow): WindowStatus {
    const status: WindowStatus = [];

    if (!bWindow) {
        status.push({
            name: 'windowExists',
            ok: false,
        });
        return status;
    }

    const bounds = bWindow.getBounds();
    const opacity = bWindow.getOpacity();
    const destroyed = bWindow.isDestroyed();
    const visible = bWindow.isVisible();
    const enabled = bWindow.isEnabled();
    const webContentsViewsBounds = bWindow.contentView.children.map((view) => view.getBounds());

    status.push({
        name: 'windowExists',
        ok: true,
    });

    status.push({
        name: 'bounds',
        ok: boundsOk(bounds, true),
        data: bounds,
    });

    status.push({
        name: 'opacity',
        ok: opacity > 0 && opacity <= 1,
        data: opacity,
    });

    status.push({
        name: 'destroyed',
        ok: !destroyed,
    });
    status.push({
        name: 'visible',
        ok: visible,
    });
    status.push({
        name: 'enabled',
        ok: enabled,
    });
    status.push({
        name: 'webContentsViewsBounds',
        ok: webContentsViewsBounds.every((bounds) => boundsOk(bounds)),
        data: webContentsViewsBounds,
    });

    return status;
}

export function webContentsCheck(webContents?: WebContents) {
    if (!webContents) {
        return false;
    }

    return !webContents.isCrashed() && !webContents.isDestroyed() && !webContents.isWaitingForResponse();
}

export async function checkPathPermissions(path?: fs.PathLike, mode?: number) {
    try {
        if (!path) {
            throw new Error('Invalid path');
        }
        await fs.promises.access(path, mode);
        return {
            ok: true,
        };
    } catch (error) {
        return {
            ok: false,
            error,
        };
    }
}

function parseLogFileLine(line: string, lineMatchPattern: RegExp): LogFileLineData {
    const data = line.match(lineMatchPattern);
    return {
        text: line,
        date: data?.[1],
        logLevel: data?.[2] as LogLevel,
    };
}

/**
 * The current setup of `electron-log` rotates the file when it reaches ~1mb. It's safe to assume that the file will not be large enough to cause
 * issues reading it in the same process. If this read function ever causes performance issues we should either execute it in a child process or
 * read up to X amount of lines (eg 10.000)
 */
export async function readFileLineByLine(path: fs.PathLike, lineMatchPattern = REGEX_LOG_FILE_LINE): Promise<{lines: LogFileLineData[]; logLevelAmounts: LogLevelAmounts}> {
    const logLevelAmounts = {
        silly: 0,
        debug: 0,
        verbose: 0,
        info: 0,
        warn: 0,
        error: 0,
    };
    const lines: LogFileLineData[] = [];

    if (!path) {
        return {
            lines,
            logLevelAmounts,
        };
    }

    const fileStream = fs.createReadStream(path);
    const rl = readline.createInterface({
        input: fileStream,

        /**
         * Note: we use the crlfDelay option to recognize all instances of CR LF
         * ('\r\n') in input.txt as a single line break.
         */
        crlfDelay: Infinity,
    });

    let i = -1;

    for await (const line of rl) {
        const isValidLine = new RegExp(lineMatchPattern, 'gi').test(line);

        if (isValidLine || i === -1) {
            i++;
            const lineData = parseLogFileLine(line, lineMatchPattern);

            if (lineData.logLevel) {
                logLevelAmounts[lineData.logLevel]++;
            }

            //push in array as new line
            lines.push(lineData);
        } else {
            //concat with previous line
            lines[i].text = `${lines[i].text}${line}`;
        }

        // exit loop in edge case of very large file or infinite loop
        if (i >= 100000) {
            break;
        }
    }

    return {
        lines,
        logLevelAmounts,
    };
}
