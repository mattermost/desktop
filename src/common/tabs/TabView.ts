// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Tab, Team} from 'types/config';

import {MattermostServer} from 'common/servers/MattermostServer';

import MessagingTabView from './MessagingTabView';
import FocalboardTabView from './FocalboardTabView';
import PlaybooksTabView from './PlaybooksTabView';

export const TAB_MESSAGING = 'TAB_MESSAGING';
export const TAB_FOCALBOARD = 'TAB_FOCALBOARD';
export const TAB_PLAYBOOKS = 'TAB_PLAYBOOKS';
export type TabType = typeof TAB_MESSAGING | typeof TAB_FOCALBOARD | typeof TAB_PLAYBOOKS;
export type TabTuple = [string, TabType];

export interface TabView {
    server: MattermostServer;

    get name(): string;
    get type(): TabType;
    get url(): URL;
    get shouldNotify(): boolean;
    get urlTypeTuple(): TabTuple;
}

export function getDefaultTeamWithTabsFromTeam(team: Team) {
    return {
        ...team,
        tabs: [
            {
                name: TAB_MESSAGING,
                order: 0,
                isOpen: true,
            },
            {
                name: TAB_FOCALBOARD,
                order: 1,
            },
            {
                name: TAB_PLAYBOOKS,
                order: 2,
            },
        ],
    };
}

export function getServerView(srv: MattermostServer, tab: Tab) {
    switch (tab.name) {
    case TAB_MESSAGING:
        return new MessagingTabView(srv);
    case TAB_FOCALBOARD:
        return new FocalboardTabView(srv);
    case TAB_PLAYBOOKS:
        return new PlaybooksTabView(srv);
    default:
        throw new Error('Not implemeneted');
    }
}

export function getTabViewName(serverName: string, tabType: string) {
    return `${serverName}___${tabType}`;
}

export function getTabDisplayName(tabType: TabType) {
    switch (tabType) {
    case TAB_MESSAGING:
        return 'Channels';
    case TAB_FOCALBOARD:
        return 'Boards';
    case TAB_PLAYBOOKS:
        return 'Playbooks';
    default:
        throw new Error('Not implemeneted');
    }
}

export function canCloseTab(tabType: TabType) {
    return tabType !== TAB_MESSAGING;
}
