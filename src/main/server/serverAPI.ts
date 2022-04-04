// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {net, session} from 'electron';
import log from 'electron-log';

export async function getServerAPI<T>(url: URL, isAuthenticated: boolean, onSuccess?: (data: T) => void, onAbort?: () => void, onError?: (error: Error) => void) {
    if (isAuthenticated) {
        const cookies = await session.defaultSession.cookies.get({});
        if (!cookies) {
            log.error('Cannot authenticate, no cookies present');
            return;
        }

        // Filter out cookies that aren't part of our domain
        const filteredCookies = cookies.filter((cookie) => cookie.domain && url.toString().indexOf(cookie.domain) >= 0);

        const userId = filteredCookies.find((cookie) => cookie.name === 'MMUSERID');
        const csrf = filteredCookies.find((cookie) => cookie.name === 'MMCSRF');
        const authToken = filteredCookies.find((cookie) => cookie.name === 'MMAUTHTOKEN');

        if (!userId || !csrf || !authToken) {
            // Missing cookies needed for req
            log.error(`Cannot authenticate, required cookies for ${url.origin} not found`);
            return;
        }
    }

    const req = net.request({
        url: url.toString(),
        session: session.defaultSession,
        useSessionCookies: true,
    });

    if (onSuccess) {
        req.on('response', (response: Electron.IncomingMessage) => {
            log.silly('getServerAPI.response', response);
            if (response.statusCode === 200) {
                response.on('data', (chunk: Buffer) => {
                    log.silly('getServerAPI.response.data', `${chunk}`);
                    const raw = `${chunk}`;
                    try {
                        const data = JSON.parse(raw) as T;
                        onSuccess(data);
                    } catch (e) {
                        const error = `Error parsing server data from ${url.toString()}`;
                        log.error(error);
                        onError?.(new Error(error));
                    }
                });
            } else {
                onError?.(new Error(`Bad status code requesting from ${url.toString()}`));
            }
            response.on('error', onError || (() => {}));
        });
    }
    if (onAbort) {
        req.on('abort', onAbort);
    }
    if (onError) {
        req.on('error', onError);
    }
    req.end();
}
