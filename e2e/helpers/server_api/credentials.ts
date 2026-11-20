// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mattermostURL} from '../config';

export type TestServerCredentials = {
    baseUrl: string;
    username: string;
    password: string;
};

export function getTestServerCredentials(): TestServerCredentials {
    const username = process.env.MM_TEST_USER_NAME;
    const password = process.env.MM_TEST_PASSWORD;
    const baseUrl = (process.env.MM_TEST_SERVER_URL ?? mattermostURL).replace(/\/$/, '');

    if (!username || !password) {
        throw new Error('MM_TEST_USER_NAME and MM_TEST_PASSWORD must be set');
    }

    return {baseUrl, username, password};
}
