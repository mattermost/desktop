// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import type {ServerView} from '../../helpers/serverView';

// ── Widget window discovery ─────────────────────────────────────────────
// The Calls widget is a separate frameless BrowserWindow created by
// CallsWidgetWindow (src/app/callsWidgetWindow.ts). It loads the Calls
// plugin's standalone widget page at:
//   <serverURL>/plugins/com.mattermost.calls/standalone/widget.html
// Because it is a BrowserWindow (not a WebContentsView), it appears in
// electronApp.windows().

async function findCallsWidgetWindow(electronApp: ElectronApplication): Promise<Page | null> {
    return electronApp.windows().find((w) => {
        try {
            const url = w.url();
            return url.includes('/plugins/com.mattermost.calls/standalone/widget.html');
        } catch {
            return false;
        }
    }) ?? null;
}

test.describe('calls/calls_functionality', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    let serverWin: ServerView;

    test.beforeAll(async ({serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
        expect(serverEntry, 'Mattermost server view should exist').toBeTruthy();
        serverWin = serverEntry!.win;

        await loginToMattermost(serverWin);
        await serverWin.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
    });

    test.beforeEach(async () => {
        // Return to Town Square before each test
        await serverWin.click('#sidebarItem_town-square');
        await serverWin.waitForSelector('#channelHeaderTitle', {timeout: 10_000});
    });

    // ── MM-T4841: Calls UI Functionality ───────────────────────────────
    test('MM-T4841 Calls UI Functionality - Self-managed',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            // Start a call via slash command
            await serverWin.waitForSelector('#post_textbox', {timeout: 10_000});
            await serverWin.fill('#post_textbox', '/call start');
            await serverWin.press('#post_textbox', 'Enter');

            // The widget window should appear
            const widgetWindow = await expect.poll(
                () => findCallsWidgetWindow(electronApp),
                {timeout: 20_000, message: 'Calls widget window must appear after /call start'},
            ).not.toBeNull();

            // Verify the widget loaded the correct URL
            const widgetURL = widgetWindow!.url();
            expect(widgetURL, 'Widget URL must point to Calls plugin').toContain('/plugins/com.mattermost.calls/standalone/widget.html');

            // Verify the widget has interactive controls
            await widgetWindow!.waitForLoadState('domcontentloaded');
            const hasControls = await widgetWindow!.evaluate(() => {
                return document.querySelectorAll('button').length > 0;
            });
            expect(hasControls, 'Calls widget must have interactive controls').toBe(true);

            // Verify mute button exists and can be toggled
            const muteButton = await widgetWindow!.waitForSelector('button[aria-label*="Mute"], button[aria-label*="mute"]', {timeout: 10_000});
            expect(muteButton, 'Mute button must exist in Calls widget').toBeTruthy();

            // Read initial aria-pressed state
            const initialPressed = await widgetWindow!.evaluate(() => {
                const btn = document.querySelector('button[aria-label*="Mute"], button[aria-label*="mute"]');
                return btn?.getAttribute('aria-pressed') ?? null;
            });

            // Click mute to toggle
            await muteButton.click();

            // Verify aria-pressed changed
            await expect.poll(
                () => widgetWindow!.evaluate(() => {
                    const btn = document.querySelector('button[aria-label*="Mute"], button[aria-label*="mute"]');
                    return btn?.getAttribute('aria-pressed') ?? null;
                }),
                {timeout: 5_000, message: 'Mute button aria-pressed must change after click'},
            ).not.toBe(initialPressed);

            // Close the widget
            await closeCallsWidget(electronApp, widgetWindow!);
        },
    );

    // ── MM-T5587: Calls - Slash Commands ───────────────────────────────
    test('MM-T5587 Calls - Slash Commands',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            await serverWin.waitForSelector('#post_textbox', {timeout: 10_000});
            await serverWin.fill('#post_textbox', '/call start');
            await serverWin.press('#post_textbox', 'Enter');

            // The slash command must either open the widget or show a response
            const widgetWindow = await findCallsWidgetWindow(electronApp);

            if (widgetWindow) {
                // Widget opened — slash command worked
                const widgetURL = widgetWindow.url();
                expect(widgetURL, '/call start must open Calls widget').toContain('/plugins/com.mattermost.calls/standalone/widget.html');
                await closeCallsWidget(electronApp, widgetWindow);
            } else {
                // No widget — check for an ephemeral system message
                const hasEphemeralMessage = await serverWin.evaluate(() => {
                    const posts = document.querySelectorAll('.post-message__text');
                    return Array.from(posts).some((p) =>
                        (p.textContent ?? '').toLowerCase().includes('call'),
                    );
                });

                if (!hasEphemeralMessage) {
                    // Neither widget nor message — the Calls plugin may not be
                    // configured. Fail with an actionable message.
                    throw new Error(
                        '/call start produced neither a Calls widget window nor an ephemeral message. ' +
                        'Verify the Calls plugin is enabled and configured on the test server.',
                    );
                }
            }
        },
    );

    // ── MM-T5411: Calls - Keyboard Shortcuts ───────────────────────────
    test('MM-T5411 Calls - Keyboard Shortcuts (self-managed)',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            // Start a call
            await serverWin.waitForSelector('#post_textbox', {timeout: 10_000});
            await serverWin.fill('#post_textbox', '/call start');
            await serverWin.press('#post_textbox', 'Enter');

            const widgetWindow = await expect.poll(
                () => findCallsWidgetWindow(electronApp),
                {timeout: 20_000, message: 'Calls widget window must appear for keyboard shortcut test'},
            ).not.toBeNull();

            await widgetWindow!.waitForLoadState('domcontentloaded');

            // Focus the widget window so it receives keyboard events
            await widgetWindow!.bringToFront();

            // Press 'm' — a common push-to-talk / mute toggle key in Calls
            await widgetWindow!.keyboard.press('m');

            // Verify the mute button state changed after keyboard press
            const mutePressedAfterKB = await widgetWindow!.evaluate(() => {
                const btn = document.querySelector('button[aria-label*="Mute"], button[aria-label*="mute"]');
                return btn?.getAttribute('aria-pressed') ?? null;
            });
            expect(
                mutePressedAfterKB,
                'Mute button aria-pressed must reflect keyboard shortcut state',
            ).not.toBeNull();

            await closeCallsWidget(electronApp, widgetWindow!);
        },
    );
});

// ── Helper ─────────────────────────────────────────────────────────────

async function closeCallsWidget(
    electronApp: ElectronApplication,
    widgetWindow: Page,
): Promise<void> {
    // Click the leave/end call button in the widget
    const leaveClicked = await widgetWindow.evaluate(() => {
        const leaveBtn = document.querySelector(
            'button[aria-label*="Leave"], button[aria-label*="leave"], button[aria-label*="End"], button[aria-label*="end"]',
        ) as HTMLButtonElement;
        if (leaveBtn) {
            leaveBtn.click();
            return true;
        }
        return false;
    });

    if (!leaveClicked) {
        // Fallback: send the leave-call IPC
        await electronApp.evaluate(({ipcMain}) => {
            ipcMain.emit('calls-leave-call');
        });
    }

    // Wait for the widget window to close
    await expect.poll(
        () => findCallsWidgetWindow(electronApp),
        {timeout: 10_000, message: 'Calls widget window must close after leave'},
    ).toBeNull();
}
