// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {apiLogin, apiRequest} from './client';
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

export function buildChannelUrl(baseUrl: string, teamName: string, channelName: string): string {
    return `${baseUrl}/${teamName}/channels/${channelName}`;
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
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('404')) {
                throw error;
            }
        }
    }

    throw new Error(`Channel "${channelName}" not found on any team for the test user`);
}
