// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';
import {launchDirectTestApp} from '../../helpers/directLaunch';
import {closeElectronApp, closeElectronAppFast} from '../../helpers/electronApp';
import {evaluateInMainProcess} from '../../helpers/testRefs';

test.describe('startup/window_reposition', () => {
    test.describe.configure({mode: 'serial'});
    test.setTimeout(120_000);

    // ── MM-T2636: Reposition Desktop app ───────────────────────────────
    // Multi-monitor (add a 2nd display, 50% off-screen, unplug) is not
    // automatable in CI. Geometry for a missing display is covered by
    // src/main/app/utils.test.js (resizeScreen) and
    // src/app/mainWindow/mainWindow.test.js (bounds outside screen).
    test('MM-T2636 MM-T1428 MM-T1660 Reposition Desktop app',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const {mkdirSync} = await import('fs');
            const userDataDir = path.join(testInfo.outputDir, 'reposition-userdata');
            mkdirSync(userDataDir, {recursive: true});

            let appClosed = false;

            // Launch app
            const app = await launchDirectTestApp(userDataDir, demoConfig);

            try {
                // Get initial window position
                const initialBounds = await getMainWindowBounds(app);
                expect(initialBounds, 'Should get initial window bounds').toBeTruthy();

                // Move the window to a new position. Target the canonical
                // main window via __e2eTestRefs so we don't accidentally move
                // a popout or Calls widget if one is open.
                const newX = 200;
                const newY = 150;
                await app.evaluate((_electron, pos: {x: number; y: number}) => {
                    const refs = (global as any).__e2eTestRefs;
                    const main = refs?.MainWindow?.get?.();
                    if (!main) {
                        throw new Error('MainWindow test ref is not available');
                    }
                    main.setPosition(pos.x, pos.y);
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

                // Linux CI (Xvfb, often no window manager) does not honor
                // BrowserWindow.minimize() — MM-T824 is darwin/win32-only for
                // the same reason. Wait for the transition when it happens;
                // otherwise skip restore rather than fail the reposition case.
                await app.evaluate(async () => {
                    const refs = (global as any).__e2eTestRefs;
                    const main = refs?.MainWindow?.get?.();
                    if (!main) {
                        throw new Error('MainWindow test ref is not available');
                    }

                    const waitForMinimized = async (expected: boolean) => {
                        const timeoutMs = process.platform === 'linux' ? 1_000 : 5_000;
                        const deadline = Date.now() + timeoutMs;
                        while (Date.now() < deadline) {
                            if (Boolean(main.isMinimized()) === expected) {
                                return true;
                            }
                            await new Promise((resolve) => setTimeout(resolve, 50));
                        }
                        return false;
                    };

                    main.minimize();
                    const didMinimize = await waitForMinimized(true);
                    if (!didMinimize) {
                        if (process.platform === 'linux') {
                            return;
                        }
                        throw new Error('Window isMinimized() did not become true');
                    }
                    main.restore();
                    if (!await waitForMinimized(false)) {
                        throw new Error('Window isMinimized() did not become false');
                    }
                });
                const afterMinimizeBounds = await getMainWindowBounds(app);
                expect(
                    Math.abs(afterMinimizeBounds!.x - newX),
                    'Window x should remain near the repositioned x after minimize/restore',
                ).toBeLessThanOrEqual(50);
                expect(
                    Math.abs(afterMinimizeBounds!.y - newY),
                    'Window y should remain near the repositioned y after minimize/restore',
                ).toBeLessThanOrEqual(50);

                // The app persists bounds itself in MainWindow.onBlur ->
                // saveWindowState(boundsInfoPath) (src/app/mainWindow/mainWindow.ts).
                // This spec used to write bounds-info.json itself and then assert on it,
                // so the check could not fail; assert what the *app* wrote instead.
                //
                // Emit 'blur' on the BrowserWindow rather than calling focus()/blur():
                // those depend on the OS window server actually moving focus, which does
                // not happen on a CI runner with no active desktop session, and a
                // real BrowserWindow.blur() on an unfocused window is a no-op. The handler
                // is registered with browserWindow.on('blur', this.onBlur) and MainWindow.get()
                // returns that same emitter, so this runs the production save path for real.
                const boundsInfoFile = path.join(userDataDir, 'bounds-info.json');
                const {readFileSync} = await import('fs');
                const persistedOffset = () => {
                    try {
                        const persisted = JSON.parse(readFileSync(boundsInfoFile, 'utf-8'));
                        return Math.abs(persisted.x - movedBounds!.x) + Math.abs(persisted.y - movedBounds!.y);
                    } catch {
                        return Number.MAX_SAFE_INTEGER;
                    }
                };

                await evaluateInMainProcess(app, () => {
                    const main = (global as any).__e2eTestRefs?.MainWindow?.get?.();
                    if (!main) {
                        throw new Error('MainWindow test ref is not available');
                    }
                    main.emit('blur');
                });

                await expect.poll(persistedOffset, {
                    timeout: 15_000,
                    message: 'App must persist the repositioned bounds to bounds-info.json',
                }).toBeLessThanOrEqual(10);

                const savedBounds = JSON.parse(readFileSync(boundsInfoFile, 'utf-8'));
                await closeElectronApp(app, userDataDir);
                appClosed = true;

                // Restoring those bounds on relaunch needs a window manager that honors
                // setBounds: Xvfb (Linux CI) and Windows CI do not — see startup/window.test.ts.
                // Persistence above is asserted on every platform; only the restore half is skipped.
                if (process.env.CI && (process.platform === 'linux' || process.platform === 'win32')) {
                    test.info().annotations.push({
                        type: 'skip-reason',
                        description: 'Relaunch bounds restore is not reliable under Xvfb / Windows CI window managers',
                    });
                    return;
                }

                // Relaunch and verify position is restored
                const app2 = await launchDirectTestApp(userDataDir, demoConfig, {writeConfig: false});

                try {
                    const restoredBounds = await getMainWindowBounds(app2);

                    // Position should be restored (within tolerance for OS window decorations)
                    const tolerance = process.platform === 'darwin' ? 250 : 50;
                    expect(
                        Math.abs(restoredBounds!.x - savedBounds.x),
                        `Restored x should be near ${savedBounds.x}`,
                    ).toBeLessThanOrEqual(tolerance);
                    expect(
                        Math.abs(restoredBounds!.y - savedBounds.y),
                        `Restored y should be near ${savedBounds.y}`,
                    ).toBeLessThanOrEqual(tolerance);
                } finally {
                    await closeElectronAppFast(app2, userDataDir);
                }
            } finally {
                if (!appClosed) {
                    await closeElectronAppFast(app, userDataDir);
                }
            }
        },
    );
});

async function getMainWindowBounds(app: ElectronApplication) {
    for (let attempt = 0; attempt < 10; attempt++) {
        try {
            return await app.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const win = refs?.MainWindow?.get?.();
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
