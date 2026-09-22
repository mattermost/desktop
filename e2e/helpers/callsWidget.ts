// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {expect} from '../fixtures/index';
import type {ServerView} from './serverView';

export function findCallsWidgetWindow(electronApp: ElectronApplication): Page | null {
    return electronApp.windows().find((w) => {
        try {
            // A page being torn down still appears in windows(). Treat it as gone —
            // otherwise startCall can bind to a dying widget and later fail with
            // "Target page, context or browser has been closed".
            if (w.isClosed()) {
                return false;
            }
            const url = w.url();
            return url.includes('/plugins/com.mattermost.calls/standalone/widget.html');
        } catch {
            return false;
        }
    }) ?? null;
}

export async function waitForCallsWidgetWindow(
    electronApp: ElectronApplication,
    timeoutMs = 20_000,
    excludePage?: Page | null,
): Promise<Page | null> {
    const existing = findCallsWidgetWindow(electronApp);
    if (existing && existing !== excludePage) {
        return existing;
    }

    return electronApp.waitForEvent('window', {
        predicate: (w) => {
            try {
                if (w === excludePage || w.isClosed()) {
                    return false;
                }
                return w.url().includes('/plugins/com.mattermost.calls/standalone/widget.html');
            } catch {
                return false;
            }
        },
        timeout: timeoutMs,
    }).catch(() => null);
}

// Calls 1.12.5 paints mute/leave/shortcut controls while Redux `clientConnecting`
// is still true. Clicks and keyboard handlers no-op until RTC connect clears that
// flag (the mute button is `disabled` until then).
export async function waitForCallsClientReady(widgetWindow: Page, timeoutMs = 30_000): Promise<void> {
    await widgetWindow.waitForSelector('#voice-mute-unmute:not([disabled])', {timeout: timeoutMs});
}

// Send a keyboard shortcut to the Calls widget BrowserWindow.
// Must only be called after waitForCallsClientReady — handlers no-op while
// clientConnecting, and unmute() also bails if the WebRTC peer is null.
export async function sendWidgetShortcut(
    electronApp: ElectronApplication,
    keyCode: string,
    modifiers: string[],
): Promise<void> {
    await electronApp.evaluate(({BrowserWindow}, args) => {
        const win = BrowserWindow.getAllWindows().find((w) => {
            try {
                return w.webContents.getURL().includes('widget.html');
            } catch {
                return false;
            }
        });
        if (!win) {
            throw new Error('Calls widget BrowserWindow not found');
        }
        win.webContents.sendInputEvent({type: 'keyDown', keyCode: args.keyCode, modifiers: args.modifiers} as Electron.KeyboardInputEvent);
        win.webContents.sendInputEvent({type: 'keyUp', keyCode: args.keyCode, modifiers: args.modifiers} as Electron.KeyboardInputEvent);
    }, {keyCode, modifiers});
}

export async function startCall(electronApp: ElectronApplication, serverWin: ServerView): Promise<Page> {
    // Any widget still present belongs to a previous call whose teardown has not
    // finished. Capture it so we never bind to it — a stale page can close mid-setup,
    // surfacing later as "Target page, context or browser has been closed".
    const staleWidget = findCallsWidgetWindow(electronApp);

    await serverWin.waitForSelector('#post_textbox', {timeout: 10_000});
    await serverWin.type('#post_textbox', '/call start');
    await serverWin.click('[data-testid="SendMessageButton"]');

    const widgetWindow = await waitForCallsWidgetWindow(electronApp, 30_000, staleWidget);
    if (!widgetWindow) {
        throw new Error('Calls widget did not open — is the Calls plugin enabled on this server?');
    }

    await waitForCallsClientReady(widgetWindow);

    // Sidebar icon confirms channelHasCall is true in the main webapp's Redux
    // state — required before any /call slash commands.
    await serverWin.waitForSelector('[data-testid="calls-sidebar-active-call-icon"]', {timeout: 15_000});

    return widgetWindow;
}

export async function leaveCallIfActive(electronApp: ElectronApplication): Promise<void> {
    const existing = findCallsWidgetWindow(electronApp);
    if (existing) {
        await closeCallsWidget(electronApp, existing);
    }
}

export async function closeCallsWidget(
    electronApp: ElectronApplication,
    widgetWindow: Page,
    serverWin?: ServerView,
): Promise<void> {
    // Leave via the keyboard shortcut, which calls disconnect() directly (see the
    // "MM Calls - Leave call keyboard shortcut" test).
    // If the shortcut ever proves unreliable, the faithful alternative is the menu
    // route used by the Calls plugin's own suite: click #calls-widget-leave-button,
    // then click "Leave call" inside getByTestId('dropdownmenu').
    if (!widgetWindow.isClosed()) {
        const isMac = process.platform === 'darwin';
        try {
            await waitForCallsClientReady(widgetWindow);
            await sendWidgetShortcut(
                electronApp,
                'L',
                isMac ? ['shift', 'meta'] : ['shift', 'control'],
            );
        } catch (error) {
            if (!widgetWindow.isClosed()) {
                throw error;
            }

            // Widget disappeared between the isClosed() check and the shortcut; the
            // poll below is the real assertion.
        }
    }

    await expect.poll(
        () => findCallsWidgetWindow(electronApp),
        {timeout: 10_000, message: 'Calls widget window must close after leaving'},
    ).toBeNull();

    if (serverWin) {
        await expect.poll(
            () => serverWin.isVisible('[data-testid="calls-sidebar-active-call-icon"]'),
            {timeout: 10_000, message: 'Sidebar active-call icon must disappear after leaving'},
        ).toBe(false);
    }
}
