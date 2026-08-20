// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {demoConfig, demoMattermostConfig} from '../../helpers/config';
import {
    getMessageBoxCalls,
    stubMessageBoxResponses,
    restoreMessageBox,
} from '../../helpers/dialog';
import {loginToMattermost} from '../../helpers/login';
import {typeIntoPostTextbox} from '../../helpers/mattermostShell';
import {triggerCustomProtocol, waitForDefaultProtocolsAllowed} from '../../helpers/protocolLinks';
import {
    getShellOpenExternalCalls,
    restoreShellOpenExternal,
    stubShellOpenExternal,
} from '../../helpers/shell';

const SPOTIFY_URL = 'spotify:album:5fmIolILp5NAtNYiRPjhzA';
const STEAM_URL = 'steam://store';
const DEFAULT_PROTOCOL_URLS = [
    'mailto:someone@example.com',
    'http://mattermost.com/',
    'https://mattermost.com/',
    'ftp://example.com/',
    'tel:+12025550168',
];

function allowedProtocolsPath(testInfo: {outputDir: string}): string {
    return path.join(testInfo.outputDir, 'userdata', 'allowedProtocols.json');
}

function readAllowedProtocols(filePath: string): string[] {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

test.describe('permissions/trust_protocols', () => {
    test.use({appConfig: demoConfig});

    /**
     * MM-T2925 step 3 (unhandled-exception crash dialog) cannot be E2E:
     * CriticalErrorHandler returns immediately when NODE_ENV === 'test'.
     * Covered by src/main/CriticalErrorHandler.test.js.
     */
    test(
        'MM-T2925 Trust protocols, default schemes, and persist Save to allowedProtocols.json',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}, testInfo) => {
            const serverWin = serverMap[demoConfig.servers[0].name][0].win;
            const protocolsFile = allowedProtocolsPath(testInfo);

            await waitForDefaultProtocolsAllowed(electronApp);
            await stubShellOpenExternal(electronApp);
            try {
                await stubMessageBoxResponses(electronApp, [{response: 1}]);
                await triggerCustomProtocol(electronApp, serverWin, SPOTIFY_URL, {expectDialog: true});

                await expect.poll(
                    () => getShellOpenExternalCalls(electronApp),
                    {timeout: 10_000, message: 'Save must open the Spotify URL via shell.openExternal'},
                ).toContain(SPOTIFY_URL);

                await expect.poll(
                    () => readAllowedProtocols(protocolsFile),
                    {timeout: 10_000, message: 'Save must persist spotify: to allowedProtocols.json'},
                ).toContain('spotify:');

                const dialogsAfterSave = (await getMessageBoxCalls(electronApp)).length;
                await stubShellOpenExternal(electronApp);
                await triggerCustomProtocol(electronApp, serverWin, SPOTIFY_URL, {expectDialog: false});
                await expect.poll(
                    () => getShellOpenExternalCalls(electronApp),
                    {timeout: 10_000, message: 'A saved protocol must open without showing the trust dialog again'},
                ).toContain(SPOTIFY_URL);
                expect((await getMessageBoxCalls(electronApp)).length).toBe(dialogsAfterSave);

                await stubMessageBoxResponses(electronApp, [{response: 2}]);
                await stubShellOpenExternal(electronApp);
                const dialogsBeforeNo = (await getMessageBoxCalls(electronApp)).length;
                await triggerCustomProtocol(electronApp, serverWin, STEAM_URL, {expectDialog: true});
                await expect.poll(
                    async () => (await getMessageBoxCalls(electronApp)).length,
                    {timeout: 10_000},
                ).toBeGreaterThan(dialogsBeforeNo);
                expect(await getShellOpenExternalCalls(electronApp)).not.toContain(STEAM_URL);
                expect(readAllowedProtocols(protocolsFile)).not.toContain('steam:');

                await stubMessageBoxResponses(electronApp, [{response: 0}]);
                await stubShellOpenExternal(electronApp);
                await triggerCustomProtocol(electronApp, serverWin, STEAM_URL, {expectDialog: true});
                await expect.poll(
                    () => getShellOpenExternalCalls(electronApp),
                    {timeout: 10_000, message: 'Yes without Save must still open the protocol'},
                ).toContain(STEAM_URL);
                expect(readAllowedProtocols(protocolsFile)).not.toContain('steam:');

                const dialogsBeforeDefaults = (await getMessageBoxCalls(electronApp)).length;
                await stubShellOpenExternal(electronApp);
                for (const url of DEFAULT_PROTOCOL_URLS) {
                    await triggerCustomProtocol(electronApp, serverWin, url, {expectDialog: false});
                    await expect.poll(
                        () => getShellOpenExternalCalls(electronApp),
                        {timeout: 10_000, message: `${url} must open without a trust dialog`},
                    ).toContain(url);
                }
                expect((await getMessageBoxCalls(electronApp)).length).toBe(dialogsBeforeDefaults);
            } finally {
                await restoreMessageBox(electronApp).catch(() => {});
                await restoreShellOpenExternal(electronApp);
            }
        },
    );

    test.describe('markdown auto-convert', () => {
        test.use({appConfig: demoMattermostConfig});

        test(
            'MM-T2925 posted markdown converts default protocols to links',
            {tag: ['@P2', '@all']},
            async ({serverMap}) => {
                test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

                const serverWin = serverMap[demoMattermostConfig.servers[0].name][0].win;
                await loginToMattermost(serverWin);
                await serverWin.waitForSelector('#post_textbox', {timeout: 30_000});
                await typeIntoPostTextbox(
                    serverWin,
                    '[email](mailto:someone@example.com) [https](https://mattermost.com) [spotify](spotify:album:5fmIolILp5NAtNYiRPjhzA)',
                );
                await serverWin.keyboard.press('Enter');

                await expect.poll(async () => {
                    const mailto = await serverWin.locator('a[href^="mailto:"]').count();
                    const httpsLink = await serverWin.locator('a[href*="mattermost.com"]').count();
                    return mailto + httpsLink;
                }, {timeout: 15_000, message: 'Posted protocol markdown should render as anchors'}).toBeGreaterThan(0);
            },
        );
    });
});
