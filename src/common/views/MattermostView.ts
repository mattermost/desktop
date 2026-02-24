// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {v4 as uuid} from 'uuid';

import type {PopoutViewProps} from '@mattermost/desktop-api';

import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {isInternalURL, parseURL} from 'common/utils/url';

import type {UniqueView} from 'types/config';

export enum ViewType {
    TAB = 'tab',
    WINDOW = 'window',
}

export class MattermostView {
    id: string;
    serverId: string;
    type: ViewType;
    title: {channelName?: string; teamName?: string; serverName: string};
    initialPath?: string;

    // Constrained views
    parentViewId?: string;
    props?: PopoutViewProps;

    constructor(
        server: MattermostServer,
        type: ViewType,
        initialPath?: string,
        parentViewId?: string,
        props?: PopoutViewProps,
    ) {
        this.id = uuid();
        this.serverId = server.id;
        this.type = type;
        this.title = {serverName: server.name};
        this.initialPath = initialPath;
        this.parentViewId = parentViewId;
        this.props = props;
    }

    getLoadingURL = (): URL => {
        const server = ServerManager.getServer(this.serverId);
        if (!server) {
            throw new Error(`Server ${this.serverId} not found`);
        }

        // Only return the initial load URL if there is no initial path
        if (!this.initialPath) {
            return server.initialLoadURL ?? server.url;
        }

        // If the server URL is the root and the initial path starts with a slash, remove the slash
        let initialPath = this.initialPath;
        if (server.url.pathname === '/' && this.initialPath.startsWith('/')) {
            initialPath = this.initialPath.slice(1);
        }

        const url = parseURL(server.url.toString() + initialPath);
        if (!url) {
            throw new Error(`URL for server ${this.serverId} is not valid`);
        }

        // Fall back to the server URL if the URL is not internal
        if (!isInternalURL(server.url, url)) {
            return server.url;
        }
        return url;
    };

    toUniqueView(): UniqueView {
        return {
            id: this.id,
            serverId: this.serverId,
            channelName: this.title.channelName,
            teamName: this.title.teamName,
            serverName: this.title.serverName,
        };
    }
}
