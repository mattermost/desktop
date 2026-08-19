// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoConfig, type AppConfig} from '../../helpers/config';
import {launchDirectTestApp} from '../../helpers/directLaunch';
import {closeElectronAppFast} from '../../helpers/electronApp';
import {ERROR_VIEW_HEADERS, waitForErrorView} from '../../helpers/errorView';
import {buildServerMap} from '../../helpers/serverMap';
import {startStubMattermostServer, type StubMattermostServer} from '../../helpers/stubMattermostServer';
import {evaluateInMainProcessWithArg} from '../../helpers/testRefs';

/**
 * A server that responds normally but reports a Site URL the app cannot parse.
 *
 * Regression coverage for MM-70249: updateServerInfos used to hand that value
 * straight to `new MattermostServer()`, which throws 'Invalid url for creating
 * a server' outside the surrounding try, rejecting the Promise.all and taking
 * the whole app down via CriticalErrorHandler. The bad_servers specs cannot
 * catch this — they all fail at the transport layer, before any client config
 * is parsed.
 */
const INVALID_SITE_URL = 'not-a-url';

// Valid URL, nothing listening — exercises the isSiteURLValidated=false branch.
const UNREACHABLE_SITE_URL = 'http://127.0.0.1:1/';

const BAD_SERVER_NAME = 'Invalid Site URL';
const GOOD_SERVER_NAME = 'Healthy Stub';

async function launchWithServers(
    testInfo: {outputDir: string},
    dirName: string,
    servers: Array<{name: string; url: string; order: number}>,
) {
    const userDataDir = path.join(testInfo.outputDir, dirName);
    fs.mkdirSync(userDataDir, {recursive: true});
    const config: AppConfig = {...demoConfig, servers, lastActiveServer: 0};
    const app = await launchDirectTestApp(userDataDir, config, {MM_E2E_STUB_MESSAGE_BOX: 'cancel'});
    return {app, userDataDir};
}

/** Reads a server's current URL from the main process, or undefined if it is gone. */
function getServerURL(app: ElectronApplication, serverName: string): Promise<string | undefined> {
    return evaluateInMainProcessWithArg(app, (_electron, payload) => {
        const refs = (global as never as {__e2eTestRefs?: any}).__e2eTestRefs;
        const servers: Array<{name: string; url: {toString: () => string}}> =
            refs?.ServerManager?.getAllServers?.() ?? [];
        const server = servers.find((candidate) => candidate.name === payload.serverName);
        return server ? server.url.toString() : undefined;
    }, {serverName});
}

/** Switches the active server via the main process — more deterministic than driving the dropdown. */
function switchToServer(app: ElectronApplication, serverName: string): Promise<boolean> {
    return evaluateInMainProcessWithArg(app, (_electron, payload) => {
        const refs = (global as never as {__e2eTestRefs?: any}).__e2eTestRefs;
        const servers: Array<{id: string; name: string}> = refs?.ServerManager?.getAllServers?.() ?? [];
        const server = servers.find((candidate) => candidate.name === payload.serverName);
        if (!server) {
            return false;
        }
        refs.ServerManager.updateCurrentServer(server.id);
        return true;
    }, {serverName});
}

test.describe('Invalid Site URL', () => {
    test.describe.configure({mode: 'serial'});

    let badServer: StubMattermostServer;
    let goodServer: StubMattermostServer;

    test.beforeAll(async () => {
        badServer = await startStubMattermostServer({siteURL: INVALID_SITE_URL});
        goodServer = await startStubMattermostServer();
    });

    test.afterAll(async () => {
        await Promise.all([badServer?.close(), goodServer?.close()]);
    });

    test('app survives a server reporting an invalid Site URL and other servers still work', {tag: ['@P0', '@all']}, async ({}, testInfo) => {
        const {app, userDataDir} = await launchWithServers(testInfo, 'invalid-site-url-p0', [
            {name: BAD_SERVER_NAME, url: badServer.url, order: 0},
            {name: GOOD_SERVER_NAME, url: goodServer.url, order: 1},
        ]);

        try {
            const mainWindow = await waitForErrorView(app, {
                serverName: BAD_SERVER_NAME,
                kind: 'invalidSiteURL',
            });

            // The regression itself: the main process is still alive. A crashed app
            // fails this evaluate rather than returning.
            await expect.poll(
                () => evaluateInMainProcessWithArg(app, () => true, undefined),
                {timeout: 10_000, message: 'Main process should still be responsive'},
            ).toBe(true);
            expect(app.windows().length).toBeGreaterThan(0);

            // The bad server's URL must not have been rewritten to the garbage value.
            expect(await getServerURL(app, BAD_SERVER_NAME)).toContain(badServer.origin);

            expect(await switchToServer(app, GOOD_SERVER_NAME)).toBe(true);

            await expect.poll(async () => {
                const serverMap = await buildServerMap(app);
                const entry = serverMap[GOOD_SERVER_NAME]?.[0];
                if (!entry) {
                    return '';
                }
                return entry.win.url().catch(() => '');
            }, {
                timeout: 45_000,
                message: 'Healthy server should load after switching away from the misconfigured one',
            }).toContain('127.0.0.1');

            await expect.poll(
                () => mainWindow.$('.ErrorView').then((handle) => handle === null),
                {timeout: 15_000, message: 'ErrorView should clear once a healthy server is active'},
            ).toBe(true);
        } finally {
            await closeElectronAppFast(app, userDataDir);
        }
    });

    test('shows the Site URL error page rather than the connection error page', {tag: ['@P1', '@all']}, async ({}, testInfo) => {
        const {app, userDataDir} = await launchWithServers(testInfo, 'invalid-site-url-p1', [
            {name: BAD_SERVER_NAME, url: badServer.url, order: 0},
        ]);

        try {
            const mainWindow = await waitForErrorView(app, {
                serverName: BAD_SERVER_NAME,
                kind: 'invalidSiteURL',
            });

            const header = await mainWindow.innerText('.ErrorView-header');
            expect(header).toContain(ERROR_VIEW_HEADERS.invalidSiteURL);

            // A future refactor routing this through ErrorState.FAILED would diagnose
            // a connection problem the user does not have.
            expect(header).not.toContain(ERROR_VIEW_HEADERS.failed);
            expect(header).not.toContain(ERROR_VIEW_HEADERS.incompatible);
        } finally {
            await closeElectronAppFast(app, userDataDir);
        }
    });

    test('keeps the configured URL when the reported Site URL is valid but unreachable', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const unreachableSiteURLServer = await startStubMattermostServer({siteURL: UNREACHABLE_SITE_URL});
        const serverName = 'Unreachable Site URL';

        const {app, userDataDir} = await launchWithServers(testInfo, 'invalid-site-url-p2', [
            {name: serverName, url: unreachableSiteURLServer.url, order: 0},
        ]);

        try {
            // updateServerInfos must have read the config before asserting on what it did with it.
            await expect.poll(
                () => unreachableSiteURLServer.getRequestPaths().some((p) => p.startsWith('/api/v4/config/client')),
                {timeout: 45_000, message: 'App should fetch the client config'},
            ).toBe(true);

            // Site URL parses, so it is never treated as misconfigured — but it failed
            // validation, so the configured URL must stand.
            await expect.poll(
                () => getServerURL(app, serverName),
                {timeout: 15_000, message: 'Server URL should not be rewritten to an unvalidated Site URL'},
            ).toContain(unreachableSiteURLServer.origin);

            const mainWindow = app.windows().find((w) => w.url().includes('index'));
            expect(mainWindow).toBeDefined();
            expect(await mainWindow!.$('.ErrorView')).toBeNull();
        } finally {
            await closeElectronAppFast(app, userDataDir);
            await unreachableSiteURLServer.close();
        }
    });
});
