// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MattermostServer} from 'common/servers/MattermostServer';
import {parseURL} from 'common/utils/url';

import type {ClientConfig, RemoteInfo} from 'types/server';

import {getServerAPI} from './serverAPI';

export class ServerInfo {
    private server: MattermostServer;
    private remoteInfo: RemoteInfo;

    constructor(server: MattermostServer) {
        this.server = server;
        this.remoteInfo = {};
    }

    fetchConfigData = async () => {
        await this.getRemoteInfo<ClientConfig>(
            this.onGetConfig,
            parseURL(`${this.server.url}/api/v4/config/client?format=old`),
        );

        return this.remoteInfo;
    };

    fetchRemoteInfo = async () => {
        await this.fetchConfigData();
        await this.getRemoteInfo<Array<{id: string; version: string}>>(
            this.onGetPlugins,
            parseURL(`${this.server.url}/api/v4/plugins/webapp`),
        );

        return this.remoteInfo;
    };

    private getRemoteInfo = <T>(
        callback: (data: T) => void,
        url?: URL,
    ) => {
        if (!url) {
            return Promise.reject(new Error('Malformed URL'));
        }
        return new Promise<void>((resolve, reject) => {
            getServerAPI(
                url,
                false,
                (raw: string) => {
                    try {
                        const data = JSON.parse(raw) as T;
                        callback(data);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                },
                () => reject(new Error('Aborted')),
                (error: Error) => reject(error));
        });
    };

    private onGetConfig = (data: ClientConfig) => {
        this.remoteInfo.serverVersion = data.Version;
        this.remoteInfo.siteURL = data.SiteURL;
        this.remoteInfo.siteName = data.SiteName;
        this.remoteInfo.hasFocalboard = this.remoteInfo.hasFocalboard || data.BuildBoards === 'true';
    };

    private onGetPlugins = (data: Array<{id: string; version: string}>) => {
        this.remoteInfo.hasFocalboard = this.remoteInfo.hasFocalboard || data.some((plugin) => plugin.id === 'focalboard');
        this.remoteInfo.hasPlaybooks = data.some((plugin) => plugin.id === 'playbooks');
    };
}
