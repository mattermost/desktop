// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

test.describe('windows_and_linux_only/window_header', () => {
    test(
        'MM-T3400 Default OS window header (Win 7, Linux)',
        {tag: ['@P2', '@linux', '@win32']},
        async ({mainWindow}) => {
            await expect(mainWindow.locator('.app-title')).toBeVisible();
        },
    );
});
