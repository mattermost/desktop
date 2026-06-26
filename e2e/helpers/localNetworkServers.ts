// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import http from 'http';
import type {AddressInfo} from 'net';

/**
 * Loopback servers for the local-network policy spec: fakeServer is the configured
 * (trusted) Mattermost server; secretService is an unrelated internal service the policy
 * must keep server content from reaching, and counts every request it receives.
 */
export type LocalNetworkServers = {
    fakeServerOrigin: string;
    fakeServerUrl: string;
    secretUrl: string;
    getSecretHitCount: () => number;
    close: () => Promise<void>;
};

const FAKE_SERVER_HTML =
    '<!doctype html><html><head><title>mm-e2e-fake-server</title></head>' +
    '<body><div id="mm-e2e-fake-server">mm-e2e-fake-server</div></body></html>';

// On message, fetches the given URL from the worker context (which may lack an owning
// webContents) and reports the outcome back over the provided MessagePort.
const SERVICE_WORKER_JS = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
    const url = event.data && event.data.url;
    const port = event.ports && event.ports[0];
    fetch(url, {cache: 'no-store'})
        .then((response) => response.text())
        .then((body) => { if (port) { port.postMessage({ok: true, body: body}); } })
        .catch((error) => { if (port) { port.postMessage({ok: false, error: String(error)}); } });
});
`;

function listen(server: http.Server): Promise<number> {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            resolve((server.address() as AddressInfo).port);
        });
    });
}

function closeServer(server: http.Server): Promise<void> {
    return new Promise((resolve) => server.close(() => resolve()));
}

export async function startLocalNetworkServers(): Promise<LocalNetworkServers> {
    let secretHitCount = 0;

    // Permissive CORS mirrors the worst case: a local service that would allow its body to be read.
    const secretService = http.createServer((req, res) => {
        secretHitCount++;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store');
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('top-secret');
    });
    const secretPort = await listen(secretService);
    const secretUrl = `http://127.0.0.1:${secretPort}/secret`;

    const fakeServer = http.createServer((req, res) => {
        const url = req.url ?? '/';

        // Same-origin redirect to the internal service (redirect-bypass test).
        if (url.startsWith('/redirect')) {
            res.writeHead(302, {Location: secretUrl});
            res.end();
            return;
        }

        if (url.startsWith('/sw.js')) {
            res.writeHead(200, {'Content-Type': 'text/javascript', 'Cache-Control': 'no-store'});
            res.end(SERVICE_WORKER_JS);
            return;
        }

        // CORS so an allow-path fetch succeeds regardless of requesting origin.
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store');
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(FAKE_SERVER_HTML);
    });
    const fakePort = await listen(fakeServer);
    const fakeServerOrigin = `http://127.0.0.1:${fakePort}`;

    return {
        fakeServerOrigin,
        fakeServerUrl: `${fakeServerOrigin}/`,
        secretUrl,
        getSecretHitCount: () => secretHitCount,
        close: async () => {
            await Promise.all([closeServer(fakeServer), closeServer(secretService)]);
        },
    };
}
