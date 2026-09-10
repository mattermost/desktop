// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Session} from 'electron';
import {net, session} from 'electron';

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

type ServerUserProfile = {
    id: string;
    username: string;
    first_name?: string;
    last_name?: string;
    nickname?: string;
};

/**
 * Formats a user profile into a human-readable display name.
 */
export function formatUserDisplayName(user: ServerUserProfile): string {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    if (fullName && user.username) {
        return `${fullName} (@${user.username})`;
    }
    if (fullName) {
        return fullName;
    }
    if (user.username) {
        return `@${user.username}`;
    }
    if (user.nickname) {
        return user.nickname;
    }
    return user.id;
}

/**
 * Checks if session has the required authentication cookies for the target server URL.
 */
export async function hasServerAuthCookies(serverUrl: URL, requestSession?: Session): Promise<boolean> {
    const targetSession = requestSession ?? session?.defaultSession;
    if (!targetSession) {
        return false;
    }
    try {
        const cookies = await targetSession.cookies.get({url: serverUrl.toString()});
        return Boolean(
            cookies.find((c) => c.name === COOKIE_NAME_USER_ID) &&
            cookies.find((c) => c.name === COOKIE_NAME_CSRF) &&
            cookies.find((c) => c.name === COOKIE_NAME_AUTH_TOKEN),
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
 * Sends an authenticated POST request with JSON payload to the Mattermost server and parses JSON response.
 */
export function postServerJSON<T>(
    url: URL,
    body: unknown,
    csrfToken?: string,
    timeoutMs = 5000,
    requestSession?: Session,
): Promise<T> {
    const targetSession = requestSession ?? session?.defaultSession;
    if (!targetSession) {
        return Promise.reject(new Error('No session available'));
    }

    return new Promise((resolve, reject) => {
        let timer: NodeJS.Timeout | undefined;
        let isTimedOut = false;

        try {
            const req = net.request({
                url: url.toString(),
                method: 'POST',
                session: targetSession,
                useSessionCookies: true,
            });

            timer = setTimeout(() => {
                isTimedOut = true;
                req.abort();
                reject(new Error(`Timeout posting to ${url.toString()}`));
            }, timeoutMs);

            req.setHeader('Content-Type', 'application/json');
            if (csrfToken) {
                req.setHeader('X-CSRF-Token', csrfToken);
                req.setHeader('X-Requested-With', 'XMLHttpRequest');
            }

            req.on('response', (response: Electron.IncomingMessage) => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    const chunks: Buffer[] = [];
                    response.on('data', (chunk: Buffer) => {
                        chunks.push(chunk);
                    });
                    response.on('end', () => {
                        clearTimeout(timer);
                        try {
                            const data = JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
                            resolve(data);
                        } catch (e) {
                            reject(e);
                        }
                    });
                } else {
                    clearTimeout(timer);
                    reject(new Error(`Bad status code ${response.statusCode} from ${url.toString()}`));
                }
                response.on('error', (err) => {
                    clearTimeout(timer);
                    if (!isTimedOut) {
                        reject(err);
                    }
                });
            });

            req.on('error', (err) => {
                clearTimeout(timer);
                if (!isTimedOut) {
                    reject(err);
                }
            });

            req.on('abort', () => {
                clearTimeout(timer);
                if (!isTimedOut) {
                    reject(new Error('Aborted'));
                }
            });

            req.write(JSON.stringify(body));
            req.end();
        } catch (err) {
            clearTimeout(timer);
            reject(err);
        }
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

        // Get current user ID and CSRF token from cookies
        let currentUserId = '';
        let csrfToken = '';
        try {
            const serverCookies = await targetSession.cookies.get({url: server.url.toString()});
            currentUserId = serverCookies.find((c) => c.name === COOKIE_NAME_USER_ID)?.value || '';
            csrfToken = serverCookies.find((c) => c.name === COOKIE_NAME_CSRF)?.value || '';
        } catch (e) {
            log.debug(`Error getting user ID from cookies for ${server.name}`, e);
        }

        if (!currentUserId) {
            const meUrl = parseURL(`${server.url}/api/v4/users/me`);
            if (meUrl) {
                try {
                    const me = await fetchServerJSON<ServerUserProfile>(meUrl, 5000, targetSession);
                    currentUserId = me.id;
                } catch (err) {
                    log.debug(`Failed to fetch current user profile for ${server.name}`, err);
                }
            }
        }

        // 1. Fetch user teams
        const teamsUrl = parseURL(`${server.url}/api/v4/users/me/teams`);
        if (!teamsUrl) {
            return [];
        }

        let teams: ServerTeam[] = [];
        try {
            teams = await fetchServerJSON<ServerTeam[]>(teamsUrl, 5000, targetSession);
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
                rawChannels = await fetchServerJSON<ServerChannel[]>(channelsUrl, 5000, targetSession);
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
                        return await fetchServerJSON<ServerChannel[]>(teamChannelsUrl, 5000, targetSession);
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

        // Collect DM channels and other user IDs
        const dmUserIds = new Set<string>();
        const dmChannelToOtherUserId = new Map<string, string>();

        for (const ch of rawChannels) {
            if (ch.type === 'D' && ch.name && ch.name.includes('__')) {
                const parts = ch.name.split('__');
                if (parts.length === 2) {
                    const otherId = parts[0] === currentUserId ? parts[1] : parts[0];
                    if (otherId) {
                        dmUserIds.add(otherId);
                        dmChannelToOtherUserId.set(ch.id, otherId);
                    }
                }
            }
        }

        const userMap = new Map<string, string>();
        const userUsernameMap = new Map<string, string>();

        if (dmUserIds.size > 0) {
            const userIdsList = Array.from(dmUserIds);
            const usersIdsUrl = parseURL(`${server.url}/api/v4/users/ids`);
            let fetchedUsers: ServerUserProfile[] = [];

            if (usersIdsUrl) {
                try {
                    fetchedUsers = await postServerJSON<ServerUserProfile[]>(
                        usersIdsUrl,
                        userIdsList,
                        csrfToken,
                        5000,
                        targetSession,
                    );
                } catch (err) {
                    log.debug(`Failed to bulk fetch users for ${server.name} via POST /api/v4/users/ids`, err);
                }
            }

            for (const u of fetchedUsers) {
                userMap.set(u.id, formatUserDisplayName(u));
                if (u.username) {
                    userUsernameMap.set(u.id, u.username);
                }
            }

            // Fallback for any user IDs not resolved in bulk: fetch individually with GET /api/v4/users/{id}
            const missingUserIds = userIdsList.filter((id) => !userMap.has(id));
            if (missingUserIds.length > 0) {
                const individualResults = await Promise.all(missingUserIds.map(async (userId) => {
                    const userUrl = parseURL(`${server.url}/api/v4/users/${userId}`);
                    if (userUrl) {
                        try {
                            return await fetchServerJSON<ServerUserProfile>(userUrl, 5000, targetSession);
                        } catch (err) {
                            log.debug(`Failed to fetch user ${userId} for ${server.name}`, err);
                        }
                    }
                    return null;
                }));

                for (const u of individualResults) {
                    if (u) {
                        userMap.set(u.id, formatUserDisplayName(u));
                        if (u.username) {
                            userUsernameMap.set(u.id, u.username);
                        }
                    }
                }
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
            let displayName = ch.display_name || ch.name;
            let channelName = ch.name;

            if (ch.type === 'D') {
                const otherUserId = dmChannelToOtherUserId.get(ch.id);
                const otherUserName = otherUserId ? userMap.get(otherUserId) : undefined;
                const otherUserUsername = otherUserId ? userUsernameMap.get(otherUserId) : undefined;

                if (otherUserName) {
                    displayName = otherUserName;
                    channelName = otherUserUsername || ch.name;
                    label = `${otherUserName} (Direct Message - ${server.name})`;
                } else if (ch.display_name) {
                    label = `${ch.display_name} (Direct Message - ${server.name})`;
                } else {
                    label = `Direct Message (${server.name})`;
                }
            } else if (ch.type === 'G') {
                label = `${ch.display_name || ch.name} (Group Message - ${server.name})`;
            } else if (teamName) {
                label = `${ch.display_name || ch.name} (${teamName} - ${server.name})`;
            } else {
                label = `${ch.display_name || ch.name} (${server.name})`;
            }

            channels.push({
                id: ch.id,
                name: channelName,
                displayName,
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
