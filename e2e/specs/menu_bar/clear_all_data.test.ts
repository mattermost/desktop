// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {restoreMessageBox, stubMessageBoxResponses} from '../../helpers/dialog';
import {clickApplicationMenuItem} from '../../helpers/menu';

test(
    'clear all data menu item can be cancelled without restarting the app',
    {tag: ['@P1', '@all']},
    async ({electronApp, mainWindow}) => {
        expect(mainWindow).toBeDefined();

        await stubMessageBoxResponses(electronApp, [{response: 1}]);
        try {
            await clickApplicationMenuItem(electronApp, 'view', {labelIncludes: 'Clear All Data'});
            await expect.poll(
                () => electronApp.windows().some((window) => window.url().includes('index')),
                {timeout: 10_000},
            ).toBe(true);
        } finally {
            await restoreMessageBox(electronApp);
        }
    },
);
