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
 * Turn Test mode off so non-admin users can start calls.
 *
 * Note: the UI label "Test mode" maps to the config key `DefaultEnabled` (inverted:
 * DefaultEnabled=true means test mode off). Both casings must be written —
 * `DefaultEnabled` for the plugin, `defaultenabled` for the System Console display.
 * The read-then-merge is required because config.Merge replaces the entire plugin
 * settings map, so a one-line patch drops every other Calls setting.
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
 * 12.0 default `channel_user` no longer includes `use_slash_commands`, so
 * `/call start` from a regular test user returns 403 and the widget never opens.
 */
async function ensureChannelUserCanUseSlashCommands(baseUrl: string, token: string): Promise<void> {
    const role = await apiRequest<{id: string; permissions: string[]}>(baseUrl, token, '/api/v4/roles/name/channel_user');
    if (role.permissions.includes('use_slash_commands')) {
        return;
    }

    await apiRequest(baseUrl, token, `/api/v4/roles/${role.id}/patch`, {
        method: 'PUT',
        body: JSON.stringify({
            permissions: [...role.permissions, 'use_slash_commands'],
        }),
    });
}

/**
 * Ensure the Calls plugin is installed, active, and configured for E2E testing.
 *
 * - Installs the plugin from the marketplace if absent.
 * - Restarts the plugin if it is already running.
 * - Turns Test mode off once the plugin is active.
 * - Grants `channel_user` `use_slash_commands` (dropped from 12.0 defaults).
 */
export async function ensureCallsPlugin(baseUrl: string, token: string): Promise<void> {
    if (await isCallsPluginEnabled(baseUrl, token)) {
        // Restart resets the plugin's in-memory per-user API rate limiter
        // (burst 10, refill 1/sec), giving each spec file a fresh bucket.
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

        if (await isCallsPluginEnabled(baseUrl, token)) {
            throw new Error(`Calls plugin (${CALLS_PLUGIN_ID}) did not disable within 30s`);
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

        // Marketplace install leaves the plugin inactive — enable it explicitly.
        await apiRequest<Record<string, unknown>>(baseUrl, token, `/api/v4/plugins/${CALLS_PLUGIN_ID}/enable`, {
            method: 'POST',
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
    await ensureChannelUserCanUseSlashCommands(baseUrl, token);

    // Poll until OnActivate has registered the 'call' slash command.
    // The plugin reports active before slash commands are ready, so /call start
    // can briefly return "command with trigger not found".
    const teams = await apiRequest<Array<{id: string}>>(baseUrl, token, '/api/v4/users/me/teams');
    if (teams.length > 0) {
        const firstTeamId = teams[0].id;
        let callCommandReady = false;
        const cmdDeadline = Date.now() + 30_000;
        while (Date.now() < cmdDeadline) {
            const commands = await apiRequest<Array<{trigger: string}>>(baseUrl, token, `/api/v4/commands?team_id=${firstTeamId}`);
            if (commands.some((c) => c.trigger === 'call')) {
                callCommandReady = true;
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
        if (!callCommandReady) {
            throw new Error('Calls plugin did not register the /call slash command within 30 seconds');
        }
    }
}
