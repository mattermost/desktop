// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
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
        test.skip(process.platform !== 'win32', 'Windows only deep link test');

        userDataDir = path.join(testInfo.outputDir, 'userdata');
        fs.mkdirSync(userDataDir, {recursive: true});
        fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(demoConfig));

        const {_electron: electron} = await import('playwright');
        app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu', 'mattermost://github.com/test/url'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });
    });

    test.afterAll(async () => {
        await app?.close();
        await waitForLockFileRelease(userDataDir);
    });

    test('MM-T1304/MM-T1306 should open the app on the requested deep link', {tag: ['@P2', '@win32']}, async () => {
        await waitForAppReady(app!);
        const serverMap = await buildServerMap(app!);

        if (!app!.windows().some((window) => window.url().includes('github.com'))) {
            await app!.waitForEvent('window', {
                predicate: (window) => window.url().includes('github.com'),
            });
        }
        const mainWindow = app!.windows().find((window) => window.url().includes('index'));
        if (!mainWindow) {
            throw new Error('No main window found');
        }
        const browserWindow = await app!.browserWindow(mainWindow);

        // Wait for server map to have the github server populated
        const serverName = demoConfig.servers[1].name;
        let resolvedServerMap = serverMap;
        if (!resolvedServerMap[serverName] || resolvedServerMap[serverName].length === 0) {
            // Retry getting server map if github server is not ready
            await new Promise((resolve) => setTimeout(resolve, 2000));
            resolvedServerMap = await buildServerMap(app!);
        }

        // Ensure we have the server data before accessing webContentsId
        expect(resolvedServerMap).toHaveProperty(serverName);
        expect(resolvedServerMap[serverName].length).toBeGreaterThanOrEqual(1);

        const webContentsId = resolvedServerMap[serverName][0].webContentsId;
        const isActive = await browserWindow.evaluate((window, id: number) => {
            const view = (window as any).contentView.children.find(
                (v: any) => v.webContents && v.webContents.id === id,
            );
            return view ? view.webContents.getURL() : null;
        }, webContentsId);
        expect(isActive).toBe('https://github.com/test/url/');
        const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton');
        expect(dropdownButtonText).toBe('github');
    });
});
