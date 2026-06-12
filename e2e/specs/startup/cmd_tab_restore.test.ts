// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

// ── MM-T2617: Reopen Mac Desktop App window on Cmd+Tab ────────────────
// Cmd+Tab triggers the Electron 'activate' app event. The production handler
// (src/main/app/initialize.ts) calls MainWindow.show() + MainWindow.focus()
// when the app receives 'activate' while the window is hidden.
//
// We simulate this by hiding the main window, then emitting 'activate' and
// verifying the window becomes visible again. This mirrors the hide/show
// pattern used in tray_restore.test.ts.

test.describe('startup/cmd_tab_restore', () => {
    test('MM-T2617 Reopen Mac Desktop App window on Cmd+Tab — macOS ONLY',
        {tag: ['@P2', '@darwin']},
        async ({electronApp}) => {
            if (process.platform !== 'darwin') {
                test.skip(true, 'macOS only');
                return;
            }

            // Verify main window is visible initially
            await expect.poll(
                () => electronApp.evaluate(({BrowserWindow}) =>
                    BrowserWindow.getAllWindows().some((w) => w.isVisible()),
                ),
                {timeout: 10_000, message: 'Main window should be visible initially'},
            ).toBe(true);

            // Hide the main window (simulates Cmd+H or minimizing to dock)
            await electronApp.evaluate(({BrowserWindow}) => {
                const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
                win?.hide();
            });

            // Verify window is hidden
            await expect.poll(
                () => electronApp.evaluate(({BrowserWindow}) =>
                    BrowserWindow.getAllWindows().some((w) => w.isVisible()),
                ),
                {timeout: 5_000, message: 'Window should be hidden after hide()'},
            ).toBe(false);

            // Verify window still exists (not destroyed)
            const windowStillExists = await electronApp.evaluate(({BrowserWindow}) =>
                BrowserWindow.getAllWindows().some((w) => !w.isDestroyed()),
            );
            expect(windowStillExists, 'Window must still exist after hide (not destroyed)').toBe(true);

            // Simulate Cmd+Tab — emits the 'activate' app event
            await electronApp.evaluate(({app}) => {
                app.emit('activate');
            });

            // Window must reappear
            await expect.poll(
                () => electronApp.evaluate(({BrowserWindow}) =>
                    BrowserWindow.getAllWindows().some((w) => w.isVisible()),
                ),
                {timeout: 10_000, message: 'Window must reappear after Cmd+Tab (activate event)'},
            ).toBe(true);
        },
    );
});
