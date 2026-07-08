// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {clickApplicationMenuItem} from '../../helpers/menu';

test(
    'MM-T6149 Run diagnostics completes from the Help menu',
    {tag: ['@P1', '@all']},
    async ({electronApp}) => {
        await clickApplicationMenuItem(electronApp, 'help', {id: 'diagnostics'});

        await expect.poll(async () => {
            return electronApp.evaluate(() => {
                const diagnostics = (global as any).__e2eTestRefs?.Diagnostics;
                return diagnostics?.isRunning?.() ?? false;
            });
        }, {
            timeout: 30_000,
            message: 'Diagnostics.run should start after choosing Help → Run diagnostics',
        }).toBe(true);

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
