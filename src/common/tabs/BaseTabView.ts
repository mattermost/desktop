// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {v4 as uuid} from 'uuid';

import {MattermostTab} from 'types/config';

import {MattermostServer} from 'common/servers/MattermostServer';

import {TabType, TabView} from './TabView';

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
        return this.type;
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

    toMattermostTab = (): MattermostTab => {
        return {
            id: this.id,
            name: this.name,
            isOpen: this.isOpen,
        };
    }
}
