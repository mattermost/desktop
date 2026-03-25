// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type AgentInfo = {
    id: string;
    displayName: string;
    username: string;
    lastIconUpdate: number;
    dmChannelID: string;
};

export type AgentBotsResponse = {
    bots: AgentInfo[];
    searchEnabled: boolean;
};

export type AvailableAgent = AgentInfo & {
    serverId: string;
    serverName: string;
};
