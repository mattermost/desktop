// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {apiLogin, apiRequest} from './client';
import {getTestServerCredentials} from './credentials';

type ServerConfig = {
    FileSettings?: {
        EnablePublicLink?: boolean;
    };
    ServiceSettings?: {
        SiteURL?: string;
    };
};

export async function isPublicLinkEnabled(credentials = getTestServerCredentials()): Promise<boolean> {
    const token = await apiLogin(credentials.baseUrl, credentials.username, credentials.password);
    const config = await apiRequest<ServerConfig>(credentials.baseUrl, token, '/api/v4/config');
    return config.FileSettings?.EnablePublicLink === true;
}

export async function enablePublicLinks(credentials = getTestServerCredentials()): Promise<boolean> {
    const token = await apiLogin(credentials.baseUrl, credentials.username, credentials.password);
    const config = await apiRequest<ServerConfig>(credentials.baseUrl, token, '/api/v4/config');

    if (config.FileSettings?.EnablePublicLink === true) {
        return false;
    }

    const siteURL = config.ServiceSettings?.SiteURL ?? credentials.baseUrl;
    await apiRequest(credentials.baseUrl, token, '/api/v4/config', {
        method: 'PUT',
        body: JSON.stringify({
            ...config,
            ServiceSettings: {...config.ServiceSettings, SiteURL: siteURL},
            FileSettings: {...config.FileSettings, EnablePublicLink: true},
        }),
    });

    return true;
}

export async function getFilePublicLink(fileId: string, credentials = getTestServerCredentials()): Promise<string> {
    const token = await apiLogin(credentials.baseUrl, credentials.username, credentials.password);
    const response = await apiRequest<{link: string}>(
        credentials.baseUrl,
        token,
        `/api/v4/files/${fileId}/link`,
    );
    return response.link;
}
