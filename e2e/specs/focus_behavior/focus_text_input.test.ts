// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {clickApplicationMenuItem} from '../../helpers/menu';

test.describe('focus_behavior/focus_text_input', () => {
    test(
        'MM-T1314 Focus text input persists after app switch simulation',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const menuId = process.platform === 'darwin' ? 'app' : 'file';
            const newServerWindowPromise = electronApp.waitForEvent('window', {
                predicate: (window) => window.url().includes('newServer'),
                timeout: 15_000,
            });
            await clickApplicationMenuItem(electronApp, menuId, {labelIncludes: 'Sign in'});
            const newServerWindow = await newServerWindowPromise;
            await newServerWindow.waitForSelector('#serverUrlInput', {timeout: 10_000});
            await newServerWindow.focus('#serverUrlInput');

            await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                refs?.MainWindow?.get?.()?.blur();
            });
            await newServerWindow.bringToFront();

            const focusedId = await newServerWindow.evaluate(() => document.activeElement?.id ?? null);
            expect(focusedId).toBe('serverUrlInput');
        },
    );
});
