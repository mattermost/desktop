// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import type {AppConfig} from '../../helpers/config';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

const EXTERNAL_URL = 'https://github.com/';

const externalLinksConfig: AppConfig = {
    ...demoMattermostConfig,
    servers: demoMattermostConfig.servers.filter((server) => !server.url.includes('github.com')),
};

test.describe('external_links', () => {
    test.use({appConfig: externalLinksConfig});

    test('MM-T_EL_1 clicking an external URL opens the system browser, not the app', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
        if (process.platform === 'linux') {
            test.skip(true, 'Linux not supported');
            return;
        }
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const firstServer = serverMap[externalLinksConfig.servers[0].name]?.[0]?.win;
        expect(firstServer, 'Mattermost server view should exist').toBeTruthy();

        await loginToMattermost(firstServer!);
        await firstServer!.waitForSelector('#post_textbox', {timeout: 15_000});

        await electronApp.evaluate(({shell}) => {
            (shell as any).__e2eOpenExternalCalls = [];
            const originalOpenExternal = shell.openExternal.bind(shell);
            (shell as any).__e2eOriginalOpenExternal = originalOpenExternal;
            shell.openExternal = (url: string) => {
                (shell as any).__e2eOpenExternalCalls.push(url);
                return Promise.resolve('');
            };
        });

        await firstServer!.evaluate((url: string) => {
            const existing = document.getElementById('e2e-external-link');
            existing?.remove();

            const link = document.createElement('a');
            link.id = 'e2e-external-link';
            link.href = url;
            link.textContent = url;
            link.target = '_blank';
            document.body.appendChild(link);
        }, EXTERNAL_URL);

        const linkSelector = '#e2e-external-link';
        await firstServer!.waitForSelector(linkSelector, {timeout: 15_000});
        await firstServer!.click(linkSelector);

        await expect.poll(async () => {
            return electronApp.evaluate(({shell}) => (shell as any).__e2eOpenExternalCalls ?? []);
        }, {timeout: 10_000}).toContain(EXTERNAL_URL);

        const internalWindowOpened = electronApp.windows().some((window) => {
            try {
                return window.url().includes('github.com');
            } catch {
                return false;
            }
        });
        expect(internalWindowOpened).toBe(false);

        await electronApp.evaluate(({shell}) => {
            const original = (shell as any).__e2eOriginalOpenExternal;
            if (original) {
                shell.openExternal = original;
            }
            delete (shell as any).__e2eOpenExternalCalls;
            delete (shell as any).__e2eOriginalOpenExternal;
        });
    });

    test('MM-T_EL_2 clicking an internal Mattermost channel link stays in the app', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
        if (process.platform === 'linux') {
            test.skip(true, 'Linux not supported');
            return;
        }
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const firstServer = serverMap[externalLinksConfig.servers[0].name]?.[0]?.win;
        expect(firstServer, 'Mattermost server view should exist').toBeTruthy();

        await loginToMattermost(firstServer!);
        await firstServer!.waitForSelector('#post_textbox', {timeout: 15_000});

        await electronApp.evaluate(({shell}) => {
            (shell as any).__e2eOpenExternalCalls = [];
            const originalOpenExternal = shell.openExternal.bind(shell);
            (shell as any).__e2eOriginalOpenExternal = originalOpenExternal;
            shell.openExternal = (url: string) => {
                (shell as any).__e2eOpenExternalCalls.push(url);
                return Promise.resolve('');
            };
        });

        const currentChannelUrl = await firstServer!.url();
        expect(currentChannelUrl).toContain('/channels/');

        await firstServer!.fill('#post_textbox', currentChannelUrl);
        await firstServer!.press('#post_textbox', 'Enter');

        const currentServerOrigin = new URL(process.env.MM_TEST_SERVER_URL).origin;
        const internalLinkSelector = `a[href="${currentChannelUrl.replace(currentServerOrigin, '')}"], a[href="${currentChannelUrl}"]`;
        await firstServer!.waitForSelector(internalLinkSelector, {timeout: 15_000});
        await firstServer!.click(internalLinkSelector);

        const openExternalCalls = await electronApp.evaluate(({shell}) => (shell as any).__e2eOpenExternalCalls ?? []);
        expect(openExternalCalls).toHaveLength(0);
        await expect.poll(async () => firstServer!.url(), {timeout: 10_000}).toContain('/channels/');

        await electronApp.evaluate(({shell}) => {
            const original = (shell as any).__e2eOriginalOpenExternal;
            if (original) {
                shell.openExternal = original;
            }
            delete (shell as any).__e2eOpenExternalCalls;
            delete (shell as any).__e2eOriginalOpenExternal;
        });
    });
});
