// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- CI bootstrap script logs status to stdout/stderr */

import {apiLogin, apiRequest} from '../helpers/server_api/client';

type ServerConfig = {
    FileSettings?: {
        EnablePublicLink?: boolean;
    };
    ServiceSettings?: {
        SiteURL?: string;
    };
};

type ConfigPatch = {
    FileSettings: {
        EnablePublicLink: boolean;
    };
    ServiceSettings: {
        SiteURL: string;
    };
};

async function main(): Promise<void> {
    const baseUrl = (process.env.MM_TEST_SERVER_URL ?? '').replace(/\/$/, '');
    const username = process.env.MM_TEST_USER_NAME;
    const password = process.env.MM_TEST_PASSWORD;

    if (!baseUrl || !username || !password) {
        throw new Error('MM_TEST_SERVER_URL, MM_TEST_USER_NAME, and MM_TEST_PASSWORD are required');
    }

    const token = await apiLogin(baseUrl, username, password);
    const config = await apiRequest<ServerConfig>(baseUrl, token, '/api/v4/config');

    if (config.FileSettings?.EnablePublicLink === true) {
        console.log('Public links already enabled on the E2E server');
        return;
    }

    const siteURL = config.ServiceSettings?.SiteURL ?? baseUrl;
    const patch: ConfigPatch = {
        FileSettings: {EnablePublicLink: true},
        ServiceSettings: {SiteURL: siteURL},
    };
    await apiRequest(baseUrl, token, '/api/v4/config/patch', {
        method: 'PUT',
        body: JSON.stringify(patch),
    });

    const updated = await apiRequest<ServerConfig>(baseUrl, token, '/api/v4/config');
    if (updated.FileSettings?.EnablePublicLink !== true) {
        throw new Error('Failed to enable public links on the E2E server');
    }

    console.log('Enabled public links on the E2E server');
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
