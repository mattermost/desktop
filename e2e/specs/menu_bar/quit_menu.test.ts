// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {clickApplicationMenuItem} from '../../helpers/menu';

test.describe('menu_bar/quit_menu', () => {
    test(
        'MM-T1668 Quit the app from the menu bar',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const menuId = process.platform === 'darwin' ? 'app' : 'file';
            const quitLabel = process.platform === 'darwin' ? 'Quit Mattermost' : 'Exit';

            const closePromise = electronApp.waitForEvent('close', {timeout: 15_000});
            await clickApplicationMenuItem(electronApp, menuId, {labelIncludes: quitLabel});
            await closePromise;

            expect(electronApp.windows().length).toBe(0);
        },
    );
});
