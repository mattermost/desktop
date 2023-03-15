// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Tuple as tuple} from '@bloomberg/record-tuple-polyfill';

import {v4 as uuid} from 'uuid';

import {MattermostServer} from 'common/servers/MattermostServer';

import {getTabViewName, TabType, TabView, TabTuple} from './TabView';

export default abstract class BaseTabView implements TabView {
    id: string;
    server: MattermostServer;
    isOpen?: boolean;

    constructor(server: MattermostServer, isOpen?: boolean) {
        this.id = uuid();
        this.server = server;
        this.isOpen = isOpen;
    }
    get name(): string {
        return getTabViewName(this.server.name, this.type);
    }
    get urlTypeTuple(): TabTuple {
        return tuple(this.server.url.href, this.type) as TabTuple;
    }
    get url(): URL {
        throw new Error('Not implemented');
    }
    get type(): TabType {
        throw new Error('Not implemented');
    }
    get shouldNotify(): boolean {
        return false;
    }
}
