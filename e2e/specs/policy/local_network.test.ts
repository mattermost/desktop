// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {test as base, expect, type AppConfig} from '../../fixtures/index';
import {localNetworkConfig} from '../../helpers/config';
import {startLocalNetworkServers, type LocalNetworkServers} from '../../helpers/localNetworkServers';

/**
 * MM-69241 — server content must not reach the local/private network, while the configured
 * (possibly self-hosted/local) server stays reachable. These specs exercise the real
 * Electron onBeforeRequest filter end-to-end, which the unit tests can only mock.
 */
const test = base.extend<{localServers: LocalNetworkServers}>({
    localServers: async ({}, use) => {
        const servers = await startLocalNetworkServers();
        await use(servers);
        await servers.close();
    },

    // Depends on localServers so the dynamic fakeServer port is up before the app launches.
    appConfig: async ({localServers}, use) => {
        const config: AppConfig = localNetworkConfig(localServers.fakeServerUrl);
        await use(config);
    },
});

// executeJavaScript directly (top-level promise is awaited), unlike ServerView.runInRenderer.
async function fetchFromView(
    app: ElectronApplication,
    webContentsId: number,
    url: string,
): Promise<{ok: boolean; body?: string; error?: string}> {
    return app.evaluate(async ({webContents}, payload) => {
        const wc = webContents.fromId(payload.id);
        if (!wc || wc.isDestroyed()) {
            throw new Error(`webContents ${payload.id} is not available`);
        }
        return wc.executeJavaScript(
            `fetch(${JSON.stringify(payload.url)}, {cache: 'no-store'})
                .then((response) => response.text())
                .then((body) => ({ok: true, body}))
                .catch((error) => ({ok: false, error: String(error)}))`,
            true,
        );
    }, {id: webContentsId, url}) as Promise<{ok: boolean; body?: string; error?: string}>;
}

// Injects a hidden iframe. The `load` event fires even for blocked/cross-origin frames, so
// `event` is informational; judge success by `bodyText` (same-origin commit) or a hit counter.
async function embedIframe(
    app: ElectronApplication,
    webContentsId: number,
    url: string,
    timeoutMs = 8000,
): Promise<{event: 'load' | 'error' | 'timeout'; bodyText: string | null}> {
    return app.evaluate(async ({webContents}, payload) => {
        const wc = webContents.fromId(payload.id);
        if (!wc || wc.isDestroyed()) {
            throw new Error(`webContents ${payload.id} is not available`);
        }
        return wc.executeJavaScript(
            `new Promise((resolve) => {
                const frame = document.createElement('iframe');
                let settled = false;
                const finish = (event) => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    let bodyText = null;
                    try {
                        bodyText = frame.contentDocument && frame.contentDocument.body ?
                            frame.contentDocument.body.textContent : null;
                    } catch (e) {
                        bodyText = null;
                    }
                    resolve({event, bodyText});
                };
                frame.addEventListener('load', () => finish('load'));
                frame.addEventListener('error', () => finish('error'));
                setTimeout(() => finish('timeout'), ${payload.timeoutMs});
                frame.style.display = 'none';
                frame.src = ${JSON.stringify(payload.url)};
                document.body.appendChild(frame);
            })`,
            true,
        );
    }, {id: webContentsId, url, timeoutMs}) as Promise<{event: 'load' | 'error' | 'timeout'; bodyText: string | null}>;
}

// Registers a service worker, then has it fetch `targetUrl` from its own (webContents-less)
// context and report back — exercising whether worker requests bypass the filter.
async function serviceWorkerFetch(
    app: ElectronApplication,
    webContentsId: number,
    swUrl: string,
    targetUrl: string,
): Promise<{ok: boolean; body?: string; error?: string}> {
    return app.evaluate(async ({webContents}, payload) => {
        const wc = webContents.fromId(payload.id);
        if (!wc || wc.isDestroyed()) {
            throw new Error(`webContents ${payload.id} is not available`);
        }
        return wc.executeJavaScript(
            `new Promise((resolve) => {
                (async () => {
                    try {
                        if (!('serviceWorker' in navigator)) {
                            resolve({ok: false, error: 'no-serviceWorker'});
                            return;
                        }
                        const registration = await navigator.serviceWorker.register(${JSON.stringify(payload.swUrl)});
                        await navigator.serviceWorker.ready;
                        const worker = registration.active || navigator.serviceWorker.controller;
                        if (!worker) {
                            resolve({ok: false, error: 'no-active-worker'});
                            return;
                        }
                        const channel = new MessageChannel();
                        const reply = new Promise((res) => {
                            channel.port1.onmessage = (event) => res(event.data);
                        });
                        worker.postMessage({url: ${JSON.stringify(payload.targetUrl)}}, [channel.port2]);
                        const timeout = new Promise((res) => setTimeout(() => res({ok: false, error: 'timeout'}), 6000));
                        resolve(await Promise.race([reply, timeout]));
                    } catch (error) {
                        resolve({ok: false, error: String(error)});
                    }
                })();
            })`,
            true,
        );
    }, {id: webContentsId, swUrl, targetUrl}) as Promise<{ok: boolean; body?: string; error?: string}>;
}

test.describe('local network access policy (MM-69241)', {tag: ['@P0', '@all']}, () => {
    test('blocks server content from reaching an unrelated local service', async ({electronApp, serverMap, localServers}) => {
        const entry = serverMap.local?.[0];
        expect(entry, 'configured server view should exist').toBeTruthy();

        const before = localServers.getSecretHitCount();
        const result = await fetchFromView(electronApp, entry!.webContentsId, localServers.secretUrl);

        expect(result.ok, 'fetch to a non-configured local service must be blocked').toBe(false);
        expect(
            localServers.getSecretHitCount(),
            'a blocked request must never reach the internal service',
        ).toBe(before);
    });

    test('allows requests to the configured server origin', async ({electronApp, serverMap, localServers}) => {
        const entry = serverMap.local?.[0];
        expect(entry, 'configured server view should exist').toBeTruthy();

        const result = await fetchFromView(electronApp, entry!.webContentsId, `${localServers.fakeServerOrigin}/ping`);

        expect(result.ok, 'requests to the configured server must still be allowed').toBe(true);
    });

    test('blocks local subframe navigation but allows ordinary http subframes', async ({electronApp, serverMap, localServers}) => {
        const entry = serverMap.local?.[0];
        expect(entry, 'configured server view should exist').toBeTruthy();

        // Hit counter is the source of truth: an iframe's load event fires even when blocked.
        const before = localServers.getSecretHitCount();
        await embedIframe(electronApp, entry!.webContentsId, localServers.secretUrl);
        expect(
            localServers.getSecretHitCount(),
            'a blocked subframe must never reach the internal service',
        ).toBe(before);

        // The guard must not preventDefault http(s) subframes — that previously broke embeds
        // like YouTube. Cross-origin acceptance is covered by the isAllowedSubframeNavigation unit test.
        const allowed = await embedIframe(electronApp, entry!.webContentsId, `${localServers.fakeServerOrigin}/embed`);
        expect(allowed.bodyText, 'ordinary http subframes must still load and commit').toContain('mm-e2e-fake-server');
    });

    // Bypass paths flagged in review. These assert the secure outcome; a failure means the
    // path bypasses the filter and the product must be fixed.

    test('blocks a redirect from the configured server to a local service', async ({electronApp, serverMap, localServers}) => {
        const entry = serverMap.local?.[0];
        expect(entry, 'configured server view should exist').toBeTruthy();

        const before = localServers.getSecretHitCount();
        await fetchFromView(electronApp, entry!.webContentsId, `${localServers.fakeServerOrigin}/redirect`);

        expect(
            localServers.getSecretHitCount(),
            'a redirect to a local service must be blocked (request never reaches it)',
        ).toBe(before);
    });

    test('blocks a service worker from reaching a local service', async ({electronApp, serverMap, localServers}) => {
        const entry = serverMap.local?.[0];
        expect(entry, 'configured server view should exist').toBeTruthy();

        const before = localServers.getSecretHitCount();
        const result = await serviceWorkerFetch(
            electronApp,
            entry!.webContentsId,
            `${localServers.fakeServerOrigin}/sw.js`,
            localServers.secretUrl,
        );

        expect(
            localServers.getSecretHitCount(),
            'a service worker request to a local service must be blocked',
        ).toBe(before);
        expect(result.ok, 'service worker must not read the local service response').toBe(false);
    });
});
