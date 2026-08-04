// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {restoreMessageBox, stubMessageBoxResponses} from '../../helpers/dialog';
import {clickApplicationMenuItem} from '../../helpers/menu';

test(
    'MM-T6148 clear all data menu item can be cancelled without restarting the app',
    {tag: ['@P1', '@all']},
    async ({electronApp, mainWindow}) => {
        expect(mainWindow).toBeDefined();

        const serverButtonText = await mainWindow!.innerText('.ServerDropdownButton');

        await stubMessageBoxResponses(electronApp, [{response: 1}]);
        try {
            await clickApplicationMenuItem(electronApp, 'view', {labelIncludes: 'Clear All Data'});
            await expect.poll(
                () => mainWindow!.innerText('.ServerDropdownButton'),
                {timeout: 10_000, message: 'Canceling Clear All Data should leave the active server unchanged'},
            ).toBe(serverButtonText);
        } finally {
            await restoreMessageBox(electronApp);
        }
    },
);
