// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Session} from 'electron';
import {net, session} from 'electron';

import {COOKIE_NAME_AUTH_TOKEN, COOKIE_NAME_CSRF, COOKIE_NAME_USER_ID} from 'common/constants';
import {Logger} from 'common/log';
import {getFormattedPathName} from 'common/utils/url';

import type {ErrorReason} from 'types/server';

const log = new Logger('serverAPI');

export async function getServerAPI(
    url: URL,
    isAuthenticated: boolean,
    onSuccess?: (raw: string) => void,
    onAbort?: () => void,
    onError?: (error: Error, errorReason?: ErrorReason) => void,
    requestSession: Session = session.defaultSession,
) {
    if (isAuthenticated) {
        const cookies = await requestSession.cookies.get({});
        if (!cookies) {
            log.error('Cannot authenticate, no cookies present');
            return;
        }

        // Filter out cookies that aren't part of our domain
        const filteredCookies = cookies.filter((cookie) => cookie.domain && url.toString().indexOf(cookie.domain) >= 0);

        const userId = filteredCookies.find((cookie) => cookie.name === COOKIE_NAME_USER_ID);
        const csrf = filteredCookies.find((cookie) => cookie.name === COOKIE_NAME_CSRF);
        const authToken = filteredCookies.find((cookie) => cookie.name === COOKIE_NAME_AUTH_TOKEN);

        if (!userId || !csrf || !authToken) {
            // Missing cookies needed for req
            log.error('Cannot authenticate, required cookies not found');
            return;
        }
    }

    const req = net.request({
        url: url.toString(),
        session: requestSession,
        useSessionCookies: true,
    });

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
                    try {
                        onSuccess(raw);
                    } catch (e) {
                        const error = `Error parsing server data from ${url.toString()}`;
                        log.error(error);
                        onError?.(new Error(error));
                    }
                });
            } else {
                onError?.(
                    new Error(`Bad status code ${response.statusCode} requesting from ${url.toString()}`),
                    {
                        needsBasicAuth: response.statusCode === 401 && response.headers['www-authenticate']?.includes('Basic'),
                        needsPreAuth: response.statusCode === 403 && response.headers['x-reject-reason']?.includes('pre-auth'),
                    },
                );
            }
            response.on('error', onError || (() => {}));
        });
    }
    if (onAbort) {
        req.on('abort', onAbort);
    }
    if (onError) {
        req.on('error', (error) => {
            onError(error, {needsClientCert: error.message.includes('ERR_SSL_CLIENT_AUTH_CERT_NEEDED')});
        });
    }
    req.end();
}

export async function requestPluginAuthHandoff(
    serverURL: URL,
    targetPath: string,
    requestSession: Session = session.defaultSession,
): Promise<URL> {
    const basePath = getFormattedPathName(serverURL.pathname);
    const apiURL = new URL(`${basePath}api/v4/users/me/plugin_auth_handoff`, serverURL.origin);

    const cookies = await requestSession.cookies.get({url: apiURL.toString()});
    const userId = cookies.find((cookie) => cookie.name === COOKIE_NAME_USER_ID);
    const csrf = cookies.find((cookie) => cookie.name === COOKIE_NAME_CSRF);
    const authToken = cookies.find((cookie) => cookie.name === COOKIE_NAME_AUTH_TOKEN);

    if (!userId || !csrf || !authToken) {
        throw new Error('Cannot authenticate plugin handoff, required cookies not found');
    }

    return new Promise((resolve, reject) => {
        const req = net.request({
            method: 'POST',
            url: apiURL.toString(),
            session: requestSession,
            useSessionCookies: true,
        });
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('X-CSRF-Token', csrf.value);

        req.on('response', (response: Electron.IncomingMessage) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Bad status code ${response.statusCode} requesting plugin auth handoff`));
                return;
            }

            let raw = '';
            response.on('data', (chunk: Buffer) => {
                raw += `${chunk}`;
            });
            response.on('end', () => {
                try {
                    const parsed = JSON.parse(raw) as {token?: unknown};
                    if (typeof parsed.token !== 'string' || parsed.token.length === 0) {
                        reject(new Error('Invalid plugin auth handoff response'));
                        return;
                    }
                    resolve(new URL(`${basePath}auth/plugin_handoff?token=${encodeURIComponent(parsed.token)}`, serverURL.origin));
                } catch (e) {
                    reject(e instanceof Error ? e : new Error('Failed to parse plugin auth handoff response'));
                }
            });
            response.on('error', (error: Error) => reject(error));
        });
        req.on('abort', () => reject(new Error('Plugin auth handoff request aborted')));
        req.on('error', (error: Error) => reject(error));

        req.write(JSON.stringify({target_path: targetPath}));
        req.end();
    });
}
