// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {clickApplicationMenuItem} from '../../helpers/menu';

test(
    'DIAG-01 Run diagnostics completes from the Help menu',
    {tag: ['@P1', '@all']},
    async ({electronApp}) => {
        await clickApplicationMenuItem(electronApp, 'help', {id: 'diagnostics'});

        await expect.poll(async () => {
            return electronApp.evaluate(() => {
                const diagnostics = (global as any).__e2eTestRefs?.Diagnostics;
                return diagnostics?.isRunning?.() ?? true;
            });
        }, {
            timeout: 60_000,
            message: 'Diagnostics.run should finish without staying in the running state',
        }).toBe(false);
    },
);
