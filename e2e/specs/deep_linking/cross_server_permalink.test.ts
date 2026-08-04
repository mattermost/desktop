// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig, mattermostURL, type AppConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {
    POST_TEXTBOX_SELECTOR,
    typeIntoPostTextbox,
    pressPostTextboxKey,
    waitForMattermostShellReady,
} from '../../helpers/mattermostShell';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {
    getShellOpenExternalCalls,
    restoreShellOpenExternal,
    stubShellOpenExternal,
} from '../../helpers/shell';
import {buildServerMap} from '../../helpers/serverMap';
import type {ServerView} from '../../helpers/serverView';

// ── MM-T1430: Cross-server permalink (MM-19919) ────────────────────────
// Clicking a permalink to a post on server A while viewing server B must
// switch to server A and navigate to the post in-app — never opening an
// external browser or a new Electron BrowserWindow.

const SERVER_A_NAME = 'serverA';
const SERVER_B_NAME = 'serverB';

function alternateMattermostURL(): string {
    const url = new URL(mattermostURL);
    if (url.hostname === 'localhost') {
        url.hostname = '127.0.0.1';
        return url.toString();
    }
    if (url.hostname === '127.0.0.1') {
        url.hostname = 'localhost';
        return url.toString();
    }

    // Trailing-slash variants normalize to the same URL; use a distinct path so
    // ServerManager keeps two entries for the same Mattermost instance.
    if (url.pathname === '/' || url.pathname === '') {
        return `${url.origin}/login`;
    }
    return `${url.origin}/`;
}

const crossServerConfig: AppConfig = {
    ...demoMattermostConfig,
    servers: [
        {name: SERVER_A_NAME, url: mattermostURL, order: 0},
        {name: SERVER_B_NAME, url: alternateMattermostURL(), order: 1},
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

async function getActiveTabUrl(app: ElectronApplication, serverName: string): Promise<string | null> {
    return app.evaluate(({webContents}, targetServerName) => {
        const refs = (global as any).__e2eTestRefs;
        const server = refs?.ServerManager?.getAllServers?.().find((candidate: {name: string}) => candidate.name === targetServerName);
        if (!server) {
            return null;
        }

        const activeTab = refs.TabManager.getCurrentTabForServer(server.id);
        if (!activeTab) {
            return null;
        }

        const webContentsView = refs.WebContentsManager.getView(activeTab.id);
        if (!webContentsView) {
            return null;
        }

        const wc = webContents.fromId(webContentsView.webContentsId);
        return wc?.getURL() ?? null;
    }, serverName);
}

async function waitForServerPermalinkNavigation(
    app: ElectronApplication,
    serverName: string,
    permalinkMessage: string,
): Promise<string> {
    let matchedUrl = '';
    await expect.poll(async () => {
        const activeUrl = await getActiveTabUrl(app, serverName);
        if (activeUrl?.includes('/pl/')) {
            matchedUrl = activeUrl;
            return true;
        }

        const map = await buildServerMap(app);
        for (const entry of map[serverName] ?? []) {
            const onPermalink = await entry.win.evaluate((needle) => {
                return window.location.pathname.includes('/pl/') &&
                    (document.body.textContent ?? '').includes(needle);
            }, permalinkMessage);
            if (onPermalink) {
                matchedUrl = await entry.win.url();
                return true;
            }
        }
        return false;
    }, {timeout: 45_000, message: 'Server must navigate to the permalink post'}).toBe(true);

    return matchedUrl;
}

async function openTownSquare(serverWin: ServerView): Promise<void> {
    await waitForMattermostShellReady(serverWin, {channelItem: '#sidebarItem_town-square'});
    const onTownSquare = await serverWin.runInRenderer<boolean>(`
        const item = document.querySelector('#sidebarItem_town-square');
        return Boolean(
            item?.classList.contains('active')
            || item?.classList.contains('active-link')
            || item?.getAttribute('aria-current') === 'page',
        );
    `);
    if (!onTownSquare) {
        await serverWin.click('#sidebarItem_town-square');
    }
    await serverWin.waitForSelector(POST_TEXTBOX_SELECTOR, {timeout: 30_000});
}

async function clickPostedPermalink(serverWin: ServerView, permalinkUrl: string, useWindowOpen: boolean): Promise<void> {
    await expect.poll(async () => serverWin.evaluate((targetUrl) => {
        const posts = Array.from(document.querySelectorAll('[id^="post_"]'));
        for (let index = posts.length - 1; index >= 0; index--) {
            const post = posts[index];
            if (!(post.textContent ?? '').includes(targetUrl)) {
                continue;
            }
            return Boolean(post.querySelector('a[href*="/pl/"]'));
        }
        return false;
    }, permalinkUrl), {timeout: 15_000, message: 'Posted permalink must render as a link'}).toBe(true);

    await serverWin.evaluate(({targetUrl, openInNewWindow}) => {
        const posts = Array.from(document.querySelectorAll('[id^="post_"]'));
        for (let index = posts.length - 1; index >= 0; index--) {
            const post = posts[index];
            if (!(post.textContent ?? '').includes(targetUrl)) {
                continue;
            }

            const link = post.querySelector('a[href*="/pl/"]') as HTMLAnchorElement | null;
            if (!link) {
                continue;
            }

            const href = new URL(link.getAttribute('href') ?? link.href, window.location.href).href;
            if (openInNewWindow) {
                window.open(href, '_blank');
            } else {
                link.click();
            }
            return;
        }

        window.open(targetUrl, '_blank');
    }, {targetUrl: permalinkUrl, openInNewWindow: useWindowOpen});
}

async function postMessageInChannel(serverWin: ServerView, message: string): Promise<void> {
    await typeIntoPostTextbox(serverWin, message);

    const sent = await serverWin.evaluate(() => {
        const sendButton = document.querySelector(
            '#channelHeaderSubmitButton, button[aria-label*="Send" i], [data-testid="SendMessageButton"]',
        ) as HTMLButtonElement | null;
        if (!sendButton) {
            return false;
        }
        sendButton.click();
        return true;
    });
    if (!sent) {
        await pressPostTextboxKey(serverWin, 'Enter');
    }
}

async function postMessageAndCapturePermalink(serverWin: ServerView, message: string): Promise<string> {
    await postMessageInChannel(serverWin, message);

    await expect.poll(
        () => serverWin.evaluate((needle) => {
            const posts = Array.from(document.querySelectorAll('[id^="post_"], .post'));
            return posts.some((post) => (post.textContent ?? '').includes(needle));
        }, message),
        {timeout: 15_000, message: 'Posted message must appear in the channel'},
    ).toBe(true);

    const permalink = await serverWin.evaluate((needle) => {
        const posts = Array.from(document.querySelectorAll('[id^="post_"]'));
        for (const post of posts) {
            const text = post.textContent ?? '';
            if (!text.includes(needle)) {
                continue;
            }

            post.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            const link = post.querySelector('.post__permalink a, a[href*="/pl/"]') as HTMLAnchorElement | null;
            const href = link?.href ?? link?.getAttribute('href') ?? '';
            if (href.includes('/pl/')) {
                return href;
            }

            const postId = post.id.replace(/^post_/, '');
            const team = window.location.pathname.split('/').filter(Boolean)[0];
            if (postId && team) {
                return `${window.location.origin}/${team}/pl/${postId}`;
            }
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
        async ({electronApp}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            let serverMap!: Awaited<ReturnType<typeof buildServerMap>>;
            await expect.poll(async () => {
                serverMap = await buildServerMap(electronApp);
                return Boolean(serverMap[SERVER_A_NAME]?.[0] && serverMap[SERVER_B_NAME]?.[0]);
            }, {timeout: 30_000, message: 'Both server views must be registered'}).toBe(true);

            const serverA = serverMap[SERVER_A_NAME]![0].win;
            const serverB = serverMap[SERVER_B_NAME]![0].win;

            const windowsBefore = await electronApp.evaluate(({BrowserWindow}) => {
                return BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed()).length;
            });

            await stubShellOpenExternal(electronApp);

            try {
                await prepareMattermostServerView(electronApp, serverMap[SERVER_A_NAME]![0].webContentsId);
                await loginToMattermost(serverA!);
                await openTownSquare(serverA!);

                const permalinkMessage = `MM-T1430 permalink ${Date.now()}`;
                const permalinkUrl = await postMessageAndCapturePermalink(serverA!, permalinkMessage);

                await switchToServer(electronApp, SERVER_B_NAME);
                await prepareMattermostServerView(electronApp, serverMap[SERVER_B_NAME]![0].webContentsId);
                await loginToMattermost(serverB!);
                await openTownSquare(serverB!);

                await postMessageInChannel(serverB!, permalinkUrl);

                const sameHost = new URL(mattermostURL).hostname === new URL(alternateMattermostURL()).hostname;
                await clickPostedPermalink(serverB!, permalinkUrl, sameHost);

                await expect.poll(
                    () => getCurrentServerName(electronApp),
                    {timeout: 15_000, message: 'Permalink click must activate server A'},
                ).toBe(SERVER_A_NAME);

                const permalinkDestination = await waitForServerPermalinkNavigation(
                    electronApp,
                    SERVER_A_NAME,
                    permalinkMessage,
                );
                expect(permalinkDestination).toMatch(/\/pl\//);

                expect(await getShellOpenExternalCalls(electronApp)).toHaveLength(0);
                expect(
                    await electronApp.evaluate(({BrowserWindow}) => {
                        return BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed()).length;
                    }),
                    'Permalink must not open a new BrowserWindow',
                ).toBe(windowsBefore);
            } finally {
                await restoreShellOpenExternal(electronApp);
            }
        },
    );
});
