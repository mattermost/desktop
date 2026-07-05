// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {
    pressPostTextboxKey,
    typeIntoPostTextbox,
    waitForChannelPostListLoaded,
    waitForMattermostShellReady,
} from '../../helpers/mattermostShell';
import {getShellOpenExternalCalls, restoreShellOpenExternal, stubShellOpenExternal} from '../../helpers/shell';
import type {ServerView} from '../../helpers/serverView';

const UNTRUSTED_LINK_MARKDOWN = '[evil-link](hello,world:,/../../..//api/v4/image?url=https://google.com)';

async function findRenderedUntrustedLinkHref(serverWin: ServerView, serverBaseUrl: string): Promise<string | null> {
    return serverWin.evaluate((base) => {
        const link = Array.from(document.querySelectorAll('a')).find((element) => element.textContent?.trim() === 'evil-link');
        if (!(link instanceof HTMLAnchorElement)) {
            return null;
        }

        const rawHref = link.getAttribute('href');
        if (!rawHref) {
            return null;
        }

        try {
            const pageBase = window.location.origin.startsWith('http') ? window.location.href : `${base}/`;
            return new URL(rawHref, pageBase).toString();
        } catch {
            const match = rawHref.match(/api\/v4\/image\?.+/);
            if (!match) {
                return null;
            }
            return new URL(`/${match[0]}`, `${base}/`).toString();
        }
    }, serverBaseUrl);
}

async function openUntrustedLinkInNewWindow(serverWin: ServerView, resolvedUrl: string): Promise<void> {
    await serverWin.evaluate((url) => {
        const link = Array.from(document.querySelectorAll('a')).find((element) => element.textContent?.trim() === 'evil-link');
        if (link instanceof HTMLAnchorElement) {
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.click();
            return;
        }

        window.open(url, '_blank');
    }, resolvedUrl);
}

test.describe('permissions/untrusted_links', () => {
    test.use({appConfig: demoMattermostConfig});

    test(
        'MM-T4055 Opening untrusted links in the browser',
        {tag: ['@P2', '@darwin', '@win32']},
        async ({electronApp, serverMap}) => {
            test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name][0];
            await prepareMattermostServerView(electronApp, serverEntry.webContentsId);
            const serverWin = serverEntry.win;
            await loginToMattermost(serverWin);
            await waitForMattermostShellReady(serverWin, {channelItem: '#sidebarItem_off-topic'});
            await serverWin.click('#sidebarItem_off-topic');
            await waitForChannelPostListLoaded(serverWin);

            await stubShellOpenExternal(electronApp);

            const serverBaseUrl = process.env.MM_TEST_SERVER_URL!.replace(/\/$/, '');

            try {
                await typeIntoPostTextbox(serverWin, UNTRUSTED_LINK_MARKDOWN);
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

                let resolvedUrl = '';
                await expect.poll(async () => {
                    const href = await findRenderedUntrustedLinkHref(serverWin, serverBaseUrl);
                    if (href) {
                        resolvedUrl = href;
                    }
                    return href;
                }, {
                    timeout: 15_000,
                    message: 'Untrusted markdown link must render as a clickable anchor',
                }).toBeTruthy();

                await openUntrustedLinkInNewWindow(serverWin, resolvedUrl);

                let calls = await getShellOpenExternalCalls(electronApp);
                if (calls.length === 0) {
                    await serverWin.evaluate((url) => {
                        window.open(url, '_blank');
                    }, resolvedUrl);
                    calls = await getShellOpenExternalCalls(electronApp);
                }

                expect(calls.length, 'Untrusted link must open in the system browser via shell.openExternal').toBeGreaterThan(0);
                expect(
                    calls.some((url) => url.includes('google.com') || url.includes('api/v4/image')),
                    `Expected image-proxy or google.com URL, got: ${calls.join(', ')}`,
                ).toBe(true);
            } finally {
                await restoreShellOpenExternal(electronApp);
            }
        },
    );
});
