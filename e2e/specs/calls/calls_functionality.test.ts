// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {findCallsWidgetWindow, waitForCallsWidgetWindow} from '../../helpers/callsWidget';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import type {ServerView} from '../../helpers/serverView';

type CallStartOutcome = {kind: 'widget'} | {kind: 'post'};

async function pollCallStartOutcome(
    electronApp: ElectronApplication,
    serverWin: ServerView,
    postIdBefore: string | null,
): Promise<CallStartOutcome> {
    let outcome: CallStartOutcome | null = null;

    await expect.poll(async (): Promise<boolean> => {
        if (findCallsWidgetWindow(electronApp)) {
            outcome = {kind: 'widget'};
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
    }, {
        timeout: 20_000,
        message: '/call start produced neither a Calls widget window nor a new ephemeral response.',
    }).toBe(true);

    return outcome!;
}

test.describe('calls/calls_functionality', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    let serverWin: ServerView;

    test.beforeEach(async ({serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
        expect(serverEntry, 'Mattermost server view should exist').toBeTruthy();
        serverWin = serverEntry!.win;

        await loginToMattermost(serverWin);
        await serverWin.click('#sidebarItem_town-square');
        await serverWin.waitForSelector('#channelHeaderTitle', {timeout: 10_000});
    });

    test('MM-T4841 Calls UI Functionality - Self-managed',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            await serverWin.waitForSelector('#post_textbox', {timeout: 10_000});
            await serverWin.fill('#post_textbox', '/call start');
            await serverWin.press('#post_textbox', 'Enter');

            const widgetWindow = await waitForCallsWidgetWindow(electronApp);
            if (!widgetWindow) {
                test.skip(true, 'Calls plugin/widget not available on this test server');
                return;
            }

            expect(widgetWindow.url(), 'Widget URL must point to Calls plugin').toContain(
                '/plugins/com.mattermost.calls/standalone/widget.html',
            );

            await widgetWindow.waitForLoadState('domcontentloaded');
            const hasControls = await widgetWindow.evaluate(() => document.querySelectorAll('button').length > 0);
            expect(hasControls, 'Calls widget must have interactive controls').toBe(true);

            const muteButton = await widgetWindow.waitForSelector(
                'button[aria-label*="Mute"], button[aria-label*="mute"]',
                {timeout: 10_000},
            );
            expect(muteButton, 'Mute button must exist in Calls widget').toBeTruthy();

            const initialPressed = await widgetWindow.evaluate(() => {
                const btn = document.querySelector('button[aria-label*="Mute"], button[aria-label*="mute"]');
                return btn?.getAttribute('aria-pressed') ?? null;
            });

            await muteButton.click();

            await expect.poll(
                () => widgetWindow.evaluate(() => {
                    const btn = document.querySelector('button[aria-label*="Mute"], button[aria-label*="mute"]');
                    return btn?.getAttribute('aria-pressed') ?? null;
                }),
                {timeout: 5_000, message: 'Mute button aria-pressed must change after click'},
            ).not.toBe(initialPressed);

            await closeCallsWidget(electronApp, widgetWindow);
        },
    );

    test('MM-T5587 Calls - Slash Commands',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            await serverWin.waitForSelector('#post_textbox', {timeout: 10_000});
            const postIdBefore = await serverWin.evaluate(() => {
                const items = document.querySelectorAll('[data-testid="postView"]');
                const last = items[items.length - 1] as HTMLElement | undefined;
                return last?.id ?? null;
            }) as string | null;

            await serverWin.fill('#post_textbox', '/call start');
            await serverWin.press('#post_textbox', 'Enter');

            let outcome: CallStartOutcome;
            try {
                outcome = await pollCallStartOutcome(electronApp, serverWin, postIdBefore);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (message.includes('/call start produced neither')) {
                    test.skip(true, 'Calls plugin/widget not available on this test server');
                    return;
                }
                throw error;
            }

            if (outcome.kind === 'widget') {
                const widgetWindow = findCallsWidgetWindow(electronApp);
                expect(widgetWindow, '/call start must open Calls widget').toBeTruthy();
                expect(widgetWindow!.url(), '/call start must open Calls widget').toContain(
                    '/plugins/com.mattermost.calls/standalone/widget.html',
                );
                await closeCallsWidget(electronApp, widgetWindow!);
            }
        },
    );

    test('MM-T5411 Calls - Keyboard Shortcuts (self-managed)',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            await serverWin.waitForSelector('#post_textbox', {timeout: 10_000});
            await serverWin.fill('#post_textbox', '/call start');
            await serverWin.press('#post_textbox', 'Enter');

            const widgetWindow = await waitForCallsWidgetWindow(electronApp, 30_000);
            if (!widgetWindow) {
                test.skip(true, 'Calls plugin/widget not available on this test server');
                return;
            }

            await widgetWindow.waitForLoadState('domcontentloaded');
            await widgetWindow.waitForSelector('button[aria-label*="Mute"], button[aria-label*="mute"]', {timeout: 10_000});
            await widgetWindow.bringToFront();

            const initialPressed = await widgetWindow.evaluate(() => {
                const btn = document.querySelector('button[aria-label*="Mute"], button[aria-label*="mute"]');
                return btn?.getAttribute('aria-pressed') ?? null;
            });

            await widgetWindow.keyboard.press('m');

            await expect.poll(
                () => widgetWindow.evaluate(() => {
                    const btn = document.querySelector('button[aria-label*="Mute"], button[aria-label*="mute"]');
                    return btn?.getAttribute('aria-pressed') ?? null;
                }),
                {timeout: 5_000, message: 'Mute button aria-pressed must change after pressing the "m" keyboard shortcut'},
            ).not.toBe(initialPressed);

            await closeCallsWidget(electronApp, widgetWindow);
        },
    );
});

async function closeCallsWidget(
    electronApp: ElectronApplication,
    widgetWindow: Page,
): Promise<void> {
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
        await electronApp.evaluate(({ipcMain}) => {
            ipcMain.emit('calls-leave-call');
        });
    }

    await expect.poll(
        () => findCallsWidgetWindow(electronApp),
        {timeout: 10_000, message: 'Calls widget window must close after leave'},
    ).toBeNull();
}
