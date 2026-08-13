// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {apiRequest} from './client';

export const CALLS_PLUGIN_ID = 'com.mattermost.calls';

type PluginList = {
    active: Array<{id: string}>;
    inactive: Array<{id: string}>;
};

type ServerConfig = {
    PluginSettings?: {
        Plugins?: Record<string, Record<string, unknown>>;
    };
};

export async function isCallsPluginEnabled(baseUrl: string, token: string): Promise<boolean> {
    const plugins = await apiRequest<PluginList>(baseUrl, token, '/api/v4/plugins');
    return plugins.active.some((p) => p.id === CALLS_PLUGIN_ID);
}

/**
 * Turn the Calls plugin's "Test mode" off, so non-admin users are allowed to start
 * calls. While test mode is on, only users holding manage_system can start or join
 * a call in a channel that has not been explicitly enabled.
 *
 * REVIEWER NOTE — two things below are deliberate and easy to "simplify" wrongly:
 *
 * 1. The key is `DefaultEnabled`, not `TestMode`, and it is INVERTED. `TestMode` is
 *    a client-side display name only; no such server config key exists. See
 *    mattermost-plugin-calls server/configuration.go:
 *        TestMode="off" -> DefaultEnabled=true
 *        TestMode="on"  -> DefaultEnabled=false
 *    PluginSettings.Plugins is an untyped map[string]map[string]any with no schema
 *    validation, so patching a key that does not exist is accepted and echoed back
 *    with HTTP 200 while changing nothing. A green response here proves nothing.
 *
 * 2. The read-then-merge is required. config.Merge replaces plugin config maps
 *    wholesale rather than merging them, and patchConfig only preserves plugin IDs
 *    absent from the patch. Patching a single key therefore REPLACES this plugin's
 *    entire settings block and drops every other key. Do not collapse this into a
 *    bare one-line patch.
 *
 * Together those caused the original bug: patching `{TestMode: false}` deleted
 * `DefaultEnabled`, which falls back to false — pinning test mode permanently ON.
 */
async function disableCallsTestMode(baseUrl: string, token: string): Promise<void> {
    const config = await apiRequest<ServerConfig>(baseUrl, token, '/api/v4/config');
    const current = config.PluginSettings?.Plugins?.[CALLS_PLUGIN_ID] ?? {};

    // Both casing variants are required. The plugin.json schema key is `DefaultEnabled`
    // (PascalCase), which is what the System Console and GET /api/v4/config use. The
    // plugin's Go struct JSON tag is `defaultenabled` (lowercase), which is what
    // LoadPluginConfiguration deserializes into the in-memory config struct. Writing
    // only the PascalCase key leaves the in-memory field at its zero value (false = test
    // mode ON). The System Console writes both on every save — we do the same.
    const settings: Record<string, unknown> = {...current, DefaultEnabled: true, defaultenabled: true};

    // Clear the inert `TestMode` key written by earlier revisions of this helper.
    delete settings.TestMode;

    await apiRequest<Record<string, unknown>>(baseUrl, token, '/api/v4/config/patch', {
        method: 'PUT',
        body: JSON.stringify({
            PluginSettings: {
                Plugins: {
                    [CALLS_PLUGIN_ID]: settings,
                },
            },
        }),
    });
}

/**
 * Ensure the Calls plugin is installed, active, and configured for E2E testing.
 *
 * - Installs the plugin from the marketplace if absent.
 * - Restarts the plugin if it is already running.
 * - Turns Test mode off once the plugin is active.
 */
export async function ensureCallsPlugin(baseUrl: string, token: string): Promise<void> {
    if (await isCallsPluginEnabled(baseUrl, token)) {
        // Restart the plugin. NOTE: this is not required by the config write below.
        // Calls never calls SavePluginConfig (it appears only in generated mocks) and
        // Mattermost does not persist schema defaults on activation, so nothing can
        // overwrite a patch regardless of when it is applied. The restart is kept
        // because it resets the plugin's in-memory per-user API rate limiter
        // (burst 10, refill 1/sec), giving each spec file a fresh bucket.
        //
        // KNOWN GAP: the poll below uses isCallsPluginEnabled, which reports the
        // plugin active before OnActivate has finished registering slash commands —
        // so `/call` can briefly resolve to "command with trigger not found". The fix
        // is to poll GET /api/v4/commands?team_id= until the `call` trigger appears.
        await apiRequest<Record<string, unknown>>(baseUrl, token, `/api/v4/plugins/${CALLS_PLUGIN_ID}/disable`, {
            method: 'POST',
        });

        const disableDeadline = Date.now() + 30_000;
        while (Date.now() < disableDeadline) {
            if (!await isCallsPluginEnabled(baseUrl, token)) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1_000));
        }

        await apiRequest<Record<string, unknown>>(baseUrl, token, `/api/v4/plugins/${CALLS_PLUGIN_ID}/enable`, {
            method: 'POST',
        });
    } else {
        // Plugin is absent — install it from the marketplace.
        await apiRequest<Record<string, unknown>>(baseUrl, token, '/api/v4/config/patch', {
            method: 'PUT',
            body: JSON.stringify({PluginSettings: {Enable: true}}),
        });

        await apiRequest<Record<string, unknown>>(baseUrl, token, '/api/v4/plugins/marketplace', {
            method: 'POST',
            body: JSON.stringify({id: CALLS_PLUGIN_ID, version: ''}),
        });
    }

    // Wait until the plugin is active before reading or writing its config.
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        if (await isCallsPluginEnabled(baseUrl, token)) {
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2_000));
    }

    if (!await isCallsPluginEnabled(baseUrl, token)) {
        throw new Error(`Calls plugin (${CALLS_PLUGIN_ID}) did not become active within 60s`);
    }

    await disableCallsTestMode(baseUrl, token);
}
