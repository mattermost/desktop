// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MattermostServer} from 'common/servers/MattermostServer';

import type {UniqueView, Server} from 'types/config';

export const TAB_MESSAGING = 'TAB_MESSAGING';
export const TAB_FOCALBOARD = 'TAB_FOCALBOARD';
export const TAB_PLAYBOOKS = 'TAB_PLAYBOOKS';
export type ViewType = typeof TAB_MESSAGING | typeof TAB_FOCALBOARD | typeof TAB_PLAYBOOKS;

export interface MattermostView {
    id: string;
    server: MattermostServer;
    isOpen?: boolean;

    get type(): ViewType;
    get url(): URL;
    get shouldNotify(): boolean;

    toUniqueView(): UniqueView;
}

export function getDefaultViewsForConfigServer(server: Server & {order: number; lastActiveView?: number}) {
    return {
        ...server,
        tabs: getDefaultViews(),
    };
}

export function getDefaultViews() {
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

export function getViewDisplayName(viewType: ViewType) {
    switch (viewType) {
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

export function canCloseView(viewType: ViewType) {
    return viewType !== TAB_MESSAGING;
}
