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
            // Resolve the canonical main window id from __e2eTestRefs so the
            // test targets the same window every time, even if a popout or
            // Calls widget BrowserWindow exists in this run.
            const mainWindowId = await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const win = refs?.MainWindow?.get?.();
                return win?.id ?? null;
            });
            expect(mainWindowId, 'MainWindow must be resolvable via __e2eTestRefs').not.toBeNull();

            const isMainVisible = () => electronApp.evaluate(({BrowserWindow}, id: number) =>
                Boolean(BrowserWindow.fromId(id)?.isVisible()),
            mainWindowId as number);

            await expect.poll(isMainVisible, {timeout: 10_000, message: 'Main window should be visible initially'}).toBe(true);

            // Hide the main window
            await electronApp.evaluate(({BrowserWindow}, id: number) => {
                BrowserWindow.fromId(id)?.hide();
            }, mainWindowId as number);

            await expect.poll(isMainVisible, {timeout: 5_000, message: 'Window should be hidden after hide()'}).toBe(false);

            // Sanity-check: window is hidden, not destroyed
            const windowStillExists = await electronApp.evaluate(({BrowserWindow}, id: number) => {
                const w = BrowserWindow.fromId(id);
                return Boolean(w && !w.isDestroyed());
            }, mainWindowId as number);
            expect(windowStillExists, 'Window must still exist after hide (not destroyed)').toBe(true);

            // Simulate Cmd+Tab — emits the 'activate' app event
            await electronApp.evaluate(({app}) => {
                app.emit('activate');
            });

            await expect.poll(
                isMainVisible,
                {timeout: 10_000, message: 'Window must reappear after Cmd+Tab (activate event)'},
            ).toBe(true);
        },
    );
});
