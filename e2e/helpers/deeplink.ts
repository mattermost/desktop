// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication, Page} from 'playwright';

import {buildServerMap} from './serverMap';

export function mattermostDeepLinkUrl(hostAndPath: string): string {
    // E2E always launches the unpacked binary (electron-is-dev=true), so deep links
    // must use mattermost-dev:// regardless of the Playwright worker's NODE_ENV.
    return `mattermost-dev://${hostAndPath}`;
}

/** Build a channel deep link that preserves the team path from the configured server URL. */
export function channelDeepLinkUrl(serverUrl: string, channelName: string): string {
    const normalized = serverUrl.endsWith('/') ? serverUrl : `${serverUrl}/`;
    const parsed = new URL(normalized);
    const teamPath = parsed.pathname.replace(/\/$/, '');
    const channelPath = teamPath ? `${teamPath}/channels/${channelName}` : `/channels/${channelName}`;
    return mattermostDeepLinkUrl(`${parsed.host}${channelPath}`);
}

export async function openDeepLinkInApp(app: ElectronApplication, url: string): Promise<void> {
    await app.evaluate((_, deepLinkUrl) => {
        const openDeepLink = (global as any).__e2eOpenDeepLink as ((value: string) => void) | undefined;
        if (!openDeepLink) {
            throw new Error('__e2eOpenDeepLink not exposed (NODE_ENV must be test)');
        }
        openDeepLink(deepLinkUrl);
    }, url);
}

/** Poll any tab for the server until one navigates to the expected channel. */
export async function waitForServerChannelNavigation(
    app: ElectronApplication,
    serverName: string,
    channelName: string,
    options?: {timeout?: number},
): Promise<void> {
    await expect.poll(async () => {
        try {
            const map = await buildServerMap(app);
            const entries = map[serverName] ?? [];
            for (const entry of entries) {
                const url = await entry.win.url();
                if (url.includes(channelName)) {
                    return true;
                }
            }
            return false;
        } catch {
            return false;
        }
    }, {
        timeout: options?.timeout ?? 15_000,
        message: `Server view should navigate to ${channelName}`,
    }).toBe(true);
}

/**
 * Poll the server's primary view for a URL containing `urlSubstring`, then poll
 * the dropdown button until it shows `serverName`. Shared by deep-link tests that
 * assert both the navigation and the resulting active-server UI state.
 */
export async function waitForServerUrlAndDropdown(
    app: ElectronApplication,
    mainWindow: Page,
    serverName: string,
    urlSubstring: string,
    options?: {urlTimeout?: number; dropdownTimeout?: number},
): Promise<void> {
    await expect.poll(async () => {
        const freshMap = await buildServerMap(app);
        const freshView = freshMap[serverName]?.[0]?.win;
        return (await freshView?.url()) ?? '';
    }, {
        timeout: options?.urlTimeout ?? 30_000,
        message: `Server view for ${serverName} should navigate to a URL containing "${urlSubstring}"`,
    }).toContain(urlSubstring);

    await expect.poll(
        () => mainWindow.innerText('.ServerDropdownButton'),
        {timeout: options?.dropdownTimeout ?? 15_000, message: `Server dropdown should show ${serverName}`},
    ).toBe(serverName);
}
