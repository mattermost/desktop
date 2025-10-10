// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {v4 as uuid} from 'uuid';

import type {Theme} from '@mattermost/desktop-api';

import {parseURL} from 'common/utils/url';

import type {UniqueServer, Server} from 'types/config';

export class MattermostServer {
    id: string;
    name: string;
    url!: URL;
    isPredefined: boolean;
    initialLoadURL?: URL;
    isLoggedIn: boolean;
    preAuthSecret?: string;
    theme?: Theme;

    constructor(server: Server, isPredefined: boolean, initialLoadURL?: URL, preAuthSecret?: string) {
        this.id = uuid();

        this.name = server.name;
        this.updateURL(server.url);

        this.isPredefined = isPredefined;
        this.initialLoadURL = initialLoadURL;
        this.isLoggedIn = false;
        this.preAuthSecret = preAuthSecret;
    }

    updateURL = (url: string) => {
        this.url = parseURL(url)!;
        if (!this.url) {
            throw new Error('Invalid url for creating a server');
        }
    };

    toUniqueServer = (): UniqueServer => {
        return {
            name: this.name,
            url: this.url.toString(),
            id: this.id,
            isPredefined: this.isPredefined,
            isLoggedIn: this.isLoggedIn,
        };
    };
}
