// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';
import {evaluateInMainProcess} from '../../helpers/testRefs';

test.describe('windows_and_linux_only/window_header', () => {
    test(
        'MM-T3400 Default OS window header (Win 7, Linux)',
        {tag: ['@P2', '@linux', '@win32']},
        async ({electronApp, mainWindow}) => {
            // With configured servers, MainPage does not render .app-title (see MainPage.tsx).
            // The custom title bar is the TopBar; the OS/window title comes from the active tab.
            // Win 7 is no longer a supported target. Playwright cannot open the OS
            // window-manager context menu on a native title bar.
            await expect(mainWindow.locator('.topBar .three-dot-menu')).toBeVisible({timeout: 10_000});

            const windowTitle = await evaluateInMainProcess(electronApp, () => {
                const refs = (global as any).__e2eTestRefs;
                return refs?.MainWindow?.get?.()?.getTitle?.() ?? '';
            });
            expect(windowTitle.length, 'Main window must expose a non-empty title').toBeGreaterThan(0);
        },
    );

    test.describe('native title bar', () => {
        test.use({appConfig: {...demoConfig, useNativeTitleBar: true}});

        test(
            'MM-T3400 Linux native title bar uses OS window chrome when enabled',
            {tag: ['@P2', '@linux']},
            async ({electronApp}) => {
                const chrome = await evaluateInMainProcess(electronApp, () => {
                    const refs = (global as any).__e2eTestRefs;
                    const win = refs?.MainWindow?.get?.();
                    if (!win) {
                        throw new Error('Main window not found');
                    }
                    const bounds = win.getBounds();
                    const contentBounds = win.getContentBounds();
                    return {
                        useNativeTitleBar: Boolean(refs?.Config?.useNativeTitleBar),
                        chromeHeight: bounds.height - contentBounds.height,
                        chromeWidth: bounds.width - contentBounds.width,
                    };
                });

                expect(chrome.useNativeTitleBar, 'useNativeTitleBar must be enabled for this spec').toBe(true);
                expect(
                    chrome.chromeHeight + chrome.chromeWidth,
                    'Native OS frame should make window bounds larger than content bounds',
                ).toBeGreaterThan(0);
            },
        );
    });
});
