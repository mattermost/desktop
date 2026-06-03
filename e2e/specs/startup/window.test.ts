// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForLockFileRelease} from '../../helpers/cleanup';

async function waitForMainBrowserWindow(app: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>) {
    await expect.poll(
        async () => {
            try {
                return await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().length);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (message.includes('Execution context was destroyed')) {
                    return 0;
                }
                throw error;
            }
        },
        {timeout: 10_000},
    ).toBeGreaterThan(0);
}

async function resizeMainBrowserWindow(app: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>) {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            await app.evaluate(({BrowserWindow}) => {
                const win = BrowserWindow.getAllWindows()[0];
                if (!win) {
                    throw new Error('Main BrowserWindow not available');
                }
                win.setSize(800, 600);
                win.setPosition(100, 100);
            });
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
                attempt < 4 &&
                (message.includes('Execution context was destroyed') || message.includes('Main BrowserWindow not available'))
            ) {
                await new Promise((resolve) => setTimeout(resolve, 250));
                continue;
            }
            throw error;
        }
    }
}

async function getMainBrowserWindowBounds(app: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>) {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            return await app.evaluate(({BrowserWindow}) => {
                const win = BrowserWindow.getAllWindows()[0];
                if (!win) {
                    throw new Error('Main BrowserWindow not available');
                }
                return win.getBounds();
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
                attempt < 4 &&
                (message.includes('Execution context was destroyed') || message.includes('Main BrowserWindow not available'))
            ) {
                await new Promise((resolve) => setTimeout(resolve, 250));
                continue;
            }
            throw error;
        }
    }

    throw new Error('Main BrowserWindow bounds were not available');
}

test.describe('startup/window', () => {
    test(
        'MM-T4403_1 should restore window bounds on restart',
        {tag: ['@P2', '@darwin', '@win32']}, // skipped on Linux
        async ({electronApp}, testInfo) => {
            // Resize to a known size
            await waitForMainBrowserWindow(electronApp);
            await resizeMainBrowserWindow(electronApp);

            // Save bounds by closing (app persists bounds on close)
            const userDataDir = path.join(testInfo.outputDir, 'userdata');
            await electronApp.close();
            await waitForLockFileRelease(userDataDir);

            // Relaunch with the SAME userDataDir (do not clean it)
            const {_electron: electron} = await import('playwright');
            const {electronBinaryPath, appDir} = await import('../../helpers/config');
            const {waitForAppReady} = await import('../../helpers/appReadiness');

            const app2 = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 90_000,
            });

            try {
                await waitForAppReady(app2);
                await waitForMainBrowserWindow(app2);
                const bounds = await getMainBrowserWindowBounds(app2);

                // Allow tolerance for OS window decoration differences
                const tolerance = process.platform === 'darwin' ? 250 : 10;
                expect(Math.abs(bounds.width - 800)).toBeLessThanOrEqual(tolerance);
                expect(Math.abs(bounds.height - 600)).toBeLessThanOrEqual(tolerance);
            } finally {
                await app2.close();
            }
        },
    );

    test(
        'MM-T4403_2 should NOT restore window bounds if x is outside view area',
        {tag: ['@P2', '@all']},
        async ({electronApp}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'userdata');

            // Write bounds with x far off-screen (after close so the app doesn't overwrite it)
            await electronApp.close();
            await waitForLockFileRelease(userDataDir);
            fs.writeFileSync(
                path.join(userDataDir, 'bounds-info.json'),
                JSON.stringify({x: -9999, y: 0, width: 800, height: 600}),
            );
            const {_electron: electron} = await import('playwright');
            const {electronBinaryPath, appDir} = await import('../../helpers/config');
            const {waitForAppReady} = await import('../../helpers/appReadiness');

            const app2 = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 90_000,
            });

            try {
                await waitForAppReady(app2);
                await waitForMainBrowserWindow(app2);
                const bounds = await getMainBrowserWindowBounds(app2);

                // Window should be on-screen (x >= 0)
                expect(bounds.x).toBeGreaterThanOrEqual(0);
            } finally {
                await app2.close();
            }
        },
    );

    test(
        'MM-T4403_3 should NOT restore window bounds if y is outside view area',
        {tag: ['@P2', '@all']},
        async ({electronApp}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'userdata');

            // Write bounds with y far off-screen (after close so the app doesn't overwrite it)
            await electronApp.close();
            await waitForLockFileRelease(userDataDir);
            fs.writeFileSync(
                path.join(userDataDir, 'bounds-info.json'),
                JSON.stringify({x: 0, y: -9999, width: 800, height: 600}),
            );
            const {_electron: electron} = await import('playwright');
            const {electronBinaryPath, appDir} = await import('../../helpers/config');
            const {waitForAppReady} = await import('../../helpers/appReadiness');

            const app2 = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 90_000,
            });

            try {
                await waitForAppReady(app2);
                await waitForMainBrowserWindow(app2);
                const bounds = await getMainBrowserWindowBounds(app2);
                expect(bounds.y).toBeGreaterThanOrEqual(0);
            } finally {
                await app2.close();
            }
        },
    );
});
