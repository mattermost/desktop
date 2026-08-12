// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig, mattermostURL} from '../../helpers/config';
import {getHelpSubmenuLabels, patchHelpMenuRemoteInfo} from '../../helpers/helpMenuLinks';
import {loginToMattermost} from '../../helpers/login';
import {clickApplicationMenuItem} from '../../helpers/menu';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {getShellOpenExternalCalls, restoreShellOpenExternal, stubShellOpenExternal} from '../../helpers/shell';

const EXTERNAL_HELP_URL = 'https://github.com/mattermost';
const EXTERNAL_REPORT_URL = 'https://forum.mattermost.org/';

test.describe('mattermost/help_report_links', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test(
        'MM-T3360 Configure Help & Report a Problem links (external website + mailto)',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            expect(serverEntry?.win, 'Mattermost server view should exist').toBeTruthy();

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await loginToMattermost(serverEntry!.win);
            await serverEntry!.win.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});

            await stubShellOpenExternal(electronApp);
            try {
                await patchHelpMenuRemoteInfo(electronApp, {
                    helpLink: EXTERNAL_HELP_URL,
                    reportProblemLink: EXTERNAL_REPORT_URL,
                });

                await clickApplicationMenuItem(electronApp, 'help', {labelIncludes: 'User guide'});
                await expect.poll(
                    () => getShellOpenExternalCalls(electronApp),
                    {timeout: 10_000, message: 'Help link must open in the system browser'},
                ).toContain(EXTERNAL_HELP_URL);

                await clickApplicationMenuItem(electronApp, 'help', {labelIncludes: 'Report a problem'});
                await expect.poll(
                    () => getShellOpenExternalCalls(electronApp),
                    {timeout: 10_000, message: 'Report a problem link must open in the system browser'},
                ).toContain(EXTERNAL_REPORT_URL);

                const serverOrigin = new URL(mattermostURL).origin;
                const channelHelpLink = `${serverOrigin}/channels/town-square`;
                await patchHelpMenuRemoteInfo(electronApp, {
                    helpLink: channelHelpLink,
                    reportProblemLink: `${serverOrigin}/channels/off-topic`,
                });

                await clickApplicationMenuItem(electronApp, 'help', {labelIncludes: 'User guide'});
                await expect.poll(
                    () => getShellOpenExternalCalls(electronApp),
                    {timeout: 10_000, message: 'Server channel Help link must be opened via shell.openExternal on desktop'},
                ).toContain(channelHelpLink);

                await patchHelpMenuRemoteInfo(electronApp, {
                    helpLink: 'mailto:support@example.com',
                    reportProblemLink: 'mailto:bugs@example.com',
                });

                const labels = await getHelpSubmenuLabels(electronApp);
                expect(labels.some((label) => label.includes('User guide'))).toBe(false);
                expect(labels.some((label) => label.includes('Report a problem'))).toBe(false);
            } finally {
                await restoreShellOpenExternal(electronApp);
            }
        },
    );
});
