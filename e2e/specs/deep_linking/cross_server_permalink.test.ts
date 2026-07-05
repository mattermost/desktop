// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig, mattermostURL, type AppConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {
    typeIntoPostTextbox,
    waitForChannelPostListLoaded,
    waitForMattermostShellReady,
} from '../../helpers/mattermostShell';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {
    getShellOpenExternalCalls,
    restoreShellOpenExternal,
    stubShellOpenExternal,
} from '../../helpers/shell';
import type {ServerView} from '../../helpers/serverView';

// ── MM-T1430: Cross-server permalink (MM-19919) ────────────────────────
// Clicking a permalink to a post on server A while viewing server B must
// switch to server A and navigate to the post in-app — never opening an
// external browser or a new Electron BrowserWindow.

const SERVER_A_NAME = 'serverA';
const SERVER_B_NAME = 'serverB';

const crossServerConfig: AppConfig = {
    ...demoMattermostConfig,
    servers: [
        {name: SERVER_A_NAME, url: mattermostURL, order: 0},
        {name: SERVER_B_NAME, url: mattermostURL, order: 1},
    ],
    lastActiveServer: 0,
};

async function switchToServer(app: ElectronApplication, serverName: string) {
    await app.evaluate((_, targetServerName) => {
        const refs = (global as any).__e2eTestRefs;
        const server = refs?.ServerManager?.getAllServers?.().find((candidate: {name: string}) => candidate.name === targetServerName);
        if (!server) {
            throw new Error(`Server not found: ${targetServerName}`);
        }
        refs.ServerManager.updateCurrentServer(server.id);
    }, serverName);
}

async function getCurrentServerName(app: ElectronApplication): Promise<string> {
    return app.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        const currentServerId = refs?.ServerManager?.getCurrentServerId?.();
        const server = currentServerId ? refs?.ServerManager?.getServer?.(currentServerId) : undefined;
        return server?.name ?? '';
    });
}

async function postMessageAndCapturePermalink(serverWin: ServerView, message: string): Promise<string> {
    await typeIntoPostTextbox(serverWin, message);
    await serverWin.keyboard.press('Enter');

    await expect.poll(
        () => serverWin.evaluate((needle) => {
            return Array.from(document.querySelectorAll('.post-message__text')).some(
                (element) => (element.textContent ?? '').includes(needle),
            );
        }, message),
        {timeout: 15_000, message: 'Posted message must appear in the channel'},
    ).toBe(true);

    const permalink = await serverWin.evaluate((needle) => {
        const posts = Array.from(document.querySelectorAll('[id^="post_"]'));
        for (const post of posts) {
            const text = post.querySelector('.post-message__text')?.textContent ?? '';
            if (!text.includes(needle)) {
                continue;
            }
            const link = post.querySelector('.post__permalink a') as HTMLAnchorElement | null;
            return link?.href ?? link?.getAttribute('href') ?? '';
        }
        return '';
    }, message) as string;

    expect(permalink, 'Permalink href must be available on the posted message').toBeTruthy();
    expect(permalink).toMatch(/\/pl\//);
    return permalink;
}

test.describe('deep_linking/cross_server_permalink', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: crossServerConfig});
    test.setTimeout(180_000);

    test(
        'MM-T1430 cross-server permalink switches server tabs in-app',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const serverA = serverMap[SERVER_A_NAME]?.[0]?.win;
            const serverB = serverMap[SERVER_B_NAME]?.[0]?.win;
            expect(serverA, 'Server A view must exist').toBeTruthy();
            expect(serverB, 'Server B view must exist').toBeTruthy();

            const windowsBefore = electronApp.windows().length;

            await stubShellOpenExternal(electronApp);

            try {
                await prepareMattermostServerView(electronApp, serverMap[SERVER_A_NAME]![0].webContentsId);
                await loginToMattermost(serverA!);
                await waitForMattermostShellReady(serverA!, {channelItem: '#sidebarItem_off-topic'});
                await serverA!.click('#sidebarItem_off-topic');
                await waitForChannelPostListLoaded(serverA!);

                const permalinkMessage = `MM-T1430 permalink ${Date.now()}`;
                const permalinkUrl = await postMessageAndCapturePermalink(serverA!, permalinkMessage);

                await switchToServer(electronApp, SERVER_B_NAME);
                await prepareMattermostServerView(electronApp, serverMap[SERVER_B_NAME]![0].webContentsId);
                await loginToMattermost(serverB!);
                await waitForMattermostShellReady(serverB!, {channelItem: '#sidebarItem_town-square'});
                await serverB!.click('#sidebarItem_town-square');
                await waitForChannelPostListLoaded(serverB!);

                await typeIntoPostTextbox(serverB!, permalinkUrl);
                await serverB!.keyboard.press('Enter');

                const permalinkSelector = 'a[href*="/pl/"], a.markdown__link[href*="/pl/"]';
                await serverB!.waitForSelector(permalinkSelector, {timeout: 15_000});
                await serverB!.click(permalinkSelector);

                await expect.poll(
                    () => getCurrentServerName(electronApp),
                    {timeout: 15_000, message: 'Permalink click must activate server A'},
                ).toBe(SERVER_A_NAME);

                await expect.poll(
                    async () => serverA!.url(),
                    {timeout: 15_000, message: 'Server A must navigate to the permalink post'},
                ).toMatch(/\/pl\//);

                expect(await getShellOpenExternalCalls(electronApp)).toHaveLength(0);
                expect(electronApp.windows().length, 'Permalink must not open a new BrowserWindow').toBe(windowsBefore);
            } finally {
                await restoreShellOpenExternal(electronApp);
            }
        },
    );
});
