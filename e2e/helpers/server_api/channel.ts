// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {apiLogin, apiRequest, ApiRequestError} from './client';
import {getTestServerCredentials} from './credentials';
import {apiGetTeamsForUser} from './team';

type Team = {
    id: string;
    name: string;
};

type Channel = {
    id: string;
    name: string;
    team_id: string;
};

export type ResolvedChannel = {
    id: string;
    teamId: string;
    name: string;
    url: string;
};

export async function apiGetChannelByName(
    baseUrl: string,
    token: string,
    teamId: string,
    channelName: string,
): Promise<Channel> {
    return apiRequest<Channel>(baseUrl, token, `/api/v4/teams/${teamId}/channels/name/${channelName}`);
}

export async function apiCreateChannel(
    baseUrl: string,
    token: string,
    teamId: string,
    name: string,
    displayName: string,
    type: 'O' | 'P' = 'P',
): Promise<Channel> {
    return apiRequest<Channel>(baseUrl, token, '/api/v4/channels', {
        method: 'POST',
        body: JSON.stringify({
            team_id: teamId,
            name,
            display_name: displayName,
            type,
        }),
    });
}

export async function apiAddUserToChannel(
    baseUrl: string,
    token: string,
    channelId: string,
    userId: string,
): Promise<void> {
    await apiRequest<unknown>(baseUrl, token, `/api/v4/channels/${channelId}/members`, {
        method: 'POST',
        body: JSON.stringify({user_id: userId}),
    });
}

export function buildChannelUrl(baseUrl: string, teamName: string, channelName: string): string {
    return `${baseUrl}/${teamName}/channels/${channelName}`;
}

export function resolvedChannelPath(channel: ResolvedChannel): string {
    return new URL(channel.url).pathname;
}

export async function resolveChannelByName(
    channelName: string,
    credentials = getTestServerCredentials(),
): Promise<ResolvedChannel> {
    const token = await apiLogin(credentials.baseUrl, credentials.username, credentials.password);
    const teams = await apiGetTeamsForUser(credentials.baseUrl, token) as Team[];

    for (const team of teams) {
        try {
            const channel = await apiGetChannelByName(credentials.baseUrl, token, team.id, channelName);
            return {
                id: channel.id,
                teamId: channel.team_id,
                name: channel.name,
                url: buildChannelUrl(credentials.baseUrl, team.name, channel.name),
            };
        } catch (error) {
            if (!(error instanceof ApiRequestError) || error.status !== 404) {
                throw error;
            }
        }
    }

    throw new Error(`Channel "${channelName}" not found on any team for the test user`);
}
