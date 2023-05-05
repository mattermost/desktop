// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UniqueView, Server} from 'types/config';

import {MattermostServer} from 'common/servers/MattermostServer';

export const TAB_MESSAGING = 'TAB_MESSAGING';
export const TAB_FOCALBOARD = 'TAB_FOCALBOARD';
export const TAB_PLAYBOOKS = 'TAB_PLAYBOOKS';
export type TabType = typeof TAB_MESSAGING | typeof TAB_FOCALBOARD | typeof TAB_PLAYBOOKS;

export interface TabView {
    id: string;
    server: MattermostServer;
    isOpen?: boolean;

    get type(): TabType;
    get url(): URL;
    get shouldNotify(): boolean;

    toUniqueView(): UniqueView;
}

export function getDefaultConfigServerFromServer(server: Server & {order: number; lastActiveTab?: number}) {
    return {
        ...server,
        tabs: getDefaultTabs(),
    };
}

export function getDefaultTabs() {
    return [
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
    ];
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
