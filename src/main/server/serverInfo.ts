// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log from 'electron-log';

import {ClientConfig, RemoteInfo} from 'types/server';

import {MattermostServer} from 'common/servers/MattermostServer';

import {getServerAPI} from './serverAPI';

export class ServerInfo {
    server: MattermostServer;
    remoteInfo: RemoteInfo;
    promise: Promise<RemoteInfo | string | undefined>;
    onRetrievedRemoteInfo?: (result?: RemoteInfo | string) => void;
    onError?: (error: Error) => void;

    constructor(server: MattermostServer) {
        this.server = server;
        this.remoteInfo = {id: server.id};

        this.promise = new Promise<RemoteInfo | string | undefined>((resolve, reject) => {
            this.onRetrievedRemoteInfo = resolve;
            this.onError = reject;
        });
        this.getRemoteInfo();
    }

    getRemoteInfo = () => {
        getServerAPI<ClientConfig>(
            new URL(`${this.server.url.toString()}/api/v4/config/client?format=old`),
            false,
            this.onGetConfig,
            this.onRetrievedRemoteInfo,
            this.onError);

        getServerAPI<Array<{id: string; version: string}>>(
            new URL(`${this.server.url.toString()}/api/v4/plugins/webapp`),
            false,
            this.onGetPlugins,
            this.onRetrievedRemoteInfo,
            this.onError);
    }

    onGetConfig = (data: ClientConfig) => {
        this.remoteInfo.serverVersion = data.Version;
        this.remoteInfo.siteURL = data.SiteURL;
        this.remoteInfo.hasFocalboard = this.remoteInfo.hasFocalboard || data.BuildBoards === 'true';

        this.trySendRemoteInfo();
    }

    onGetPlugins = (data: Array<{id: string; version: string}>) => {
        this.remoteInfo.hasFocalboard = this.remoteInfo.hasFocalboard || data.some((plugin) => plugin.id === 'focalboard');
        this.remoteInfo.hasPlaybooks = data.some((plugin) => plugin.id === 'playbooks');

        this.trySendRemoteInfo();
    }

    trySendRemoteInfo = () => {
        log.debug('ServerInfo.trySendRemoteInfo', this.server.name, this.remoteInfo);

        if (this.isRemoteInfoRetrieved()) {
            this.onRetrievedRemoteInfo?.(this.remoteInfo);
        }
    }

    isRemoteInfoRetrieved = () => {
        return !(
            typeof this.remoteInfo.serverVersion === 'undefined' ||
            typeof this.remoteInfo.hasFocalboard === 'undefined' ||
            typeof this.remoteInfo.hasPlaybooks === 'undefined'
        );
    }
}
