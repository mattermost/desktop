// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientRequest, Session} from 'electron';
import {net, session} from 'electron';

import {COOKIE_NAME_AUTH_TOKEN, COOKIE_NAME_CSRF, COOKIE_NAME_USER_ID} from 'common/constants';
import {Logger} from 'common/log';

import type {ErrorReason} from 'types/server';

const log = new Logger('serverAPI');

/**
 * Performs a network request to the Mattermost server API with session authentication cookies,
 * optional abort signal support, and callbacks for response, abort, and error events.
 *
 * @param url - The target endpoint URL.
 * @param isAuthenticated - Whether authentication cookies are required for the request.
 * @param onSuccess - Callback invoked with the raw response body on HTTP 200.
 * @param onAbort - Callback invoked when the request is aborted.
 * @param onError - Callback invoked with an error if the request fails or returns a non-200 status.
 * @param requestSession - Optional Electron session to retrieve cookies and dispatch the request from.
 * @param signal - Optional AbortSignal to cancel the request before or while in flight.
 * @returns The underlying Electron ClientRequest if created, or undefined.
 */
export async function getServerAPI(
    url: URL,
    isAuthenticated: boolean,
    onSuccess?: (raw: string) => void,
    onAbort?: () => void,
    onError?: (error: Error, errorReason?: ErrorReason) => void,
    requestSession: Session = session.defaultSession,
    signal?: AbortSignal,
): Promise<ClientRequest | undefined | void> {
    if (signal?.aborted) {
        onAbort?.();
        return undefined;
    }

    if (isAuthenticated) {
        const cookies = await requestSession.cookies.get({});
        if (signal?.aborted) {
            onAbort?.();
            return undefined;
        }
        if (!cookies) {
            log.error('Cannot authenticate, no cookies present');
            return undefined;
        }

        // Filter out cookies that aren't part of our domain
        const filteredCookies = cookies.filter((cookie) => cookie.domain && url.toString().indexOf(cookie.domain) >= 0);

        const userId = filteredCookies.find((cookie) => cookie.name === COOKIE_NAME_USER_ID);
        const csrf = filteredCookies.find((cookie) => cookie.name === COOKIE_NAME_CSRF);
        const authToken = filteredCookies.find((cookie) => cookie.name === COOKIE_NAME_AUTH_TOKEN);

        if (!userId || !csrf || !authToken) {
            // Missing cookies needed for req
            log.error('Cannot authenticate, required cookies not found');
            return undefined;
        }
    }

    const req = net.request({
        url: url.toString(),
        session: requestSession,
        useSessionCookies: true,
    });

    const onSignalAbort = () => {
        try {
            req.abort();
        } catch {
            // Ignore abort error
        }
    };

    if (signal) {
        if (signal.aborted) {
            onSignalAbort();
            return req;
        }
        signal.addEventListener('abort', onSignalAbort, {once: true});
    }

    const cleanupSignal = () => {
        if (signal) {
            signal.removeEventListener('abort', onSignalAbort);
        }
    };

    if (onSuccess) {
        req.on('response', (response: Electron.IncomingMessage) => {
            log.silly('response');
            if (response.statusCode === 200) {
                let raw = '';
                response.on('data', (chunk: Buffer) => {
                    log.silly('response.data');
                    raw += `${chunk}`;
                });
                response.on('end', () => {
                    cleanupSignal();
                    try {
                        onSuccess(raw);
                    } catch (e) {
                        const error = `Error parsing server data from ${url.toString()}`;
                        log.error(error);
                        onError?.(new Error(error));
                    }
                });
            } else {
                cleanupSignal();
                onError?.(
                    new Error(`Bad status code ${response.statusCode} requesting from ${url.toString()}`),
                    {
                        needsBasicAuth: response.statusCode === 401 && response.headers['www-authenticate']?.includes('Basic'),
                        needsPreAuth: response.statusCode === 403 && response.headers['x-reject-reason']?.includes('pre-auth'),
                    },
                );
            }
            response.on('error', (err) => {
                cleanupSignal();
                onError?.(err);
            });
        });
    }
    if (onAbort) {
        req.on('abort', () => {
            cleanupSignal();
            onAbort();
        });
    }
    if (onError) {
        req.on('error', (error) => {
            cleanupSignal();
            onError(error, {needsClientCert: error.message.includes('ERR_SSL_CLIENT_AUTH_CERT_NEEDED')});
        });
    }
    req.end();
    return req;
}
