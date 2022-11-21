// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import https from 'https';

import {BrowserWindow, Rectangle, WebContents} from 'electron';
import log, {ElectronLog} from 'electron-log';
import {AddDurationToFnReturnObject, WindowStatus} from 'types/diagnostics';

import {IS_ONLINE_ENDPOINT, LOGS_MAX_STRING_LENGTH} from 'common/constants';

function boundsOk(bounds?: Rectangle, strict = false): boolean {
    if (!bounds) {
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

export async function isOnline(logger: ElectronLog = log, url = IS_ONLINE_ENDPOINT): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        https.get(url, (resp) => {
            let data = '';

            // A chunk of data has been received.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                logger.debug('resp.on.end', {data});
                const respBody = JSON.parse(data);
                if (respBody.status === 'OK') {
                    resolve(true);
                    return;
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
    const browserViewsBounds = bWindow.getBrowserViews()?.map((view) => view.getBounds());

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
        ok: opacity >= 0 && opacity <= 1,
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
        name: 'browserViewsBounds',
        ok: browserViewsBounds.every((bounds) => boundsOk(bounds)),
        data: browserViewsBounds,
    });

    return status;
}

export function webContentsCheck(webContents?: WebContents) {
    if (!webContents) {
        return false;
    }

    return !webContents.isCrashed() && !webContents.isDestroyed() && !webContents.isWaitingForResponse();
}
