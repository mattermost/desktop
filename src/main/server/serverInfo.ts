// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientConfig, RemoteInfo} from 'types/server';

import {MattermostServer} from 'common/servers/MattermostServer';

import {getServerAPI} from './serverAPI';

export class ServerInfo {
    private server: MattermostServer;
    private remoteInfo: RemoteInfo;

    constructor(server: MattermostServer) {
        this.server = server;
        this.remoteInfo = {};
    }

    fetchRemoteInfo = async () => {
        await this.getRemoteInfo<ClientConfig>(
            new URL(`${this.server.url.toString()}/api/v4/config/client?format=old`),
            this.onGetConfig,
        );
        await this.getRemoteInfo<Array<{id: string; version: string}>>(
            new URL(`${this.server.url.toString()}/api/v4/plugins/webapp`),
            this.onGetPlugins,
        );

        return this.remoteInfo;
    }

    private getRemoteInfo = <T>(
        url: URL,
        callback: (data: T) => void,
    ) => {
        return new Promise<void>((resolve, reject) => {
            getServerAPI<T>(
                url,
                false,
                (data: T) => {
                    callback(data);
                    resolve();
                },
                () => reject(new Error('Aborted')),
                (error: Error) => reject(error));
        });
    }

    private onGetConfig = (data: ClientConfig) => {
        this.remoteInfo.serverVersion = data.Version;
        this.remoteInfo.siteURL = data.SiteURL;
        this.remoteInfo.hasFocalboard = this.remoteInfo.hasFocalboard || data.BuildBoards === 'true';
    }

    private onGetPlugins = (data: Array<{id: string; version: string}>) => {
        this.remoteInfo.hasFocalboard = this.remoteInfo.hasFocalboard || data.some((plugin) => plugin.id === 'focalboard');
        this.remoteInfo.hasPlaybooks = data.some((plugin) => plugin.id === 'playbooks');
    }
}
