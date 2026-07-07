// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
    ServiceSettings?: {
        SiteURL: string;
    };
};

const baseUrl = (process.env.MM_TEST_SERVER_URL ?? '').replace(/\/$/, '');
const username = process.env.MM_TEST_USER_NAME;
const password = process.env.MM_TEST_PASSWORD;

if (!baseUrl || !username || !password) {
    console.error('MM_TEST_SERVER_URL, MM_TEST_USER_NAME, and MM_TEST_PASSWORD are required');
    process.exit(1);
}

async function apiLogin(): Promise<string> {
    const response = await fetch(`${baseUrl}/api/v4/users/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({login_id: username, password}),
    });
    if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${await response.text()}`);
    }

    const token = response.headers.get('Token') ?? response.headers.get('token');
    if (token) {
        return token;
    }

    const body = await response.json() as {token?: string};
    if (body.token) {
        return body.token;
    }

    throw new Error('Login did not return a session token');
}

async function apiRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...init.headers,
        },
    });
    if (!response.ok) {
        throw new Error(`${init.method ?? 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
    }
    return response.json() as Promise<T>;
}

async function main(): Promise<void> {
    const token = await apiLogin();
    const config = await apiRequest<ServerConfig>(token, '/api/v4/config');

    if (config.FileSettings?.EnablePublicLink === true) {
        console.log('Public links already enabled on the E2E server');
        return;
    }

    const siteURL = config.ServiceSettings?.SiteURL ?? baseUrl;
    const patch: ConfigPatch = {
        FileSettings: {EnablePublicLink: true},
        ...(siteURL ? {ServiceSettings: {SiteURL: siteURL}} : {}),
    };
    await apiRequest(token, '/api/v4/config/patch', {
        method: 'PUT',
        body: JSON.stringify(patch),
    });

    const updated = await apiRequest<ServerConfig>(token, '/api/v4/config');
    if (updated.FileSettings?.EnablePublicLink !== true) {
        throw new Error('Failed to enable public links on the E2E server');
    }

    console.log('Enabled public links on the E2E server');
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
