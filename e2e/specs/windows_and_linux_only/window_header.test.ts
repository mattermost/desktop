// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {evaluateInMainProcess} from '../../helpers/testRefs';

test.describe('windows_and_linux_only/window_header', () => {
    test(
        'MM-T3400 Default OS window header (Win 7, Linux)',
        {tag: ['@P2', '@linux', '@win32']},
        async ({electronApp, mainWindow}) => {
            // With configured servers, MainPage does not render .app-title (see MainPage.tsx).
            // The custom title bar is the TopBar; the OS/window title comes from the active tab.
            await expect(mainWindow.locator('.topBar .three-dot-menu')).toBeVisible({timeout: 10_000});

            const windowTitle = await evaluateInMainProcess(electronApp, () => {
                const refs = (global as any).__e2eTestRefs;
                return refs?.MainWindow?.get?.()?.getTitle?.() ?? '';
            });
            expect(windowTitle.length, 'Main window must expose a non-empty title').toBeGreaterThan(0);
        },
    );
});
