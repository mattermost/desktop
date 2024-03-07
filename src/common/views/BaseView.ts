// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {v4 as uuid} from 'uuid';

import type {MattermostServer} from 'common/servers/MattermostServer';

import type {UniqueView} from 'types/config';

import type {ViewType, MattermostView} from './View';

export default abstract class BaseView implements MattermostView {
    id: string;
    server: MattermostServer;
    isOpen?: boolean;

    constructor(server: MattermostServer, isOpen?: boolean) {
        this.id = uuid();
        this.server = server;
        this.isOpen = isOpen;
    }
    get url(): URL {
        throw new Error('Not implemented');
    }
    get type(): ViewType {
        throw new Error('Not implemented');
    }
    get shouldNotify(): boolean {
        return false;
    }

    toUniqueView = (): UniqueView => {
        return {
            id: this.id,
            name: this.type,
            isOpen: this.isOpen,
        };
    };
}
