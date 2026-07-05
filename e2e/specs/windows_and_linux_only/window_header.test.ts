// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

test.describe('windows_and_linux_only/window_header', () => {
    test(
        'MM-T3400 Default OS window header (Win 7, Linux)',
        {tag: ['@P2', '@linux', '@win32']},
        async ({electronApp, mainWindow}) => {
            const runtimeAppName = await electronApp.evaluate(({app}) => app.getName());
            await expect.poll(
                async () => mainWindow.innerText('.app-title'),
                {timeout: 10_000},
            ).toBe(runtimeAppName);
        },
    );
});
