// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import http from 'http';
import type {AddressInfo} from 'net';

/**
 * A loopback server that answers the handful of endpoints ServerInfo fetches
 * (see src/main/server/serverInfo.ts), so specs can control exactly what a
 * server reports in its client configuration without needing a live Mattermost.
 *
 * The transport-level bad-server specs (server_management/bad_servers.test.ts)
 * all fail before the app ever parses a client config; this covers the opposite
 * case, where the server responds perfectly well but reports something the app
 * cannot use.
 */
export type StubMattermostServer = {
    origin: string;
    url: string;
    close: () => Promise<void>;
};

export type StubMattermostServerOptions = {

    /** Value reported as SiteURL in the client config. Omit to report none. */
    siteURL?: string;

    /** Value reported as Version in the client config. */
    version?: string;
};

const STUB_SERVER_HTML =
    '<!doctype html><html><head><title>mm-e2e-stub-server</title></head>' +
    '<body><div id="mm-e2e-stub-server">mm-e2e-stub-server</div></body></html>';

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

export async function startStubMattermostServer(
    options: StubMattermostServerOptions = {},
): Promise<StubMattermostServer> {
    const {siteURL, version = '10.0.0'} = options;

    const server = http.createServer((req, res) => {
        const url = req.url ?? '/';

        res.setHeader('Cache-Control', 'no-store');

        if (url.startsWith('/api/v4/system/ping')) {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({status: 'OK'}));
            return;
        }

        if (url.startsWith('/api/v4/config/client')) {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                Version: version,
                SiteName: 'Stub Server',
                ...(siteURL === undefined ? {} : {SiteURL: siteURL}),
            }));
            return;
        }

        if (url.startsWith('/api/v4/plugins/webapp')) {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end('[]');
            return;
        }

        if (url.startsWith('/api/v4/license/client')) {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end('{}');
            return;
        }

        // Everything else — including the root URL the view actually loads —
        // returns a page that loads cleanly, so the failure under test is the
        // reported configuration rather than the load itself.
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(STUB_SERVER_HTML);
    });

    const port = await listen(server);
    const origin = `http://127.0.0.1:${port}`;

    return {
        origin,
        url: `${origin}/`,
        close: () => closeServer(server),
    };
}
