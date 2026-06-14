// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {buildServerMap} from '../../helpers/serverMap';

test.describe('application', () => {
    let app: ElectronApplication | undefined;
    let userDataDir: string;

    test.beforeAll(async ({}, testInfo) => {
        userDataDir = path.join(testInfo.outputDir, 'userdata');
        fs.mkdirSync(userDataDir, {recursive: true});
        fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(demoConfig));

        const {_electron: electron} = await import('playwright');

        // When running via the unpacked Electron binary (not a packaged app),
        // electron-is-dev resolves isDev=true, so getDeeplinkingURL() expects
        // the 'mattermost-dev://' protocol prefix rather than 'mattermost://'.
        app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu', 'mattermost-dev://github.com/test/url'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });

        const pid = app.process()?.pid;
        if (pid) {
            const registry = path.join(os.tmpdir(), 'mattermost-desktop-e2e-main-pids.txt');
            try {
                fs.appendFileSync(registry, `${pid}\n`, 'utf8');
            } catch { /* non-fatal */ }
        }
    });

    test.afterAll(async () => {
        await app?.close();
        if (userDataDir) {
            await waitForLockFileRelease(userDataDir).catch(() => {});
        }
    });

    test('MM-T1304/MM-T1306 should open the app on the requested deep link', {tag: ['@P2', '@win32']}, async () => {
        await waitForAppReady(app!);
        const serverMap = await buildServerMap(app!);

        const hasGithubWindow = () => app!.windows().some((window) => {
            try {
                return window.url().includes('github.com');
            } catch {
                return false;
            }
        });

        if (!hasGithubWindow()) {
            const deadline = Date.now() + 15_000;
            while (Date.now() < deadline) {
                if (hasGithubWindow()) {
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
        const mainWindow = app!.windows().find((window) => window.url().includes('index'));
        if (!mainWindow) {
            throw new Error('No main window found');
        }

        // Wait for server map to have the github server populated
        const serverName = demoConfig.servers[1].name;
        let resolvedServerMap = serverMap;
        await expect.poll(async () => {
            resolvedServerMap = await buildServerMap(app!);
            return resolvedServerMap[serverName]?.length ?? 0;
        }, {timeout: 15_000}).toBeGreaterThanOrEqual(1);

        // Poll the server view's URL directly via webContents.fromId() instead
        // of navigating contentView.children. On newer Electron versions the
        // WebContentsView tree layout differs between platforms, but
        // webContents.fromId() works universally.
        // Re-resolve the serverMap on each poll iteration in case the webContentsId
        // changes (e.g., a new view was created by openLinkInPrimaryTab).
        await expect.poll(async () => {
            const freshMap = await buildServerMap(app!);
            const freshView = freshMap[serverName]?.[0]?.win;
            return freshView?.url() ?? '';
        }, {timeout: 30_000, message: 'deep-linked webContents did not navigate to the expected URL'}).toContain('github.com/test/url');

        await expect.poll(
            () => mainWindow.innerText('.ServerDropdownButton'),
            {timeout: 15_000, message: 'deep link should activate the github server in the UI'},
        ).toBe('github');
    });
});

test.describe('macOS open-url deep link', () => {
    let app: ElectronApplication | undefined;
    let userDataDir: string;

    test.beforeAll(async ({}, testInfo) => {
        userDataDir = path.join(testInfo.outputDir, 'open-url-userdata');
        fs.mkdirSync(userDataDir, {recursive: true});
        fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(demoConfig));

        const {_electron: electron} = await import('playwright');

        app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });

        const pid = app.process()?.pid;
        if (pid) {
            const registry = path.join(os.tmpdir(), 'mattermost-desktop-e2e-main-pids.txt');
            try {
                fs.appendFileSync(registry, `${pid}\n`, 'utf8');
            } catch { /* non-fatal */ }
        }
    });

    test.afterAll(async () => {
        await app?.close();
        if (userDataDir) {
            await waitForLockFileRelease(userDataDir).catch(() => {});
        }
    });

    test(
        'DL-02 macOS cold start via open-url event navigates to deep link',
        {tag: ['@P1', '@darwin']},
        async () => {
            await waitForAppReady(app!);

            await app!.evaluate(({app: electronApp}) => {
                electronApp.emit('open-url', {preventDefault: () => undefined}, 'mattermost-dev://github.com/test/url');
            });

            const serverName = demoConfig.servers[1].name;
            await expect.poll(async () => {
                const freshMap = await buildServerMap(app!);
                const freshView = freshMap[serverName]?.[0]?.win;
                return freshView?.url() ?? '';
            }, {timeout: 30_000, message: 'open-url deep link should navigate the target server view'}).toContain('github.com/test/url');

            const mainWindow = app!.windows().find((window) => window.url().includes('index'));
            expect(mainWindow).toBeDefined();
            await expect.poll(
                () => mainWindow!.innerText('.ServerDropdownButton'),
                {timeout: 15_000},
            ).toBe('github');
        },
    );
});
