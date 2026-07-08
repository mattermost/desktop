// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

export function findCallsWidgetWindow(electronApp: ElectronApplication): Page | null {
    return electronApp.windows().find((w) => {
        try {
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
): Promise<Page | null> {
    const existing = findCallsWidgetWindow(electronApp);
    if (existing) {
        return existing;
    }

    return electronApp.waitForEvent('window', {
        predicate: (w) => {
            try {
                return w.url().includes('/plugins/com.mattermost.calls/standalone/widget.html');
            } catch {
                return false;
            }
        },
        timeout: timeoutMs,
    }).catch(() => null);
}
