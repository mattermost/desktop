// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {apiRequest} from './client';

export const CALLS_PLUGIN_ID = 'com.mattermost.calls';

type PluginList = {
    active: Array<{id: string}>;
    inactive: Array<{id: string}>;
};

export async function isCallsPluginEnabled(baseUrl: string, token: string): Promise<boolean> {
    const plugins = await apiRequest<PluginList>(baseUrl, token, '/api/v4/plugins');
    return plugins.active.some((p) => p.id === CALLS_PLUGIN_ID);
}

export async function ensureCallsPlugin(baseUrl: string, token: string): Promise<void> {
    if (await isCallsPluginEnabled(baseUrl, token)) {
        return;
    }

    // Ensure plugins are enabled before installing.
    await apiRequest<Record<string, unknown>>(baseUrl, token, '/api/v4/config/patch', {
        method: 'PUT',
        body: JSON.stringify({
            PluginSettings: {Enable: true},
        }),
    });

    // Install the prepackaged version from the Mattermost marketplace.
    // Passing an empty version string lets the server resolve the latest
    // compatible version automatically — no hardcoded URL or version needed.
    await apiRequest<Record<string, unknown>>(baseUrl, token, '/api/v4/plugins/marketplace', {
        method: 'POST',
        body: JSON.stringify({id: CALLS_PLUGIN_ID, version: ''}),
    });

    // Poll until the server reports the plugin as active.
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        if (await isCallsPluginEnabled(baseUrl, token)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2_000));
    }

    throw new Error(`Calls plugin (${CALLS_PLUGIN_ID}) did not become active within 60s`);
}
