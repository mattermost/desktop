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

const DEFAULT_API_TIMEOUT_MS = 30_000;

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

async function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (init.signal) {
        if (init.signal.aborted) {
            clearTimeout(timeoutId);
            throw init.signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
        }
        init.signal.addEventListener('abort', () => controller.abort(), {once: true});
    }

    try {
        return await fetch(url, {...init, signal: controller.signal});
    } catch (error) {
        if (controller.signal.aborted && !init.signal?.aborted) {
            throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function apiLogin(baseUrl: string, loginId: string, password: string): Promise<string> {
    const path = '/api/v4/users/login';
    let response: Response;
    try {
        response = await fetchWithTimeout(`${baseUrl}${path}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({login_id: loginId, password}),
        });
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Request timed out after')) {
            throw new Error(`POST ${path} timed out after ${DEFAULT_API_TIMEOUT_MS}ms`);
        }
        throw error;
    }
    if (!response.ok) {
        throw new ApiRequestError('POST', path, response.status, await response.text());
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
    let response: Response;
    try {
        response = await fetchWithTimeout(`${baseUrl}${path}`, {
            ...init,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...normalizeHeaders(init.headers),
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Request timed out after')) {
            throw new ApiRequestError(init.method ?? 'GET', path, 408, `Request timed out after ${DEFAULT_API_TIMEOUT_MS}ms`);
        }
        throw error;
    }
    if (!response.ok) {
        throw new ApiRequestError(init.method ?? 'GET', path, response.status, await response.text());
    }

    return response.json() as Promise<T>;
}
