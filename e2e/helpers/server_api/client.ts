// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export class ApiRequestError extends Error {
    readonly status: number;

    constructor(method: string, path: string, status: number, body: string) {
        super(`${method} ${path} failed: ${status} ${body}`);
        this.name = 'ApiRequestError';
        this.status = status;
    }
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
    if (!headers) {
        return {};
    }
    if (headers instanceof Headers) {
        return Object.fromEntries(headers.entries());
    }
    if (Array.isArray(headers)) {
        return Object.fromEntries(headers);
    }
    return {...headers};
}

export async function apiLogin(baseUrl: string, loginId: string, password: string): Promise<string> {
    const response = await fetch(`${baseUrl}/api/v4/users/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({login_id: loginId, password}),
    });
    if (!response.ok) {
        throw new Error(`POST /api/v4/users/login failed: ${response.status} ${await response.text()}`);
    }

    const headerToken = response.headers.get('Token') ?? response.headers.get('token');
    if (headerToken) {
        return headerToken;
    }

    const body = await response.json() as {token?: string};
    if (body.token) {
        return body.token;
    }

    throw new Error('POST /api/v4/users/login did not return a session token');
}

export async function apiRequest<T>(
    baseUrl: string,
    token: string,
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...normalizeHeaders(init.headers),
        },
    });
    if (!response.ok) {
        throw new ApiRequestError(init.method ?? 'GET', path, response.status, await response.text());
    }

    return response.json() as Promise<T>;
}
