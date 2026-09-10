// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Session} from 'electron';
import {session} from 'electron';

import {COOKIE_NAME_AUTH_TOKEN, COOKIE_NAME_CSRF, COOKIE_NAME_USER_ID} from 'common/constants';
import {Logger} from 'common/log';
import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {parseURL} from 'common/utils/url';
import {getServerAPI} from 'main/server/serverAPI';

import type {ChannelInfo} from 'types/server';

const log = new Logger('ServerChannels');

type ServerTeam = {
    id: string;
    name: string;
    display_name: string;
};

type ServerChannel = {
    id: string;
    name: string;
    display_name: string;
    team_id: string;
    type: 'O' | 'P' | 'D' | 'G';
};

/**
 * Checks if session has the required authentication cookies for the target server URL.
 */
export async function hasServerAuthCookies(serverUrl: URL, requestSession?: Session): Promise<boolean> {
    const targetSession = requestSession ?? session?.defaultSession;
    if (!targetSession) {
        return false;
    }
    try {
        const cookies = await targetSession.cookies.get({});
        const filtered = cookies.filter((c) => c.domain && serverUrl.toString().indexOf(c.domain) >= 0);
        return Boolean(
            filtered.find((c) => c.name === COOKIE_NAME_USER_ID) &&
            filtered.find((c) => c.name === COOKIE_NAME_CSRF) &&
            filtered.find((c) => c.name === COOKIE_NAME_AUTH_TOKEN),
        );
    } catch (e) {
        log.error(`Error checking cookies for ${serverUrl.toString()}`, e);
        return false;
    }
}

/**
 * Sends an authenticated GET request to the Mattermost server and parses JSON response.
 */
export function fetchServerJSON<T>(url: URL, timeoutMs = 5000, requestSession?: Session): Promise<T> {
    const targetSession = requestSession ?? session?.defaultSession;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout fetching ${url.toString()}`));
        }, timeoutMs);

        getServerAPI(
            url,
            true,
            (raw) => {
                clearTimeout(timer);
                try {
                    const data = JSON.parse(raw) as T;
                    resolve(data);
                } catch (e) {
                    reject(e);
                }
            },
            () => {
                clearTimeout(timer);
                reject(new Error('Aborted'));
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
            targetSession,
        ).then(() => {
            // Started request or returned
        }).catch((err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

/**
 * Fetches accessible channels for a single Mattermost server.
 */
export async function getChannelsForServer(server: MattermostServer, requestSession?: Session): Promise<ChannelInfo[]> {
    const targetSession = requestSession ?? session?.defaultSession;
    if (!targetSession) {
        return [];
    }
    try {
        const isAuth = await hasServerAuthCookies(server.url, targetSession);
        if (!isAuth) {
            log.debug(`Server ${server.name} does not have required auth cookies`);
            return [];
        }

        // 1. Fetch user teams
        const teamsUrl = parseURL(`${server.url}/api/v4/users/me/teams`);
        if (!teamsUrl) {
            return [];
        }

        let teams: ServerTeam[] = [];
        try {
            teams = await fetchServerJSON<ServerTeam[]>(teamsUrl, 5000, requestSession);
        } catch (err) {
            log.warn(`Failed to fetch teams for ${server.name}`, err);
        }

        const teamMap = new Map<string, string>();
        for (const team of teams) {
            teamMap.set(team.id, team.display_name || team.name);
        }

        // 2. Fetch user channels
        let rawChannels: ServerChannel[] = [];
        const channelsUrl = parseURL(`${server.url}/api/v4/users/me/channels`);
        if (channelsUrl) {
            try {
                rawChannels = await fetchServerJSON<ServerChannel[]>(channelsUrl, 5000, requestSession);
            } catch (err) {
                log.debug(`Failed to fetch all channels at once for ${server.name}, trying per-team`, err);
            }
        }

        // Fallback: fetch per team if global fetch failed or returned empty
        if (rawChannels.length === 0 && teams.length > 0) {
            const teamChannelsResults = await Promise.all(teams.map(async (team) => {
                const teamChannelsUrl = parseURL(`${server.url}/api/v4/users/me/teams/${team.id}/channels`);
                if (teamChannelsUrl) {
                    try {
                        return await fetchServerJSON<ServerChannel[]>(teamChannelsUrl, 5000, requestSession);
                    } catch (err) {
                        log.debug(`Failed to fetch channels for team ${team.name}`, err);
                    }
                }
                return [];
            }));
            for (const teamChannels of teamChannelsResults) {
                rawChannels.push(...teamChannels);
            }
        }

        // Deduplicate channels by id
        const seenIds = new Set<string>();
        const channels: ChannelInfo[] = [];

        for (const ch of rawChannels) {
            if (!ch.id || seenIds.has(ch.id)) {
                continue;
            }
            seenIds.add(ch.id);

            const teamName = teamMap.get(ch.team_id);
            let label = ch.display_name || ch.name;

            if (ch.type === 'D') {
                label = `${ch.display_name || ch.name} (Direct Message - ${server.name})`;
            } else if (ch.type === 'G') {
                label = `${ch.display_name || ch.name} (Group Message - ${server.name})`;
            } else if (teamName) {
                label = `${ch.display_name || ch.name} (${teamName} - ${server.name})`;
            } else {
                label = `${ch.display_name || ch.name} (${server.name})`;
            }

            channels.push({
                id: ch.id,
                name: ch.name,
                displayName: ch.display_name || ch.name,
                label,
                serverName: server.name,
                teamName,
            });
        }

        return channels;
    } catch (err) {
        log.error(`Error retrieving channels for server ${server.name}`, err);
        return [];
    }
}

/**
 * Retrieves channels across all configured servers for the currently logged in user.
 */
export async function handleGetAvailableChannels(): Promise<ChannelInfo[]> {
    const servers = ServerManager.getAllServers();
    const results: ChannelInfo[] = [];

    await Promise.all(servers.map(async (server) => {
        const serverChannels = await getChannelsForServer(server);
        results.push(...serverChannels);
    }));

    return results.sort((a, b) => a.label.localeCompare(b.label));
}
