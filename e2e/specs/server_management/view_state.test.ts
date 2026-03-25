// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

test(
    'switching servers preserves view state on return',
    {tag: ['@P1', '@all']},
    async ({serverMap, electronApp}) => {
        const serverA = serverMap.example?.[0]?.win;
        const serverB = serverMap.github?.[0]?.win;

        if (!serverA || !serverB) {
            test.skip(true, 'Both servers must be available in serverMap');
            return;
        }

        // Record Server A's initial URL
        const initialUrlA = await serverA.url();

        const switchToServer = async (serverName: string) => {
            await electronApp.evaluate((_, targetServerName) => {
                const refs = (global as any).__e2eTestRefs;
                const server = refs?.ServerManager?.getAllServers?.().find((candidate: any) => candidate.name === targetServerName);
                if (!server) {
                    throw new Error(`Server not found: ${targetServerName}`);
                }
                refs.ServerManager.updateCurrentServer(server.id);
            }, serverName);
        };

        // Switch to Server B
        await switchToServer('github');
        await expect.poll(
            () => serverB!.url(),
            {timeout: 5_000},
        ).toContain('github.com');

        // Switch back to Server A
        await switchToServer('example');

        // Server A URL should be unchanged — poll to let any async view re-activation settle
        await expect.poll(
            () => serverA!.url(),
            {timeout: 5_000, message: 'Server A URL should be unchanged after returning'},
        ).toBe(initialUrlA);
    },
);
