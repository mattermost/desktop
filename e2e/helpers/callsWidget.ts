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

// Send a keyboard shortcut to the Calls widget BrowserWindow.
// Must only be called after callsClient.peer is established — handlers
// silently bail if the WebRTC peer is null (confirmed in MM-T5411).
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

    // Wait for the mute button (React mounted + call connected in widget),
    // then wait for the sidebar icon which confirms channelHasCall is true in
    // the main webapp's Redux state — required before any /call slash commands.
    await widgetWindow.waitForSelector('button[aria-label*="Mute"], button[aria-label*="mute"]', {timeout: 30_000});
    await serverWin.waitForSelector('[data-testid="calls-sidebar-active-call-icon"]', {timeout: 15_000});

    // Wait for the WebRTC peer to be established before any shortcut is sent.
    // callsClient handlers silently bail when peer is null.
    await widgetWindow.waitForFunction(
        () => Boolean(((window as unknown as Record<string, unknown>).callsClient as Record<string, unknown> | undefined)?.peer),
        {timeout: 15_000},
    );

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
        await sendWidgetShortcut(
            electronApp,
            'L',
            isMac ? ['shift', 'meta'] : ['shift', 'control'],
        ).catch(() => {
            // Widget disappeared between the isClosed() check and the shortcut; the
            // poll below is the real assertion.
        });
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
