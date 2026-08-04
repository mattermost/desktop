// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';

const trayIconConfig = {
    ...demoConfig,
    showTrayIcon: true,
};

async function evaluateTrayExists(app: ElectronApplication): Promise<boolean> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        try {
            return await app.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const tray = refs?.TrayIcon?.tray;
                return Boolean(tray && !tray.isDestroyed?.());
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('Execution context was destroyed')) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    return false;
}

test.describe('server_management/show_tray_icon', () => {
    test.use({appConfig: trayIconConfig});

    test(
        'MM-T1298 Show Mattermost icon in the menu bar (macOS and Linux)',
        {tag: ['@P2', '@darwin', '@linux']},
        async ({electronApp}) => {
            expect(trayIconConfig.showTrayIcon).toBe(true);
            expect(await evaluateTrayExists(electronApp)).toBe(true);
        },
    );
});
