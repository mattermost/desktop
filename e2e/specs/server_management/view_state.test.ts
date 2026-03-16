// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

test(
    'switching servers preserves view state on return',
    {tag: ['@P1', '@all']},
    async ({serverMap, mainWindow}) => {
        const serverA = serverMap['example']?.[0]?.win;
        const serverB = serverMap['github']?.[0]?.win;

        if (!serverA || !serverB) {
            test.skip(true, 'Both servers must be available in serverMap');
            return;
        }

        // Record Server A's initial URL
        const initialUrlA = serverA!.url();

        // Switch to Server B
        await mainWindow.click('.ServerButton >> nth=1');
        await expect.poll(
            () => serverB!.url(),
            {timeout: 5_000},
        ).toContain('github.com');

        // Switch back to Server A
        await mainWindow.click('.ServerButton >> nth=0');

        // Server A URL should be unchanged
        const returnedUrlA = serverA!.url();
        expect(returnedUrlA).toBe(initialUrlA);
    },
);
