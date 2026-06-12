// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../../helpers/config';

test.describe('startup/window_reposition', () => {
    test.describe.configure({mode: 'serial'});
    test.setTimeout(120_000);

    // ── MM-T2636: Reposition Desktop app ───────────────────────────────
    test('MM-T2636 Reposition Desktop app',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const {mkdirSync} = await import('fs');
            const userDataDir = path.join(testInfo.outputDir, 'reposition-userdata');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, demoConfig);

            // Launch app
            const app = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 90_000,
            });

            try {
                await waitForAppReady(app);

                // Get initial window position
                const initialBounds = await getMainWindowBounds(app);
                expect(initialBounds, 'Should get initial window bounds').toBeTruthy();

                // Move the window to a new position. Target the canonical
                // main window via __e2eTestRefs so we don't accidentally move
                // a popout or Calls widget if one is open.
                const newX = 200;
                const newY = 150;
                await app.evaluate(({BrowserWindow}, pos: {x: number; y: number}) => {
                    const refs = (global as any).__e2eTestRefs;
                    const main = refs?.MainWindow?.get?.() ?? BrowserWindow.getAllWindows()[0];
                    main?.setPosition(pos.x, pos.y);
                }, {x: newX, y: newY});

                // Wait for the move to take effect — poll until position is near target
                // (window managers may snap coordinates by a pixel or two).
                const positionTolerance = 50;
                await expect.poll(
                    async () => {
                        const b = await getMainWindowBounds(app);
                        return Math.abs(b!.x - newX) + Math.abs(b!.y - newY);
                    },
                    {timeout: 5_000, message: 'Window position must update after setPosition'},
                ).toBeLessThanOrEqual(positionTolerance);

                // Verify the window moved
                const movedBounds = await getMainWindowBounds(app);
                expect(
                    Math.abs(movedBounds!.x - newX),
                    `Window x should be near ${newX}`,
                ).toBeLessThanOrEqual(50);
                expect(
                    Math.abs(movedBounds!.y - newY),
                    `Window y should be near ${newY}`,
                ).toBeLessThanOrEqual(50);

                const savedBounds = {
                    ...movedBounds,
                    maximized: false,
                    fullscreen: false,
                };
                await app.close();
                await waitForLockFileRelease(userDataDir);

                const {writeFileSync} = await import('fs');
                writeFileSync(
                    path.join(userDataDir, 'bounds-info.json'),
                    JSON.stringify(savedBounds),
                );

                // Relaunch and verify position is restored
                const app2 = await electron.launch({
                    executablePath: electronBinaryPath,
                    args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                    env: {...process.env, NODE_ENV: 'test'},
                    timeout: 90_000,
                });

                try {
                    await waitForAppReady(app2);
                    const restoredBounds = await getMainWindowBounds(app2);

                    // Position should be restored (within tolerance for OS window decorations)
                    const tolerance = process.platform === 'darwin' ? 250 : 50;
                    expect(
                        Math.abs(restoredBounds!.x - newX),
                        `Restored x should be near ${newX}`,
                    ).toBeLessThanOrEqual(tolerance);
                    expect(
                        Math.abs(restoredBounds!.y - newY),
                        `Restored y should be near ${newY}`,
                    ).toBeLessThanOrEqual(tolerance);
                } finally {
                    await app2.close();
                }
            } finally {
                await app.close().catch(() => {});
                await waitForLockFileRelease(userDataDir).catch(() => {});
            }
        },
    );
});

async function getMainWindowBounds(app: Awaited<ReturnType<typeof electron.launch>>) {
    for (let attempt = 0; attempt < 10; attempt++) {
        try {
            return await app.evaluate(({BrowserWindow}) => {
                const refs = (global as any).__e2eTestRefs;
                const win = refs?.MainWindow?.get?.() ?? BrowserWindow.getAllWindows()[0];
                if (!win) {
                    throw new Error('Main BrowserWindow not available');
                }
                return win.getBounds();
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
                attempt < 9 &&
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
