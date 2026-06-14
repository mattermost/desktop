// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

test(
    'LNX-05 app launches in a Wayland session',
    {tag: ['@P2', '@wayland']},
    async ({electronApp}) => {
        const sessionType = await electronApp.evaluate(() => process.env.XDG_SESSION_TYPE ?? '');
        expect(sessionType.toLowerCase()).toBe('wayland');

        const mainWindow = electronApp.windows().find((window) => window.url().includes('index'));
        expect(mainWindow).toBeDefined();
        await expect.poll(
            () => mainWindow!.evaluate(() => document.readyState === 'complete'),
            {timeout: 15_000},
        ).toBe(true);
    },
);
