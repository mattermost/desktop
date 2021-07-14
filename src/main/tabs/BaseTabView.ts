// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MattermostServer} from 'main/MattermostServer';

import {getTabViewName, TabType, TabView} from './TabView';

export default class BaseTabView implements TabView {
    server: MattermostServer;

    constructor(server: MattermostServer) {
        this.server = server;
    }
    get name(): string {
        return getTabViewName(this.server.name, this.type);
    }
    get url(): URL {
        throw new Error('Not implemented');
    }
    get type(): TabType {
        throw new Error('Not implemented');
    }
}
