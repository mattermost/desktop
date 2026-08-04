// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';
import {mattermostDeepLinkUrl, openDeepLinkInApp, waitForServerUrlAndDropdown} from '../../helpers/deeplink';

test(
    'MM-T6129 OAuth callback deep link navigates the active server view',
    {tag: ['@P1', '@all']},
    async ({electronApp, mainWindow}) => {
        const serverName = demoConfig.servers[0].name;
        const oauthPath = '/oauth/authorize?client_id=desktop&response_type=code&state=e2e-test';
        const deepLink = mattermostDeepLinkUrl(`example.com${oauthPath}`);

        await openDeepLinkInApp(electronApp, deepLink);

        await waitForServerUrlAndDropdown(electronApp, mainWindow, serverName, 'example.com/oauth/authorize');
    },
);
