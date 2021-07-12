// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Tab, Team} from 'types/config';

import {MattermostServer} from 'main/MattermostServer';

import {MessagingTab} from './MessagingTab';

export const TAB_MESSAGING = 'TAB_MESSAGING';
export type TabType = typeof TAB_MESSAGING;

export interface ServerTab {
    server: MattermostServer;

    get name(): string;
    get type(): TabType;
    get url(): URL;
}

export class BaseServerTab implements ServerTab {
    server: MattermostServer;

    constructor(server: MattermostServer) {
        this.server = server;
    }
    get name(): string {
        return `${this.server.name}___${this.type}`;
    }
    get url(): URL {
        throw new Error('Not implemented');
    }
    get type(): TabType {
        throw new Error('Not implemented');
    }
}

export function getDefaultTeamWithTabsFromTeam(team: Team) {
    return {
        ...team,
        tabs: [
            {
                name: TAB_MESSAGING,
                order: 0,
            },
        ],
    };
}

// TODO: Might need to move this out
export function getServerTab(srv: MattermostServer, tab: Tab) {
    switch (tab.name) {
    case TAB_MESSAGING:
        return new MessagingTab(srv);
    default:
        throw new Error('Not implemeneted');
    }
}
