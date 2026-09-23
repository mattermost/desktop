// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {expect} from '../fixtures/index';

import {waitForMattermostShellReady} from './channelReadiness';
import {isVersionAtLeast} from './semver';
import {resolveCallsPluginVersion} from './server_api/plugin';
import type {ServerView} from './serverView';

const CALLS_MUTE_SELECTOR = [
    '#voice-mute-unmute',
    'button[aria-label*="Mute" i]',
    'button[aria-label*="Unmute" i]',
].join(', ');

/** 1.12.5 paints mute while clientConnecting; the control is `disabled` until RTC connects. */
const CALLS_DISABLED_WHILE_CONNECTING = '1.12.0';

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

/** 1.12+ toggles the mute aria-label ("Mute" / "Unmute"); older widgets toggle aria-pressed. */
export async function getCallsMuteStateKey(widgetWindow: Page): Promise<string> {
    return widgetWindow.evaluate((selector) => {
        const button = document.querySelector(selector);
        return `${button?.getAttribute('aria-label') ?? ''}|${button?.getAttribute('aria-pressed') ?? ''}`;
    }, CALLS_MUTE_SELECTOR);
}

// Calls 1.12 paints mute while Redux `clientConnecting` and sets `disabled` until
// RTC connects. Older widgets (10.11 marketplace) may omit `#voice-mute-unmute`
// or never use that disabled gate — wait for any mute control, then only wait
// out `disabled` when this is 1.12+ (or the version is unknown).
export async function waitForCallsClientReady(widgetWindow: Page, timeoutMs = 30_000) {
    const mute = await widgetWindow.waitForSelector(CALLS_MUTE_SELECTOR, {
        state: 'visible',
        timeout: timeoutMs,
    });
    const muteById = await widgetWindow.$('#voice-mute-unmute');
    if (!muteById) {
        return mute;
    }
    if (await muteById.getAttribute('disabled') === null) {
        return muteById;
    }

    const callsVersion = await resolveCallsPluginVersion();
    if (callsVersion && !isVersionAtLeast(callsVersion, CALLS_DISABLED_WHILE_CONNECTING)) {
        return muteById;
    }

    return widgetWindow.waitForSelector('#voice-mute-unmute:not([disabled])', {
        state: 'visible',
        timeout: timeoutMs,
    });
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

/** 1.12+ binds Ctrl/Cmd+Shift+Space; older widgets bind "m". Tries the expected key first, then the other. */
export async function toggleMuteViaShortcut(
    electronApp: ElectronApplication,
    widgetWindow: Page,
): Promise<void> {
    const initialMute = await getCallsMuteStateKey(widgetWindow);
    const callsVersion = await resolveCallsPluginVersion();
    const legacyMuteKey = Boolean(
        callsVersion && !isVersionAtLeast(callsVersion, CALLS_DISABLED_WHILE_CONNECTING),
    );
    const isMac = process.platform === 'darwin';
    const pressM = {
        press: () => widgetWindow.keyboard.press('m'),
        message: 'Mute must toggle after the "m" keyboard shortcut',
    };
    const pressSpace = {
        press: () => sendWidgetShortcut(electronApp, 'Space', isMac ? ['shift', 'meta'] : ['shift', 'control']),
        message: 'Mute must toggle after Ctrl/Cmd+Shift+Space',
    };
    const [first, fallback] = legacyMuteKey ? [pressM, pressSpace] : [pressSpace, pressM];
    const assertToggled = (timeout: number, message: string) => expect.poll(
        () => getCallsMuteStateKey(widgetWindow),
        {timeout, message},
    ).not.toBe(initialMute);

    await first.press();
    try {
        await assertToggled(3_000, first.message);
    } catch {
        await fallback.press();
        await assertToggled(5_000, fallback.message);
    }
}

export async function enterCallsTestChannel(serverWin: ServerView, channelName: string): Promise<void> {
    const channelItem = `#sidebarItem_${channelName}`;
    await waitForMattermostShellReady(serverWin, {channelItem});
    await serverWin.click(channelItem);
    await serverWin.waitForSelector('#channelHeaderTitle', {timeout: 10_000});
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

export async function leaveCallIfActive(
    electronApp: ElectronApplication,
    serverWin?: ServerView,
): Promise<void> {
    const existing = findCallsWidgetWindow(electronApp);
    if (existing) {
        await closeCallsWidget(electronApp, existing, serverWin);
        return;
    }
    if (serverWin) {
        await expect.poll(
            () => serverWin.isVisible('[data-testid="calls-sidebar-active-call-icon"]'),
            {timeout: 10_000, message: 'Sidebar active-call icon must disappear after leaving'},
        ).toBe(false);
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
