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

            // Wait until the widget window appears, then re-fetch it to get the
            // Page object — expect.poll().not.toBeNull() returns undefined.
            await expect.poll(
                () => findCallsWidgetWindow(electronApp),
                {timeout: 20_000, message: 'Calls widget window must appear after /call start'},
            ).not.toBeNull();
            const widgetWindow = await findCallsWidgetWindow(electronApp);
            expect(widgetWindow, 'Calls widget window should be resolvable after poll').not.toBeNull();

            // Verify the widget loaded the correct URL
            expect(
                widgetWindow!.url(),
                'Widget URL must point to Calls plugin',
            ).toContain('/plugins/com.mattermost.calls/standalone/widget.html');

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
            // Snapshot the current last-post id so the ephemeral-response check
            // can only match a NEW post produced by this slash command, not
            // arbitrary channel history that happens to contain the word "call".
            await serverWin.waitForSelector('#post_textbox', {timeout: 10_000});
            const postIdBefore = await serverWin.evaluate(() => {
                const items = document.querySelectorAll('[data-testid="postView"]');
                const last = items[items.length - 1] as HTMLElement | undefined;
                return last?.id ?? null;
            }) as string | null;

            await serverWin.fill('#post_textbox', '/call start');
            await serverWin.press('#post_textbox', 'Enter');

            // Poll deterministically for either outcome: a Calls widget window
            // or a brand-new post mentioning "call" appearing after the command.
            type Outcome = {kind: 'widget'; window: Page} | {kind: 'post'} | null;
            let outcome: Outcome = null;
            await expect.poll(
                async () => {
                    const widget = await findCallsWidgetWindow(electronApp);
                    if (widget) {
                        outcome = {kind: 'widget', window: widget};
                        return true;
                    }
                    const newPostMentionsCall = await serverWin.evaluate((idBefore: string | null) => {
                        const items = Array.from(document.querySelectorAll('[data-testid="postView"]')) as HTMLElement[];
                        const last = items[items.length - 1];
                        if (!last || last.id === idBefore) {
                            return false;
                        }
                        const text = last.querySelector('.post-message__text')?.textContent ?? '';
                        return text.toLowerCase().includes('call');
                    }, postIdBefore);
                    if (newPostMentionsCall) {
                        outcome = {kind: 'post'};
                        return true;
                    }
                    return false;
                },
                {
                    timeout: 20_000,
                    message:
                        '/call start produced neither a Calls widget window nor a new ephemeral response. ' +
                        'Verify the Calls plugin is enabled and configured on the test server.',
                },
            ).toBe(true);

            if (outcome && (outcome as Outcome)!.kind === 'widget') {
                const widget = (outcome as {kind: 'widget'; window: Page}).window;
                expect(widget.url(), '/call start must open Calls widget').toContain(
                    '/plugins/com.mattermost.calls/standalone/widget.html',
                );
                await closeCallsWidget(electronApp, widget);
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

            await expect.poll(
                () => findCallsWidgetWindow(electronApp),
                {timeout: 20_000, message: 'Calls widget window must appear for keyboard shortcut test'},
            ).not.toBeNull();
            const widgetWindow = await findCallsWidgetWindow(electronApp);
            expect(widgetWindow, 'Calls widget window should be resolvable after poll').not.toBeNull();

            await widgetWindow!.waitForLoadState('domcontentloaded');
            await widgetWindow!.waitForSelector('button[aria-label*="Mute"], button[aria-label*="mute"]', {timeout: 10_000});

            // Focus the widget so it receives keyboard events
            await widgetWindow!.bringToFront();

            // Capture initial aria-pressed BEFORE pressing 'm' so we can verify
            // the keyboard shortcut actually toggled mute (not just that the
            // attribute exists).
            const initialPressed = await widgetWindow!.evaluate(() => {
                const btn = document.querySelector('button[aria-label*="Mute"], button[aria-label*="mute"]');
                return btn?.getAttribute('aria-pressed') ?? null;
            });

            await widgetWindow!.keyboard.press('m');

            await expect.poll(
                () => widgetWindow!.evaluate(() => {
                    const btn = document.querySelector('button[aria-label*="Mute"], button[aria-label*="mute"]');
                    return btn?.getAttribute('aria-pressed') ?? null;
                }),
                {timeout: 5_000, message: 'Mute button aria-pressed must change after pressing the "m" keyboard shortcut'},
            ).not.toBe(initialPressed);

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
